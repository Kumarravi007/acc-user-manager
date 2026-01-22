'use client';

import React, { useState } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
} from 'lucide-react';
import { JobExecution, JobResult } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Progress from './ui/Progress';
import Badge from './ui/Badge';
import Button from './ui/Button';
import {
  formatDate,
  formatDuration,
  getStatusColor,
  downloadCSV,
} from '@/lib/utils';

interface ExecutionStatusProps {
  execution: JobExecution;
  onRefresh?: () => void;
  onClose?: () => void;
}

export default function ExecutionStatus({
  execution,
  onRefresh,
  onClose,
}: ExecutionStatusProps) {
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'success' | 'failed' | 'skipped'
  >('all');

  const isComplete =
    execution.status === 'completed' ||
    execution.status === 'failed' ||
    execution.status === 'partial_success' ||
    execution.status === 'cancelled';

  const filteredResults = execution.results.filter((result) => {
    if (filterStatus === 'all') return true;
    return result.status === filterStatus;
  });

  const handleDownloadResults = () => {
    const csvData = execution.results.map((r) => ({
      Project: r.projectName || r.projectId,
      User: r.userEmail,
      Status: r.status,
      'Previous Role': r.previousRole || 'N/A',
      'Assigned Role': r.assignedRole || 'N/A',
      Action: r.actionTaken || 'N/A',
      Error: r.errorMessage || 'N/A',
      'Completed At': r.completedAt
        ? formatDate(r.completedAt)
        : 'Not completed',
    }));

    downloadCSV(csvData, `execution-${execution.id}.csv`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getProgressVariant = (): 'default' | 'success' | 'warning' | 'error' => {
    if (!isComplete) return 'default';
    if (execution.status === 'completed') return 'success';
    if (execution.status === 'failed') return 'error';
    if (execution.status === 'partial_success') return 'warning';
    return 'default';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Execution Status
              <Badge variant={getStatusColor(execution.status)}>
                {execution.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              ID: {execution.id.substring(0, 8)}...
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && !isComplete && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            {isComplete && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadResults}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {execution.progress.completed} / {execution.progress.total}
            </span>
          </div>
          <Progress
            value={execution.progress.percentage}
            max={100}
            variant={getProgressVariant()}
          />
          <div className="text-xs text-muted-foreground text-right">
            {execution.progress.percentage}% complete
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted rounded-lg p-3">
            <div className="text-2xl font-bold">{execution.progress.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-900">
              {execution.progress.success}
            </div>
            <div className="text-xs text-green-700">Success</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-red-900">
              {execution.progress.failed}
            </div>
            <div className="text-xs text-red-700">Failed</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-900">
              {execution.progress.completed}
            </div>
            <div className="text-xs text-blue-700">Completed</div>
          </div>
        </div>

        {/* Timing Info */}
        <div className="space-y-2 text-sm">
          {execution.startedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Started:</span>
              <span>{formatDate(execution.startedAt)}</span>
            </div>
          )}
          {execution.completedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed:</span>
              <span>{formatDate(execution.completedAt)}</span>
            </div>
          )}
          {!isComplete && execution.estimatedTimeRemaining && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Est. Remaining:</span>
              <span>{formatDuration(execution.estimatedTimeRemaining)}</span>
            </div>
          )}
        </div>

        {/* Filters */}
        {execution.results.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-4 border-t">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'all', label: 'All' },
                  {
                    value: 'success',
                    label: `Success (${
                      execution.results.filter((r) => r.status === 'success')
                        .length
                    })`,
                  },
                  {
                    value: 'failed',
                    label: `Failed (${
                      execution.results.filter((r) => r.status === 'failed')
                        .length
                    })`,
                  },
                  {
                    value: 'skipped',
                    label: `Skipped (${
                      execution.results.filter((r) => r.status === 'skipped')
                        .length
                    })`,
                  },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setFilterStatus(filter.value as any)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      filterStatus === filter.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Project</th>
                      <th className="text-left p-3 font-medium">User</th>
                      <th className="text-left p-3 font-medium">Action</th>
                      <th className="text-left p-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredResults.map((result) => (
                      <tr
                        key={result.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <span className="capitalize">{result.status}</span>
                          </div>
                        </td>
                        <td className="p-3">{result.projectName}</td>
                        <td className="p-3">{result.userEmail}</td>
                        <td className="p-3">
                          {result.actionTaken ? (
                            <Badge
                              variant={
                                result.actionTaken === 'added'
                                  ? 'success'
                                  : result.actionTaken === 'updated'
                                  ? 'warning'
                                  : 'secondary'
                              }
                              className="text-xs"
                            >
                              {result.actionTaken}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {result.errorMessage ? (
                            <span className="text-xs text-red-600">
                              {result.errorMessage}
                            </span>
                          ) : result.assignedRole ? (
                            <span className="text-xs text-muted-foreground">
                              Role: {result.assignedRole}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Close button when complete */}
        {isComplete && onClose && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose}>Close</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
