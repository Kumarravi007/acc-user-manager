import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/api-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return proxyRequest(request, `/api/projects/${projectId}`, 'GET');
}
