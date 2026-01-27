import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useAccounts() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.getAccounts(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    accounts: data?.accounts || [],
    isLoading,
    error,
    refetch,
  };
}

export function useProjects(accountId: string | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects', accountId],
    queryFn: () => apiClient.getProjects(accountId || undefined),
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    projects: data?.projects || [],
    isLoading,
    error,
    refetch,
  };
}

export function useProject(projectId: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiClient.getProject(projectId!),
    enabled: !!projectId,
  });

  return {
    project: data?.project || null,
    isLoading,
    error,
  };
}

export function useProjectRoles(projectId: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projectRoles', projectId],
    queryFn: () => apiClient.getProjectRoles(projectId!),
    enabled: !!projectId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    roles: data?.roles || [],
    isLoading,
    error,
  };
}

export function useAccountMembers(accountId: string | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['accountMembers', accountId],
    queryFn: () => apiClient.getAccountMembers(accountId || undefined),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    members: data?.members || [],
    isLoading,
    error,
    refetch,
  };
}

export function useAccountRoles(accountId: string | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['accountRoles', accountId],
    queryFn: () => apiClient.getAccountRoles(accountId || undefined),
    enabled: !!accountId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    roles: data?.roles || [],
    isLoading,
    error,
    refetch,
  };
}
