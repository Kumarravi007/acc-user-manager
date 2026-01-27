'use client';

import React, { useState, useMemo } from 'react';
import { Search, CheckSquare, Square, Users, Building2 } from 'lucide-react';
import { AccountMember } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Input from './ui/Input';
import Badge from './ui/Badge';
import { cn } from '@/lib/utils';

interface MemberSelectorProps {
  members: AccountMember[];
  selectedMembers: string[];
  onSelectionChange: (memberIds: string[]) => void;
  isLoading?: boolean;
  error?: Error | null;
  manualEmails?: string;
  onManualEmailsChange?: (emails: string) => void;
}

export default function MemberSelector({
  members,
  selectedMembers,
  onSelectionChange,
  isLoading = false,
  error = null,
  manualEmails = '',
  onManualEmailsChange,
}: MemberSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return members;

    const query = searchQuery.toLowerCase();
    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        (member.companyName?.toLowerCase().includes(query) ?? false)
    );
  }, [members, searchQuery]);

  const handleToggleMember = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      onSelectionChange(selectedMembers.filter((id) => id !== memberId));
    } else {
      onSelectionChange([...selectedMembers, memberId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === filteredMembers.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredMembers.map((m) => m.id));
    }
  };

  const allSelected =
    filteredMembers.length > 0 &&
    selectedMembers.length === filteredMembers.length;

  // Get selected member emails for display
  const selectedEmails = useMemo(() => {
    return members
      .filter((m) => selectedMembers.includes(m.id))
      .map((m) => m.email);
  }, [members, selectedMembers]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Members
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Choose members from your ACC account
            </p>
          </div>
          {selectedMembers.length > 0 && (
            <Badge variant="info">{selectedMembers.length} selected</Badge>
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
              placeholder="Search by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Select All */}
          {filteredMembers.length > 0 && (
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
                {filteredMembers.length} members
              </span>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading members...
              </div>
            ) : error ? (
              <div className="space-y-4">
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm text-amber-600 mb-2">
                    Unable to load account members. You may not have Account Admin access.
                  </p>
                  <p className="text-xs">
                    Enter email addresses manually below (one per line or comma-separated):
                  </p>
                </div>
                <textarea
                  value={manualEmails}
                  onChange={(e) => onManualEmailsChange?.(e.target.value)}
                  placeholder="user1@example.com&#10;user2@example.com"
                  className="w-full h-32 p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? 'No members found matching your search'
                  : 'No members available'}
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = selectedMembers.includes(member.id);

                return (
                  <div
                    key={member.id}
                    onClick={() => handleToggleMember(member.id)}
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
                      <div className="font-medium truncate">{member.name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {member.email}
                      </div>
                      {member.companyName && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {member.companyName}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected summary */}
          {selectedMembers.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">{selectedMembers.length}</span>{' '}
                member{selectedMembers.length !== 1 ? 's' : ''} selected
              </p>
              <div className="text-xs text-muted-foreground mt-1 max-h-20 overflow-y-auto">
                {selectedEmails.slice(0, 5).join(', ')}
                {selectedEmails.length > 5 && ` +${selectedEmails.length - 5} more`}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
