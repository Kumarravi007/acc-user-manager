import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import {
  PreviewRequest,
  BulkAssignmentRequest,
  JobExecution,
} from '@/types';

export function useBulkPreview() {
  const mutation = useMutation({
    mutationFn: (data: PreviewRequest) => apiClient.previewBulkAssignment(data),
  });

  return {
    preview: mutation.mutate,
    previewAsync: mutation.mutateAsync,
    data: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export function useBulkAssignment() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: BulkAssignmentRequest) =>
      apiClient.executeBulkAssignment(data),
    onSuccess: () => {
      // Invalidate job history
      queryClient.invalidateQueries({ queryKey: ['jobHistory'] });
    },
  });

  return {
    execute: mutation.mutate,
    executeAsync: mutation.mutateAsync,
    data: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export function useJobStatus(
  executionId: string | null,
  options?: {
    refetchInterval?: number;
    enabled?: boolean;
  }
) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['jobStatus', executionId],
    queryFn: () => apiClient.getJobStatus(executionId!),
    enabled: !!executionId && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const data = query.state.data as JobExecution | undefined;
      // Stop polling if job is complete
      if (
        data?.status === 'completed' ||
        data?.status === 'failed' ||
        data?.status === 'partial_success' ||
        data?.status === 'cancelled'
      ) {
        return false;
      }
      return options?.refetchInterval ?? 2000; // Poll every 2 seconds
    },
  });

  return {
    jobExecution: data || null,
    isLoading,
    error,
    refetch,
  };
}

export function useJobHistory(limit = 20, offset = 0) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['jobHistory', limit, offset],
    queryFn: () => apiClient.getJobHistory(limit, offset),
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  return {
    executions: data?.executions || [],
    pagination: data?.pagination,
    isLoading,
    error,
    refetch,
  };
}
