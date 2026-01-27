'use client';

import React, { useState, useMemo } from 'react';
import { Search, CheckSquare, Square } from 'lucide-react';
import { Project } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Input from './ui/Input';
import Badge from './ui/Badge';
import { cn } from '@/lib/utils';

// ACC (Autodesk Construction Cloud) Icon - Blue globe with network grid
const ACCIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={cn('h-5 w-5', className)}
    aria-label="Autodesk Construction Cloud"
  >
    {/* Blue globe with intersecting arcs */}
    <circle cx="12" cy="12" r="10" fill="#1858A8" />
    {/* Outer circle */}
    <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="1.2" fill="none" />
    {/* Horizontal arc */}
    <ellipse cx="12" cy="12" rx="7" ry="3" stroke="white" strokeWidth="1.2" fill="none" />
    {/* Vertical arc */}
    <ellipse cx="12" cy="12" rx="3" ry="7" stroke="white" strokeWidth="1.2" fill="none" />
    {/* Diagonal arcs for network effect */}
    <path d="M5.5 8.5C7.5 10 9.5 11 12 11C14.5 11 16.5 10 18.5 8.5" stroke="white" strokeWidth="1" fill="none" />
    <path d="M5.5 15.5C7.5 14 9.5 13 12 13C14.5 13 16.5 14 18.5 15.5" stroke="white" strokeWidth="1" fill="none" />
  </svg>
);

// BIM 360 Icon - Blue "B" letter
const BIM360Icon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={cn('h-5 w-5', className)}
    aria-label="BIM 360"
  >
    {/* Bold blue "B" */}
    <path
      d="M5 3h8c3.3 0 6 2 6 5 0 1.8-.9 3.3-2.3 4.2C18.2 13.1 19 14.8 19 16.5c0 3-2.7 5-6 5H5V3zm4 3v5h4c1.7 0 3-1.1 3-2.5S14.7 6 13 6H9zm0 8v5h4c1.7 0 3-1.1 3-2.5S14.7 14 13 14H9z"
      fill="#1858A8"
    />
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
