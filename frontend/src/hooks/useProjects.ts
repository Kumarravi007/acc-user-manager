import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useProjects() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
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

export function useAccountMembers() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['accountMembers'],
    queryFn: () => apiClient.getAccountMembers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    members: data?.members || [],
    isLoading,
    error,
    refetch,
  };
}

export function useAccountRoles() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['accountRoles'],
    queryFn: () => apiClient.getAccountRoles(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    roles: data?.roles || [],
    isLoading,
    error,
    refetch,
  };
}
