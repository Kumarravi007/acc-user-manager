'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import apiClient from '@/lib/api-client';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  const error = searchParams.get('error');

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async () => {
    try {
      const { authUrl } = await apiClient.initiateLogin();
      window.location.href = authUrl;
    } catch (err) {
      console.error('Failed to initiate login:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            ACC User Manager
          </h1>
          <p className="text-gray-600 mt-2">
            Manage users across multiple ACC projects
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error === 'auth_failed' && (
              <Alert variant="error">
                <AlertTitle>Authentication Failed</AlertTitle>
                <AlertDescription>
                  Unable to complete authentication. Please try again.
                </AlertDescription>
              </Alert>
            )}

            {error === 'invalid_state' && (
              <Alert variant="error">
                <AlertTitle>Session Expired</AlertTitle>
                <AlertDescription>
                  Your login session expired. Please try again.
                </AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-muted-foreground">
              Sign in with your Autodesk account to access the ACC Multi-Project
              User Manager.
            </p>

            <Button
              variant="primary"
              className="w-full"
              size="lg"
              onClick={handleLogin}
            >
              Sign in with Autodesk
            </Button>

            <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
              <p>
                <strong>Note:</strong> You must be an ACC Account Administrator
                to use this application.
              </p>
              <p>
                Your credentials are never stored. Authentication is handled
                securely by Autodesk Platform Services.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-gray-600">
          <p>
            &copy; {new Date().getFullYear()} ACC Multi-Project User Manager
          </p>
          <p className="mt-1">Built with Autodesk Platform Services</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
