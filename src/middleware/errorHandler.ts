/**
 * Global Error Handler Middleware
 * Centralized error handling untuk consistency
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import {
  AppError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  isOperationalError,
  getSafeErrorMessage,
  getErrorStatusCode,
} from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { ErrorResponse } from '@/types';

/**
 * Handle Prisma errors
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      const target = error.meta?.target as string[] | undefined;
      const field = target ? target.join(', ') : 'field';
      return new ValidationError(`${field} sudah digunakan. Silakan gunakan nilai lain.`);

    case 'P2025':
      // Record not found
      return new NotFoundError('Data yang dicari tidak ditemukan.');

    case 'P2003':
      // Foreign key constraint violation
      return new ValidationError('Data tidak valid. Referensi tidak ditemukan.');

    case 'P2014':
      // Invalid relation
      return new ValidationError('Relasi data tidak valid.');

    case 'P2000':
      // Value too long
      return new ValidationError('Nilai input terlalu panjang.');

    case 'P2001':
      // Record not found in where condition
      return new NotFoundError('Data tidak ditemukan.');

    default:
      logger.error('Unhandled Prisma error', error, { code: error.code });
      return new DatabaseError('Terjadi kesalahan database.');
  }
}

/**
 * Handle Zod validation errors
 */
function handleZodError(error: ZodError): AppError {
  const messages = error.issues.map((err) => {
    const field = err.path.join('.');
    return `${field}: ${err.message}`;
  });

  return new ValidationError(messages.join(', '));
}

/**
 * Main error handler
 */
export function handleError(error: unknown): NextResponse<ErrorResponse> {
  let appError: AppError;

  // Convert different error types to AppError
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    appError = handlePrismaError(error);
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    appError = new ValidationError('Data input tidak valid.');
  } else if (error instanceof ZodError) {
    appError = handleZodError(error);
  } else if (error instanceof Error) {
    // Generic Error
    logger.error('Unhandled error', error);
    appError = new AppError('Terjadi kesalahan pada sistem.');
  } else {
    // Unknown error type
    logger.error('Unknown error type', new Error(String(error)));
    appError = new AppError('Terjadi kesalahan tidak terduga.');
  }

  // Log error jika bukan operational error
  if (!isOperationalError(appError)) {
    logger.error('Non-operational error occurred', appError);
  }

  // Get safe message (hide internal details in production)
  const isDevelopment = process.env.NODE_ENV === 'development';
  const message = isDevelopment ? appError.message : getSafeErrorMessage(appError);
  const statusCode = getErrorStatusCode(appError);

  const response: ErrorResponse = {
    success: false,
    error: message,
    statusCode,
  };

  // Add stack trace in development
  if (isDevelopment && appError.stack) {
    response.details = {
      stack: appError.stack,
      name: appError.name,
    };
  }

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Async error wrapper untuk API handlers
 * Catches errors dan process dengan handleError
 */
export function asyncHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  };
}

/**
 * Try-catch wrapper dengan automatic error handling
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (errorMessage) {
      logger.error(errorMessage, error instanceof Error ? error : new Error(String(error)));
    }
    throw error;
  }
}

/**
 * Example usage:
 * 
 * Option 1: Using asyncHandler wrapper
 * ```typescript
 * export const POST = asyncHandler(async (request: NextRequest) => {
 *   // Your logic here
 *   // Errors will be automatically handled
 *   const data = await prisma.user.create({ ... });
 *   return NextResponse.json({ success: true, data });
 * });
 * ```
 * 
 * Option 2: Manual try-catch with handleError
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   try {
 *     const data = await prisma.user.create({ ... });
 *     return NextResponse.json({ success: true, data });
 *   } catch (error) {
 *     return handleError(error);
 *   }
 * }
 * ```
 */
