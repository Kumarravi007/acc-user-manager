import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    // Get session cookie from request
    const sessionCookie = request.cookies.get('connect.sid');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (sessionCookie) {
      headers['Cookie'] = `connect.sid=${sessionCookie.value}`;
    }

    const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: 'POST',
      headers,
    });

    const data = await response.json();

    // Clear the session cookie
    const jsonResponse = NextResponse.json(data);
    jsonResponse.cookies.delete('connect.sid');

    return jsonResponse;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
}
