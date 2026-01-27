'use client';

import React, { useState, useMemo } from 'react';
import { Search, CheckSquare, Square } from 'lucide-react';
import { Project } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Input from './ui/Input';
import Badge from './ui/Badge';
import { cn } from '@/lib/utils';

// ACC (Autodesk Construction Cloud) Icon - Teal blue with building/cloud design
const ACCIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={cn('h-5 w-5', className)}
    aria-label="Autodesk Construction Cloud"
  >
    <rect width="24" height="24" rx="4" fill="#0696D7" />
    {/* Cloud shape */}
    <path
      d="M17.5 13.5C17.5 11.5 15.9 10 14 10C13.7 10 13.4 10.04 13.1 10.1C12.5 8.3 10.8 7 8.8 7C6.3 7 4.3 9 4.3 11.5C4.3 11.7 4.3 11.9 4.4 12.1C3.5 12.5 3 13.4 3 14.5C3 16 4.2 17 5.5 17H16.5C17.9 17 19 15.9 19 14.5C19 13.6 18.4 13.5 17.5 13.5Z"
      fill="white"
    />
  </svg>
);

// BIM 360 Icon - Orange with circular 360 design
const BIM360Icon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={cn('h-5 w-5', className)}
    aria-label="BIM 360"
  >
    <rect width="24" height="24" rx="4" fill="#FF6B00" />
    {/* Circular arrow representing 360 */}
    <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="2" fill="none" />
    <path
      d="M12 6V8M18 12H16M12 18V16M6 12H8"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="2" fill="white" />
  </svg>
);

// Get platform icon based on project type
const PlatformIcon = ({ platform }: { platform?: string }) => {
  if (!platform) return null;

  const platformLower = platform.toLowerCase();
  if (platformLower.includes('acc') || platformLower === 'autodesk.construction.cloud') {
    return <ACCIcon />;
  }
  if (platformLower.includes('bim') || platformLower.includes('360')) {
    return <BIM360Icon />;
  }
  // Default to ACC for unknown platforms
  return <ACCIcon />;
};

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjects: string[];
  onSelectionChange: (projectIds: string[]) => void;
  isLoading?: boolean;
}

export default function ProjectSelector({
  projects,
  selectedProjects,
  onSelectionChange,
  isLoading = false,
}: ProjectSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;

    const query = searchQuery.toLowerCase();
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  const handleToggleProject = (projectId: string) => {
    if (selectedProjects.includes(projectId)) {
      onSelectionChange(selectedProjects.filter((id) => id !== projectId));
    } else {
      onSelectionChange([...selectedProjects, projectId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedProjects.length === filteredProjects.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredProjects.map((p) => p.id));
    }
  };

  const allSelected =
    filteredProjects.length > 0 &&
    selectedProjects.length === filteredProjects.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Select Projects</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Choose projects to add users to
            </p>
          </div>
          {selectedProjects.length > 0 && (
            <Badge variant="info">
              {selectedProjects.length} selected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Select All */}
          {filteredProjects.length > 0 && (
            <div className="flex items-center justify-between border-b pb-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-muted-foreground">
                {filteredProjects.length} projects
              </span>
            </div>
          )}

          {/* Projects List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading projects...
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? 'No projects found matching your search'
                  : 'No projects available'}
              </div>
            ) : (
              filteredProjects.map((project) => {
                const isSelected = selectedProjects.includes(project.id);

                return (
                  <div
                    key={project.id}
                    onClick={() => handleToggleProject(project.id)}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary',
                      isSelected
                        ? 'bg-primary/5 border-primary'
                        : 'bg-background border-border'
                    )}
                  >
                    <div className="pt-0.5">
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <PlatformIcon platform={project.platform} />
                      <div className="font-medium truncate">
                        {project.name}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
