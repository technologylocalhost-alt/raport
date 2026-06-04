import { NextResponse } from 'next/server';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Create a successful response
 */
export function successResponse<T>(data: T, message?: string | number, status: number = 200): NextResponse<ApiResponse<T>> {
  // If message is a number, treat it as status code
  const actualStatus = typeof message === 'number' ? message : status;
  const actualMessage = typeof message === 'string' ? message : undefined;
  
  return NextResponse.json(
    {
      success: true,
      data,
      ...(actualMessage && { message: actualMessage }),
    },
    { status: actualStatus }
  );
}

/**
 * Create an error response
 */
export function errorResponse(error: string, status = 400, details?: unknown): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details !== undefined ? { details } : {}),
    },
    { status }
  );
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  status = 200
) {
  return NextResponse.json(
    {
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
    { status }
  );
}
