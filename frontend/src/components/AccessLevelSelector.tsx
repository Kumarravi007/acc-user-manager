'use client';

import React from 'react';
import { Shield, ShieldCheck } from 'lucide-react';
import { AccessLevel, AccessLevelOption } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { cn } from '@/lib/utils';

// ACC Access Level options
const ACCESS_LEVELS: AccessLevelOption[] = [
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Full project administration access including user management',
  },
  {
    value: 'user',
    label: 'Member',
    description: 'Standard project member access',
  },
];

interface AccessLevelSelectorProps {
  selectedLevel: AccessLevel;
  onLevelChange: (level: AccessLevel) => void;
}

export default function AccessLevelSelector({
  selectedLevel,
  onLevelChange,
}: AccessLevelSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Access Level
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Set the project access level for selected members
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {ACCESS_LEVELS.map((level) => {
            const isSelected = selectedLevel === level.value;
            const Icon = level.value === 'admin' ? ShieldCheck : Shield;

            return (
              <div
                key={level.value}
                onClick={() => onLevelChange(level.value)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary',
                  isSelected
                    ? 'bg-primary/5 border-primary'
                    : 'bg-background border-border'
                )}
              >
                <div className="pt-0.5">
                  <div
                    className={cn(
                      'h-4 w-4 rounded-full border-2 flex items-center justify-center',
                      isSelected
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground'
                    )}
                  >
                    {isSelected && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <span className="font-medium">{level.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {level.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
