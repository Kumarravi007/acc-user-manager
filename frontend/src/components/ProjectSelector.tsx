'use client';

import React, { useState, useMemo } from 'react';
import { Search, CheckSquare, Square } from 'lucide-react';
import { Project } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Input from './ui/Input';
import Badge from './ui/Badge';
import { cn } from '@/lib/utils';

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
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.id.toLowerCase().includes(query)
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
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {project.name}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span className="truncate">{project.id}</span>
                        {project.platform && (
                          <Badge variant="secondary" className="text-xs">
                            {project.platform}
                          </Badge>
                        )}
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
