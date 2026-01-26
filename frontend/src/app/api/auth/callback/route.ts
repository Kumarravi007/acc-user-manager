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
      redirect: 'manual', // Don't follow redirects, we need to capture cookies
    });

    console.log('[Callback] Backend status:', response.status);

    // Get the Set-Cookie header
    const setCookieHeader = response.headers.get('set-cookie');
    console.log('[Callback] Set-Cookie present:', !!setCookieHeader);

    // Determine redirect location from backend response
    const location = response.headers.get('location') || '/dashboard';
    console.log('[Callback] Location:', location);

    // Parse the redirect URL - extract just the path for our domain
    let redirectPath = '/dashboard';
    if (location.includes('/login?error=')) {
      try {
        const url = new URL(location);
        redirectPath = url.pathname + url.search;
      } catch {
        redirectPath = '/login?error=auth_failed';
      }
    }

    // Create response with redirect
    const redirectResponse = NextResponse.redirect(new URL(redirectPath, request.url));

    // Forward the session cookie from backend
    if (setCookieHeader) {
      // Extract connect.sid value using regex
      // Format: connect.sid=s%3A<id>.<sig>; Path=/; HttpOnly; ...
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
      } else {
        console.log('[Callback] Could not extract connect.sid from header');
      }
    } else {
      console.log('[Callback] No Set-Cookie header in response');
    }

    return redirectResponse;
  } catch (error) {
    console.error('[Callback] Error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}
