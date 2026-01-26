import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=missing_params', request.url));
  }

  try {
    // Forward the callback to the backend
    const backendUrl = `${BACKEND_URL}/api/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      redirect: 'manual', // Don't follow redirects, we need to capture cookies
    });

    // Get cookies from backend response
    const setCookieHeader = response.headers.get('set-cookie');

    // Determine redirect location from backend response
    const location = response.headers.get('location') || '/dashboard';

    // Parse the redirect URL - extract just the path
    let redirectPath = '/dashboard';
    if (location.includes('/login?error=')) {
      // Error case - extract the error path
      const url = new URL(location);
      redirectPath = url.pathname + url.search;
    }

    // Create response with redirect
    const redirectResponse = NextResponse.redirect(new URL(redirectPath, request.url));

    // Forward the session cookie from backend
    if (setCookieHeader) {
      // The set-cookie header may contain multiple cookies separated by comma
      // But connect.sid cookie values contain encoded data that might have commas
      // So we need to be careful when parsing
      const cookieStrings = setCookieHeader.split(/,(?=\s*connect\.sid=|\s*[^;,]+=)/);

      for (const cookieStr of cookieStrings) {
        // Parse cookie string
        const parts = cookieStr.trim().split(';');
        const [nameValue] = parts;
        const eqIndex = nameValue.indexOf('=');

        if (eqIndex > 0) {
          const name = nameValue.substring(0, eqIndex).trim();
          const value = nameValue.substring(eqIndex + 1).trim();

          if (name === 'connect.sid' && value) {
            // Set the session cookie on our domain
            redirectResponse.cookies.set('connect.sid', value, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: 86400, // 24 hours
            });
          }
        }
      }
    }

    return redirectResponse;
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}
