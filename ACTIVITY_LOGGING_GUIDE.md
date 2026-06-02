/**
 * ACTIVITY LOGGING INTEGRATION GUIDE
 * 
 * This document provides examples and patterns for integrating activity logging
 * into API endpoints throughout the application.
 * 
 * The activity logging system tracks all user actions (CREATE, READ, UPDATE, DELETE, APPROVE, etc.)
 * with full context including IP address, user-agent, old/new values, and status.
 */

// ============================================================================
// IMPORTS
// ============================================================================

// Always add these imports to routes that need activity logging:
import { logActivity, getClientIp, getUserAgent, logActivityError, logBulkActivity } from '@/lib/activity-logger';

// ============================================================================
// PATTERN 1: CREATE OPERATION
// ============================================================================

/**
 * Example: User creates a new student
 */
async function createResource(request: NextRequest, userId: string, body: any) {
  try {
    // ... validation and creation logic ...
    const newResource = await prisma.student.create({
      data: { /* ... */ }
    });

    // Log successful creation
    await logActivity({
      userId,
      action: 'CREATE',
      resourceType: 'Student',
      resourceId: newResource.id,
      resourceName: `${newResource.name} (${newResource.studentNo})`,
      description: `Created student: ${newResource.name}`,
      newValue: {
        name: newResource.name,
        studentNo: newResource.studentNo,
        classId: newResource.classId,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(newResource, 201);
  } catch (error) {
    // Log failed creation
    await logActivityError({
      userId,
      action: 'CREATE',
      resourceType: 'Student',
      description: 'Failed to create student',
      newValue: { studentNo: body?.studentNo },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    }, error);

    return errorResponse('Failed to create student', 500);
  }
}

// ============================================================================
// PATTERN 2: UPDATE OPERATION
// ============================================================================

/**
 * Example: User updates an existing resource
 */
async function updateResource(request: NextRequest, userId: string, resourceId: string, body: any) {
  try {
    // Get old data before updating
    const oldData = await prisma.student.findUnique({
      where: { id: resourceId }
    });

    // ... validation logic ...

    // Perform update
    const updatedResource = await prisma.student.update({
      where: { id: resourceId },
      data: { /* ... */ }
    });

    // Log successful update
    await logActivity({
      userId,
      action: 'UPDATE',
      resourceType: 'Student',
      resourceId: updatedResource.id,
      resourceName: updatedResource.name,
      description: `Updated student: ${updatedResource.name}`,
      oldValue: oldData,
      newValue: updatedResource,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(updatedResource);
  } catch (error) {
    await logActivityError({
      userId,
      action: 'UPDATE',
      resourceType: 'Student',
      resourceId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    }, error);

    return errorResponse('Failed to update student', 500);
  }
}

// ============================================================================
// PATTERN 3: DELETE OPERATION
// ============================================================================

/**
 * Example: User deletes a resource
 */
async function deleteResource(request: NextRequest, userId: string, resourceId: string) {
  try {
    // Get data before deletion
    const resourceToDelete = await prisma.student.findUnique({
      where: { id: resourceId }
    });

    if (!resourceToDelete) {
      return errorResponse('Resource not found', 404);
    }

    // Perform deletion
    await prisma.student.delete({
      where: { id: resourceId }
    });

    // Log successful deletion (save old data for audit trail)
    await logActivity({
      userId,
      action: 'DELETE',
      resourceType: 'Student',
      resourceId,
      resourceName: resourceToDelete.name,
      description: `Deleted student: ${resourceToDelete.name}`,
      oldValue: resourceToDelete,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse({ message: 'Deleted successfully' });
  } catch (error) {
    await logActivityError({
      userId,
      action: 'DELETE',
      resourceType: 'Student',
      resourceId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    }, error);

    return errorResponse('Failed to delete student', 500);
  }
}

// ============================================================================
// PATTERN 4: APPROVAL OPERATION
// ============================================================================

/**
 * Example: Wali-kelas approves grades
 */
async function approveGrades(request: NextRequest, userId: string, subject: string, grades: any[], approvalCount: number) {
  try {
    // ... approval logic ...

    // Log bulk approval activity
    await logBulkActivity(
      userId,
      'APPROVE',
      'Grades',
      `Approved grades for subject ${subject}`,
      grades.length,        // total items processed
      approvalCount,        // successfully approved
      getClientIp(request),
      getUserAgent(request)
    );

    return successResponse({ count: approvalCount });
  } catch (error) {
    await logActivityError({
      userId,
      action: 'APPROVE',
      resourceType: 'Grades',
      description: `Failed to approve grades for ${subject}`,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    }, error);

    return errorResponse('Failed to approve grades', 500);
  }
}

// ============================================================================
// PATTERN 5: BULK OPERATIONS (IMPORT/EXPORT)
// ============================================================================

/**
 * Example: Admin imports students from CSV
 */
async function importStudents(request: NextRequest, userId: string, file: any, successCount: number, totalRecords: number) {
  try {
    // ... import logic ...

    // Log bulk import operation
    await logBulkActivity(
      userId,
      'IMPORT',
      'Students',
      `Imported students from CSV file`,
      totalRecords,
      successCount,
      getClientIp(request),
      getUserAgent(request)
    );

    return successResponse({
      message: `Imported ${successCount} of ${totalRecords} students`,
      count: successCount,
      total: totalRecords,
    });
  } catch (error) {
    await logActivityError({
      userId,
      action: 'IMPORT',
      resourceType: 'Students',
      description: 'Failed to import students',
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    }, error);

    return errorResponse('Failed to import students', 500);
  }
}

// ============================================================================
// PATTERN 6: AUTHENTICATION OPERATIONS
// ============================================================================

/**
 * Example Login (already implemented in /api/auth/login/route.ts)
 */
// Successful login:
await logActivity({
  userId: user.id,
  action: 'LOGIN',
  resourceType: 'User',
  resourceId: user.id,
  resourceName: user.email,
  description: 'Successful login',
  ipAddress: getClientIp(request),
  userAgent: getUserAgent(request),
  status: 'SUCCESS',
});

// Failed login:
await logActivity({
  userId: 'SYSTEM', // or use actual userId if available
  action: 'LOGIN',
  resourceType: 'User',
  description: 'Failed login attempt',
  ipAddress: getClientIp(request),
  userAgent: getUserAgent(request),
  status: 'FAILED',
  errorMessage: 'Invalid credentials',
});

// ============================================================================
// IMPLEMENTATION CHECKLIST
// ============================================================================

/*
When adding activity logging to an endpoint, follow these steps:

1. [✓] Import logging functions at the top of the file:
   - logActivity
   - getClientIp
   - getUserAgent
   - logActivityError (for error cases)
   - logBulkActivity (for bulk operations)

2. [✓] Extract userId from authenticated user:
   const userId = user.id; // from withAuth or verifyAdmin

3. [✓] For each operation type, determine the:
   - action: CREATE | READ | UPDATE | DELETE | APPROVE | REJECT | LOGIN | LOGOUT | IMPORT | EXPORT | BULK_UPDATE | RESTORE
   - resourceType: Student | Grade | User | Class | etc.
   - resourceId: the ID of the resource being modified
   - resourceName: human-readable name for display
   - description: what happened in plain English

4. [✓] Capture context for update operations:
   - oldValue: The state before the update
   - newValue: The state after the update

5. [✓] Call logActivity() or logActivityError() at the appropriate place:
   - After successful operation (before returning 200/201)
   - In catch blocks for failures

6. [✓] For bulk operations, call logBulkActivity() with total and success counts

7. [✓] Always pass request object to get IP address and user-agent

8. [✓] Include ipAddress and userAgent in all logs:
   ipAddress: getClientIp(request),
   userAgent: getUserAgent(request),
*/

// ============================================================================
// IMPORTANT NOTES
// ============================================================================

/*
1. ASYNC/NO BLOCKING:
   - Activity logging uses `await` but should NOT block the main response
   - If logging fails, it logs an error but doesn't affect the API response
   - For bulk operations, consider using fire-and-forget pattern:
     
     (async () => {
       await logBulkActivity(...);
     })();
     
     return successResponse(...);

2. SENSITIVE DATA:
   - Be careful with passwords (don't log them)
   - For sensitive updates, log meaningful data, not raw objects
   - Example: Instead of logging entire user object, log just: { role, email, status }

3. PERFORMANCE:
   - Activity logging adds minimal overhead (<5ms per operation)
   - All logs are written to database
   - Logs are indexed on: userId, createdAt, action, resourceType for fast queries
   - Consider batch logging for very high-throughput operations

4. RETENTION:
   - All logs are retained indefinitely
   - Only admins can view activity logs
   - Consider adding a background job to archive old logs if data size becomes an issue

5. ACCESSING LOGS:
   - Admin Dashboard: /admin/activity-logs
   - API Endpoint: GET /api/admin/activity-logs
   - Supports filtering by: action, resourceType, userId, dateRange
*/
