'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useJobHistory, useJobStatus } from '@/hooks/useBulkOperations';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import ExecutionStatus from '@/components/ExecutionStatus';
import { formatDate, getStatusColor } from '@/lib/utils';

export default function HistoryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(
    null
  );

  const { executions, isLoading, error, refetch } = useJobHistory(50, 0);
  const { jobExecution } = useJobStatus(selectedExecutionId, {
    enabled: !!selectedExecutionId,
    refetchInterval: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const handleViewDetails = (executionId: string) => {
    setSelectedExecutionId(executionId);
  };

  const handleBack = () => {
    if (selectedExecutionId) {
      setSelectedExecutionId(null);
    } else {
      router.push('/dashboard');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Execution History
              </h1>
              <p className="text-sm text-muted-foreground">
                View past bulk assignment operations
              </p>
            </div>
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {selectedExecutionId ? 'Back to List' : 'Back to Dashboard'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedExecutionId && jobExecution ? (
          <ExecutionStatus
            execution={jobExecution}
            onClose={() => setSelectedExecutionId(null)}
          />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Executions</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                  />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="text-center py-8 text-destructive">
                  Failed to load history. Please try again.
                </div>
              )}

              {isLoading ? (
                <div className="text-center py-12">
                  <Spinner size="lg" />
                  <p className="text-muted-foreground mt-4">
                    Loading execution history...
                  </p>
                </div>
              ) : executions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg mb-2">No execution history yet</p>
                  <p className="text-sm">
                    Execute your first bulk assignment to see history here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Started</th>
                        <th className="text-left p-3 font-medium">
                          Completed
                        </th>
                        <th className="text-left p-3 font-medium">
                          Total Projects
                        </th>
                        <th className="text-left p-3 font-medium">Success</th>
                        <th className="text-left p-3 font-medium">Failed</th>
                        <th className="text-left p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {executions.map((execution) => (
                        <tr
                          key={execution.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="p-3">
                            <Badge variant={getStatusColor(execution.status)}>
                              {execution.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {execution.startedAt
                              ? formatDate(execution.startedAt)
                              : 'Not started'}
                          </td>
                          <td className="p-3">
                            {execution.completedAt
                              ? formatDate(execution.completedAt)
                              : 'In progress'}
                          </td>
                          <td className="p-3">{execution.totalProjects}</td>
                          <td className="p-3">
                            <span className="text-green-600 font-medium">
                              {execution.successCount}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-red-600 font-medium">
                              {execution.failedCount}
                            </span>
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(execution.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
