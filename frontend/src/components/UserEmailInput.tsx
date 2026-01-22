'use client';

import React from 'react';
import { Mail, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Textarea from './ui/Textarea';
import { Alert, AlertDescription } from './ui/Alert';
import { validateEmails } from '@/lib/utils';

interface UserEmailInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function UserEmailInput({
  value,
  onChange,
  error,
}: UserEmailInputProps) {
  const { valid, invalid } = validateEmails(value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          User Emails
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter one or more email addresses (comma or newline separated)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          error={error}
        />

        {/* Email counts */}
        {value.trim() && (
          <div className="space-y-2">
            {valid.length > 0 && (
              <div className="text-sm text-muted-foreground">
                ✓ {valid.length} valid email{valid.length !== 1 ? 's' : ''}
              </div>
            )}

            {invalid.length > 0 && (
              <Alert variant="warning">
                <AlertDescription>
                  <div className="font-medium mb-1">
                    {invalid.length} invalid email{invalid.length !== 1 ? 's' : ''}:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {invalid.slice(0, 5).map((email, index) => (
                      <li key={index} className="text-xs">
                        {email}
                      </li>
                    ))}
                    {invalid.length > 5 && (
                      <li className="text-xs">
                        ...and {invalid.length - 5} more
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Separate multiple emails with commas or new lines</p>
          <p>• Duplicate emails will be automatically removed</p>
          <p>• Email validation is case-insensitive</p>
        </div>
      </CardContent>
    </Card>
  );
}
