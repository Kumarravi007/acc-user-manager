'use client';

import React from 'react';
import { UserCog } from 'lucide-react';
import { Role } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { cn } from '@/lib/utils';

interface RoleSelectorProps {
  roles: Role[];
  selectedRole: string;
  onRoleChange: (roleId: string) => void;
  isLoading?: boolean;
  error?: string;
}

export default function RoleSelector({
  roles,
  selectedRole,
  onRoleChange,
  isLoading = false,
  error,
}: RoleSelectorProps) {
  // Common ACC roles if API doesn't return roles
  const defaultRoles: Role[] = [
    {
      id: 'project_admin',
      name: 'Project Administrator',
      description: 'Full access to project administration',
    },
    {
      id: 'executive',
      name: 'Executive',
      description: 'View-only access to project',
    },
    {
      id: 'project_user',
      name: 'Project User',
      description: 'Standard project member',
    },
  ];

  const availableRoles = roles.length > 0 ? roles : defaultRoles;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          Assign Role
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select the role to assign to users
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 text-sm text-destructive">{error}</div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading roles...
          </div>
        ) : (
          <div className="space-y-2">
            {availableRoles.map((role) => {
              const isSelected = selectedRole === role.id;

              return (
                <div
                  key={role.id}
                  onClick={() => onRoleChange(role.id)}
                  className={cn(
                    'p-4 rounded-lg border cursor-pointer transition-all hover:border-primary',
                    isSelected
                      ? 'bg-primary/5 border-primary ring-2 ring-primary/20'
                      : 'bg-background border-border'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      )}
                    >
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{role.name}</div>
                      {role.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {role.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && availableRoles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No roles available. Please select a project first.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
