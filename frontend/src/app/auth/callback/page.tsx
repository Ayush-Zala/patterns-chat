'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const provider = searchParams.get('provider') || 'google';
    const state = searchParams.get('state');
    const oauthMode = typeof window !== 'undefined' ? localStorage.getItem('teamflow_oauth_mode') : null;

    if (!code) {
      setErrorMsg('No authorization code was provided by the authentication provider.');
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // MODE 1: CONNECT MAIL ACCOUNT ONLY (NO User Signup / Login)
    // ─────────────────────────────────────────────────────────────
    if (state === 'connect_mail' || oauthMode === 'connect_mail') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('teamflow_oauth_mode');
      }
      const existingToken = typeof window !== 'undefined' ? localStorage.getItem('teamflow_token') : null;

      async function connectMailAccountOnly() {
        try {
          const res = await fetch(`${API_URL}/mail/auth/${provider}/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(existingToken ? { Authorization: `Bearer ${existingToken}` } : {}),
            },
            body: JSON.stringify({
              code,
              redirectUri: `${window.location.origin}/auth/callback?provider=${provider}`,
            }),
          });

          const data = await res.json();

          if (res.ok) {
            // Note: DO NOT touch teamflow_token or teamflow_user!
            // The active user stays logged in as themselves.
            const returnUrl = localStorage.getItem('teamflow_oauth_return_tab');
            if (returnUrl) {
              localStorage.removeItem('teamflow_oauth_return_tab');
              window.location.href = returnUrl;
            } else {
              window.location.href = '/workspaces';
            }
          } else {
            setErrorMsg(data.message || 'Failed to connect email account.');
          }
        } catch (err) {
          setErrorMsg('Network error while connecting email account. Please ensure backend is running.');
        }
      }

      connectMailAccountOnly();
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // MODE 2: USER AUTHENTICATION (Login or Sign Up with Google/Microsoft)
    // ─────────────────────────────────────────────────────────────
    async function exchangeOAuthCode() {
      try {
        const res = await fetch(`${API_URL}/auth/oauth/${provider}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const data = await res.json();

        if (res.ok && data.accessToken) {
          localStorage.setItem('teamflow_token', data.accessToken);
          localStorage.setItem('teamflow_user', JSON.stringify(data.user));

          const returnUrl = localStorage.getItem('teamflow_oauth_return_tab');
          if (returnUrl) {
            localStorage.removeItem('teamflow_oauth_return_tab');
            window.location.href = returnUrl;
          } else {
            window.location.href = '/workspaces';
          }
        } else {
          setErrorMsg(data.message || 'Authentication failed. Please try again.');
        }
      } catch (err) {
        setErrorMsg('Network error while verifying OAuth callback. Please ensure backend is running.');
      }
    }

    exchangeOAuthCode();
  }, [searchParams, router]);

  const isConnectMail =
    searchParams.get('state') === 'connect_mail' ||
    (typeof window !== 'undefined' && localStorage.getItem('teamflow_oauth_mode') === 'connect_mail');

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F8FAFC]">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {isConnectMail ? 'Failed to Connect Email' : 'Authentication Failed'}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">{errorMsg}</p>
          <button
            type="button"
            onClick={() => {
              if (isConnectMail) {
                const returnUrl = localStorage.getItem('teamflow_oauth_return_tab') || '/workspaces';
                router.push(returnUrl);
              } else {
                router.push('/login');
              }
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-200"
          >
            {isConnectMail ? 'Return to Workspace' : 'Back to Sign In'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F8FAFC]">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      <p className="text-sm font-semibold text-slate-600">
        {isConnectMail ? 'Connecting your email account...' : 'Completing sign in...'}
      </p>
      <p className="text-xs text-slate-400">
        {isConnectMail ? 'Linking mailbox to your workspace profile' : 'Setting up your secure session'}
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F8FAFC]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm font-semibold text-slate-600">Loading authentication...</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
