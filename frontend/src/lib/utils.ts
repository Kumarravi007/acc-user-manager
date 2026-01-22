import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return 'N/A';

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateEmails(
  emails: string
): { valid: string[]; invalid: string[] } {
  const emailList = emails
    .split(/[\n,;]/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  const valid: string[] = [];
  const invalid: string[] = [];

  emailList.forEach((email) => {
    if (validateEmail(email)) {
      valid.push(email.toLowerCase());
    } else {
      invalid.push(email);
    }
  });

  // Remove duplicates
  const uniqueValid = [...new Set(valid)];

  return { valid: uniqueValid, invalid };
}

export function getStatusColor(
  status: string
): 'default' | 'success' | 'error' | 'warning' | 'info' {
  switch (status) {
    case 'completed':
    case 'success':
      return 'success';
    case 'failed':
    case 'error':
      return 'error';
    case 'processing':
    case 'pending':
      return 'info';
    case 'partial_success':
    case 'skipped':
      return 'warning';
    default:
      return 'default';
  }
}

export function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
    case 'success':
      return '✓';
    case 'failed':
    case 'error':
      return '✗';
    case 'processing':
      return '⟳';
    case 'pending':
      return '○';
    case 'partial_success':
      return '!';
    case 'skipped':
      return '−';
    default:
      return '?';
  }
}

export function downloadCSV(data: any[], filename: string): void {
  if (data.length === 0) return;

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        // Escape commas and quotes
        if (
          typeof value === 'string' &&
          (value.includes(',') || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural || singular + 's'}`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
