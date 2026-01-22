'use client';

import React, { useState } from 'react';
import { Eye, Download, AlertCircle } from 'lucide-react';
import { PreviewResult, PreviewSummary } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { downloadCSV } from '@/lib/utils';

interface PreviewResultsProps {
  results: PreviewResult[];
  summary: PreviewSummary;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
}

export default function PreviewResults({
  results,
  summary,
  onConfirm,
  onCancel,
  isExecuting = false,
}: PreviewResultsProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'update'>(
    'all'
  );

  const filteredResults = results.filter((result) => {
    if (filterStatus === 'new') return result.willBeAdded;
    if (filterStatus === 'update') return result.willBeUpdated;
    return true;
  });

  const handleDownloadCSV = () => {
    const csvData = results.map((r) => ({
      User: r.userEmail,
      Project: r.projectName,
      'Current Access': r.currentAccess.hasAccess ? 'Yes' : 'No',
      'Current Role': r.currentAccess.currentRole || 'N/A',
      Action: r.willBeAdded ? 'Add New' : 'Update',
    }));

    downloadCSV(csvData, 'preview-results.csv');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview Results
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Review changes before executing
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCSV}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-900">
              {summary.totalOperations}
            </div>
            <div className="text-sm text-blue-700">Total Operations</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-900">
              {summary.newUsers}
            </div>
            <div className="text-sm text-green-700">New Users</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-900">
              {summary.updates}
            </div>
            <div className="text-sm text-yellow-700">Role Updates</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'All' },
              { value: 'new', label: 'New Users' },
              { value: 'update', label: 'Updates' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterStatus(filter.value as any)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
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
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium">Project</th>
                  <th className="text-left p-3 font-medium">Current Access</th>
                  <th className="text-left p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredResults.map((result, index) => (
                  <tr
                    key={index}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="p-3">{result.userEmail}</td>
                    <td className="p-3">{result.projectName}</td>
                    <td className="p-3">
                      {result.currentAccess.hasAccess ? (
                        <div className="space-y-1">
                          <Badge variant="info" className="text-xs">
                            Has Access
                          </Badge>
                          {result.currentAccess.currentRole && (
                            <div className="text-xs text-muted-foreground">
                              Role: {result.currentAccess.currentRole}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          No Access
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {result.willBeAdded ? (
                        <Badge variant="success" className="text-xs">
                          Add New User
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="text-xs">
                          Update Role
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Warning */}
        {summary.updates > 0 && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-900">
              <strong>Note:</strong> {summary.updates} user
              {summary.updates !== 1 ? 's' : ''} will have their role updated.
              Existing permissions will be modified.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isExecuting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            isLoading={isExecuting}
          >
            Confirm & Execute
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
