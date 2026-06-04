'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ActivityAction, ActivityStatus } from '@prisma/client';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';

interface ActivityLog {
  id: string;
  userId: string;
  action: ActivityAction;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  description?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  status: ActivityStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    status: '',
    userId: '',
    startDate: '',
    endDate: '',
  });

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.action) queryParams.append('action', filters.action);
      if (filters.resourceType) queryParams.append('resourceType', filters.resourceType);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.userId) queryParams.append('userId', filters.userId);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const response = await apiFetch(`/api/admin/activity-logs?${queryParams}`);

      const data = await response.json();

      if (data.success) {
        setLogs(data.data);
        setPagination(data.pagination);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      devError('Failed to fetch activity logs:', error);
      alert('Failed to load activity logs');
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.limit, pagination.page]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  function getActionBadgeColor(action: ActivityAction) {
    const colors: Record<ActivityAction, string> = {
      CREATE: 'bg-green-100 text-green-800',
      READ: 'bg-blue-100 text-blue-800',
      UPDATE: 'bg-yellow-100 text-yellow-800',
      DELETE: 'bg-red-100 text-red-800',
      APPROVE: 'bg-purple-100 text-purple-800',
      REJECT: 'bg-orange-100 text-orange-800',
      LOGIN: 'bg-indigo-100 text-indigo-800',
      LOGOUT: 'bg-gray-100 text-gray-800',
      IMPORT: 'bg-cyan-100 text-cyan-800',
      EXPORT: 'bg-teal-100 text-teal-800',
      BULK_UPDATE: 'bg-amber-100 text-amber-800',
      RESTORE: 'bg-emerald-100 text-emerald-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  }

  function getStatusBadgeColor(status: ActivityStatus) {
    const colors: Record<ActivityStatus, string> = {
      SUCCESS: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      PARTIAL: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  function toggleRowExpand(id: string) {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  }

  function handleFilterChange(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  function parseJson(value?: string) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Activity Logs</h1>
        <p className="text-gray-900 mt-1 text-sm sm:text-base">Track all user activities in the system</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Action
            </label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Actions</option>
              {Object.values(ActivityAction).map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Resource Type
            </label>
            <input
              type="text"
              value={filters.resourceType}
              onChange={(e) => handleFilterChange('resourceType', e.target.value)}
              placeholder="e.g., Student, Grade"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="PARTIAL">Partial</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-900">
            Loading activity logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-900 flex items-center justify-center gap-2">
            <AlertCircle size={20} />
            No activity logs found
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">
                      IP Address
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">
                            {log.user.name}
                          </div>
                          <div className="text-xs text-gray-900">
                            {log.user.email}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">
                            {log.resourceType}
                          </div>
                          {log.resourceName && (
                            <div className="text-xs text-gray-900">
                              {log.resourceName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeColor(
                              log.status
                            )}`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {log.ipAddress || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(log.createdAt).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => toggleRowExpand(log.id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-900"
                            title="View details"
                          >
                            {expandedRows.has(log.id) ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                          </button>
                        </td>
                      </tr>

                      {expandedRows.has(log.id) && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="space-y-3">
                              {log.description && (
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-900 mb-1">
                                    Description
                                  </h4>
                                  <p className="text-sm text-gray-900">
                                    {log.description}
                                  </p>
                                </div>
                              )}

                              {log.userAgent && (
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-900 mb-1">
                                    User Agent
                                  </h4>
                                  <p className="text-xs text-gray-900 break-all">
                                    {log.userAgent}
                                  </p>
                                </div>
                              )}

                              {log.resourceId && (
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-900 mb-1">
                                    Resource ID
                                  </h4>
                                  <p className="text-sm font-mono text-gray-900">
                                    {log.resourceId}
                                  </p>
                                </div>
                              )}

                              {(log.oldValue || log.newValue) && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                  {log.oldValue && (
                                    <div>
                                      <h4 className="text-xs font-semibold text-gray-900 mb-1">
                                        Old Value
                                      </h4>
                                      <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-auto max-h-48 text-gray-900">
                                        {JSON.stringify(
                                          parseJson(log.oldValue),
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>
                                  )}
                                  {log.newValue && (
                                    <div>
                                      <h4 className="text-xs font-semibold text-gray-900 mb-1">
                                        New Value
                                      </h4>
                                      <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-auto max-h-48 text-gray-900">
                                        {JSON.stringify(
                                          parseJson(log.newValue),
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}

                              {log.errorMessage && (
                                <div>
                                  <h4 className="text-xs font-semibold text-red-700 mb-1">
                                    Error Message
                                  </h4>
                                  <p className="text-sm text-red-700">
                                    {log.errorMessage}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 p-3 sm:p-4">
              {logs.map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {log.user.name}
                      </div>
                      <div className="text-xs text-gray-900">
                        {log.user.email}
                      </div>
                    </div>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold w-fit ${getActionBadgeColor(
                        log.action
                      )}`}
                    >
                      {log.action}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                    <div>
                      <span className="text-gray-900 font-medium">{log.resourceType}</span>
                      {log.resourceName && (
                        <span className="text-gray-900 text-xs ml-2">({log.resourceName})</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold w-fit ${getStatusBadgeColor(
                        log.status
                      )}`}
                    >
                      {log.status}
                    </span>
                    <div className="text-gray-900">
                      <span className="font-medium">IP:</span> {log.ipAddress || '-'}
                    </div>
                    <div className="text-gray-900">
                      <span className="font-medium">Time:</span> {new Date(log.createdAt).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleRowExpand(log.id)}
                    className="w-full text-left py-2 px-2 hover:bg-gray-50 rounded transition-colors text-gray-900 font-medium text-sm"
                  >
                    {expandedRows.has(log.id) ? 'Hide Details' : 'Show Details'}
                  </button>

                  {expandedRows.has(log.id) && (
                    <div className="border-t border-gray-200 pt-3 space-y-3 text-sm">
                      {log.description && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-900 mb-1">
                            Description
                          </h4>
                          <p className="text-sm text-gray-900">
                            {log.description}
                          </p>
                        </div>
                      )}

                      {log.userAgent && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-900 mb-1">
                            User Agent
                          </h4>
                          <p className="text-xs text-gray-900 break-all">
                            {log.userAgent}
                          </p>
                        </div>
                      )}

                      {log.resourceId && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-900 mb-1">
                            Resource ID
                          </h4>
                          <p className="text-sm font-mono text-gray-900">
                            {log.resourceId}
                          </p>
                        </div>
                      )}

                      {(log.oldValue || log.newValue) && (
                        <div className="space-y-2">
                          {log.oldValue && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-900 mb-1">
                                Old Value
                              </h4>
                              <pre className="text-xs bg-gray-50 p-2 rounded border border-gray-200 overflow-auto max-h-48 text-gray-900">
                                {JSON.stringify(
                                  parseJson(log.oldValue),
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          )}
                          {log.newValue && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-900 mb-1">
                                New Value
                              </h4>
                              <pre className="text-xs bg-gray-50 p-2 rounded border border-gray-200 overflow-auto max-h-48 text-gray-900">
                                {JSON.stringify(
                                  parseJson(log.newValue),
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {log.errorMessage && (
                        <div>
                          <h4 className="text-xs font-semibold text-red-700 mb-1">
                            Error Message
                          </h4>
                          <p className="text-sm text-red-700">
                            {log.errorMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-gray-50 border-t border-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs sm:text-sm text-gray-900">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} logs
                </div>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <button
                    onClick={() =>
                      setPagination(prev => ({
                        ...prev,
                        page: Math.max(1, prev.page - 1),
                      }))
                    }
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded text-xs sm:text-sm font-medium text-gray-900 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-xs sm:text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPagination(prev => ({
                        ...prev,
                        page: Math.min(prev.totalPages, prev.page + 1),
                      }))
                    }
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded text-xs sm:text-sm font-medium text-gray-900 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>    </div>
  );
}