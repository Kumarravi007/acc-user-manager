import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    // Get session cookie from request
    const sessionCookie = request.cookies.get('connect.sid');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (sessionCookie) {
      headers['Cookie'] = `connect.sid=${sessionCookie.value}`;
    }

    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}
