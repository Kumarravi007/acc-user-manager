import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/api-proxy';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') || '20';
  const offset = searchParams.get('offset') || '0';

  return proxyRequest(
    request,
    `/api/bulk/history?limit=${limit}&offset=${offset}`,
    'GET'
  );
}
