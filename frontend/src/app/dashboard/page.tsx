'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, History, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProjects, useAccountMembers, useAccountRoles } from '@/hooks/useProjects';
import {
  useBulkPreview,
  useBulkAssignment,
  useJobStatus,
} from '@/hooks/useBulkOperations';
import Button from '@/components/ui/Button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import ProjectSelector from '@/components/ProjectSelector';
import MemberSelector from '@/components/MemberSelector';
import RoleSelector from '@/components/RoleSelector';
import AccessLevelSelector from '@/components/AccessLevelSelector';
import PreviewResults from '@/components/PreviewResults';
import ExecutionStatus from '@/components/ExecutionStatus';
import type { BulkAssignmentFormData, AccessLevel } from '@/types';

type Step = 'form' | 'preview' | 'executing';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { projects, isLoading: projectsLoading, error: projectsError } =
    useProjects();
  const { members, isLoading: membersLoading, error: membersError } =
    useAccountMembers();

  const [step, setStep] = useState<Step>('form');
  const [formData, setFormData] = useState<BulkAssignmentFormData>({
    selectedProjects: [],
    userEmails: '',
    selectedMembers: [],
    selectedRole: '',
    accessLevel: 'user',
  });
  const [executionId, setExecutionId] = useState<string | null>(null);

  const { roles, isLoading: rolesLoading } = useAccountRoles();

  const {
    preview: previewMutation,
    data: previewData,
    isLoading: isPreviewLoading,
    error: previewError,
    reset: resetPreview,
  } = useBulkPreview();

  const {
    executeAsync: executeMutation,
    isLoading: isExecuting,
    error: executeError,
  } = useBulkAssignment();

  const { jobExecution, refetch: refetchJob } = useJobStatus(executionId);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Get selected member emails for API calls
  const selectedMemberEmails = useMemo(() => {
    return members
      .filter((m) => formData.selectedMembers.includes(m.id))
      .map((m) => m.email);
  }, [members, formData.selectedMembers]);

  const handlePreview = async () => {
    if (formData.selectedProjects.length === 0) {
      alert('Please select at least one project');
      return;
    }

    if (formData.selectedMembers.length === 0) {
      alert('Please select at least one member');
      return;
    }

    if (!formData.selectedRole) {
      alert('Please select a role');
      return;
    }

    try {
      await previewMutation({
        userEmails: selectedMemberEmails,
        projectIds: formData.selectedProjects,
      });
      setStep('preview');
    } catch (error) {
      console.error('Preview failed:', error);
    }
  };

  const handleConfirmExecution = async () => {
    try {
      const response = await executeMutation({
        userEmails: selectedMemberEmails,
        projectIds: formData.selectedProjects,
        role: formData.selectedRole,
      });

      setExecutionId(response.executionId);
      setStep('executing');
    } catch (error) {
      console.error('Execution failed:', error);
    }
  };

  const handleCancelPreview = () => {
    resetPreview();
    setStep('form');
  };

  const handleReset = () => {
    setStep('form');
    setExecutionId(null);
    setFormData({
      selectedProjects: [],
      userEmails: '',
      selectedMembers: [],
      selectedRole: '',
      accessLevel: 'user',
    });
    resetPreview();
  };

  const handleViewHistory = () => {
    router.push('/history');
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
                ACC User Manager
              </h1>
              <p className="text-sm text-muted-foreground">
                Signed in as {user.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewHistory}
              >
                <History className="h-4 w-4 mr-2" />
                History
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alerts */}
        {projectsError && (
          <Alert variant="error" className="mb-6">
            <AlertTitle>Failed to load projects</AlertTitle>
            <AlertDescription>
              {projectsError.message || 'Please try again later'}
            </AlertDescription>
          </Alert>
        )}

        {membersError && (
          <Alert variant="error" className="mb-6">
            <AlertTitle>Failed to load members</AlertTitle>
            <AlertDescription>
              {membersError.message || 'Please try again later'}
            </AlertDescription>
          </Alert>
        )}

        {previewError && (
          <Alert variant="error" className="mb-6">
            <AlertTitle>Preview Failed</AlertTitle>
            <AlertDescription>
              {(previewError as any)?.message || 'Please try again'}
            </AlertDescription>
          </Alert>
        )}

        {executeError && (
          <Alert variant="error" className="mb-6">
            <AlertTitle>Execution Failed</AlertTitle>
            <AlertDescription>
              {(executeError as any)?.message || 'Please try again'}
            </AlertDescription>
          </Alert>
        )}

        {/* Step: Form */}
        {step === 'form' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Add Members to Projects
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Select projects, choose members, assign a role and access level
                </p>
              </div>
              <Button
                variant="primary"
                onClick={handlePreview}
                disabled={
                  formData.selectedProjects.length === 0 ||
                  formData.selectedMembers.length === 0 ||
                  !formData.selectedRole ||
                  isPreviewLoading
                }
                isLoading={isPreviewLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Preview Assignment
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                <ProjectSelector
                  projects={projects}
                  selectedProjects={formData.selectedProjects}
                  onSelectionChange={(selected) =>
                    setFormData({ ...formData, selectedProjects: selected })
                  }
                  isLoading={projectsLoading}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <MemberSelector
                  members={members}
                  selectedMembers={formData.selectedMembers}
                  onSelectionChange={(selected) =>
                    setFormData({ ...formData, selectedMembers: selected })
                  }
                  isLoading={membersLoading}
                />

                <RoleSelector
                  roles={roles}
                  selectedRole={formData.selectedRole}
                  onRoleChange={(roleId) =>
                    setFormData({ ...formData, selectedRole: roleId })
                  }
                  isLoading={rolesLoading}
                />

                <AccessLevelSelector
                  selectedLevel={formData.accessLevel}
                  onLevelChange={(level) =>
                    setFormData({ ...formData, accessLevel: level })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && previewData && (
          <div>
            <div className="mb-6">
              <Button variant="outline" onClick={handleCancelPreview}>
                ← Back to Form
              </Button>
            </div>
            <PreviewResults
              results={previewData.preview}
              summary={previewData.summary}
              onConfirm={handleConfirmExecution}
              onCancel={handleCancelPreview}
              isExecuting={isExecuting}
            />
          </div>
        )}

        {/* Step: Executing */}
        {step === 'executing' && jobExecution && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Execution in Progress</h2>
              <Button variant="outline" onClick={handleReset}>
                New Assignment
              </Button>
            </div>
            <ExecutionStatus
              execution={jobExecution}
              onRefresh={refetchJob}
              onClose={handleReset}
            />
          </div>
        )}
      </main>
    </div>
  );
}
