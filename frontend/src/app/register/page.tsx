'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, ArrowRight, Lock, Mail, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const router = useRouter();
  const { user, register, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/workspaces');
    }
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register(name, email, password);
      router.push('/workspaces');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  async function handleGoogleSignup() {
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch(`${API_URL}/auth/oauth/google/url`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Could not retrieve Google OAuth URL');
        setIsSubmitting(false);
      }
    } catch (e) {
      setError('Failed to initiate Google sign up');
      setIsSubmitting(false);
    }
  }

  async function handleMicrosoftSignup() {
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch(`${API_URL}/auth/oauth/microsoft/url`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Could not retrieve Microsoft OAuth URL');
        setIsSubmitting(false);
      }
    } catch (e) {
      setError('Failed to initiate Microsoft sign up');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[#F8FAFC] text-slate-900 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Soft Light Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-indigo-200/40 via-purple-100/30 to-transparent blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-xl shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Zap className="h-6 w-6" />
          </div>
          <span className="text-2xl font-black tracking-tight text-slate-900">TeamFlow</span>
        </Link>
        <h2 className="mt-5 text-3xl font-extrabold text-slate-900 tracking-tight">
          Create Account
        </h2>
        <p className="mt-2 text-xs text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Sign in instead
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-white/90 backdrop-blur-xl py-8 px-6 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-200/80 sm:px-10">
          {error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Social OAuth Sign Up Buttons */}
          <div className="space-y-2.5 mb-5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleGoogleSignup}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs hover:shadow-xs transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Sign up with Google</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleMicrosoftSignup}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs hover:shadow-xs transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
              <span>Sign up with Microsoft</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200/80" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
              <span className="bg-white/90 px-2">Or with work email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <UserIcon className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sarah Connor"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Work Email address
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@company.com"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 hover:opacity-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create TeamFlow Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

