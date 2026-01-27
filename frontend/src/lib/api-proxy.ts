import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function proxyRequest(
  request: NextRequest,
  path: string,
  method: string = 'GET'
): Promise<NextResponse> {
  try {
    // Get session cookie from request
    const sessionCookie = request.cookies.get('connect.sid');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (sessionCookie) {
      headers['Cookie'] = `connect.sid=${sessionCookie.value}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Include body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // No body or invalid JSON
      }
    }

    // Preserve query parameters from the original request
    const url = new URL(request.url);
    const queryString = url.search; // includes the leading '?' if present
    const fullPath = `${BACKEND_URL}${path}${queryString}`;

    const response = await fetch(fullPath, fetchOptions);

    // Get response data
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Create response
    const nextResponse = typeof data === 'string'
      ? new NextResponse(data, { status: response.status })
      : NextResponse.json(data, { status: response.status });

    return nextResponse;
  } catch (error) {
    console.error(`Proxy error for ${path}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
