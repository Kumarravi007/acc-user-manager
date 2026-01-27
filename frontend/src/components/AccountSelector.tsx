'use client';

import React from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { Account } from '@/types';

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onAccountChange: (accountId: string) => void;
  isLoading?: boolean;
}

export default function AccountSelector({
  accounts,
  selectedAccountId,
  onAccountChange,
  isLoading = false,
}: AccountSelectorProps) {
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="bg-white border-b px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>ACC Account:</span>
        </div>
        <div className="relative">
          <select
            value={selectedAccountId || ''}
            onChange={(e) => onAccountChange(e.target.value)}
            disabled={isLoading || accounts.length === 0}
            className="appearance-none bg-white border rounded-lg px-4 py-2 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed min-w-[250px]"
          >
            {isLoading ? (
              <option value="">Loading accounts...</option>
            ) : accounts.length === 0 ? (
              <option value="">No accounts available</option>
            ) : (
              <>
                <option value="" disabled>
                  Select an account
                </option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.region})
                  </option>
                ))}
              </>
            )}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        {selectedAccount && (
          <span className="text-xs text-muted-foreground">
            ID: {selectedAccount.id.substring(0, 8)}...
          </span>
        )}
      </div>
    </div>
  );
}
