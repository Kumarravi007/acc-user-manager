import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/api-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params;
  return proxyRequest(request, `/api/bulk/status/${executionId}`, 'GET');
}
