import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  console.log('[Callback] Starting OAuth callback');
  console.log('[Callback] BACKEND_URL:', BACKEND_URL);

  if (!code || !state) {
    console.log('[Callback] Missing code or state');
    return NextResponse.redirect(new URL('/login?error=missing_params', request.url));
  }

  try {
    // Forward the callback to the backend
    const backendUrl = `${BACKEND_URL}/api/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    console.log('[Callback] Forwarding to:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('[Callback] Backend status:', response.status);

    // Get the Set-Cookie header
    const setCookieHeader = response.headers.get('set-cookie');
    console.log('[Callback] Set-Cookie present:', !!setCookieHeader);
    if (setCookieHeader) {
      console.log('[Callback] Set-Cookie value (first 100 chars):', setCookieHeader.substring(0, 100));
    }

    // Parse the JSON response
    const data = await response.json();
    console.log('[Callback] Response data:', JSON.stringify(data));

    if (!response.ok || !data.success) {
      const error = data.error || 'auth_failed';
      console.log('[Callback] Auth failed:', error);
      return NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
    }

    // Create redirect response to dashboard
    const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url));

    // Forward the session cookie from backend
    if (setCookieHeader) {
      // Extract connect.sid value using regex
      const match = setCookieHeader.match(/connect\.sid=([^;]+)/);

      if (match && match[1]) {
        const cookieValue = match[1];
        console.log('[Callback] Setting cookie, value length:', cookieValue.length);

        redirectResponse.cookies.set('connect.sid', cookieValue, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 86400, // 24 hours
        });
        console.log('[Callback] Cookie set successfully');
      } else {
        console.log('[Callback] Could not extract connect.sid from Set-Cookie header');
      }
    } else {
      console.log('[Callback] WARNING: No Set-Cookie header from backend!');
    }

    return redirectResponse;
  } catch (error) {
    console.error('[Callback] Error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}
