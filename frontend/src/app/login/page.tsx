'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceKickoutNotice, setDeviceKickoutNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'another_device') {
        setDeviceKickoutNotice(
          'Single Device Session: Your account was logged into on another device. For security, only one active device is allowed at a time.',
        );
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.push('/workspaces');
    }
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDeviceKickoutNotice(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push('/workspaces');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleQuickDemo() {
    setEmail('demo@teamflow.dev');
    setPassword('Password123!');
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white selection:bg-[#0066CC] selection:text-white">
      {/* ── LEFT SIDE: Patterns Building / Office Photo ───────────────────── */}
      <div className="hidden lg:block lg:w-7/12 relative h-screen overflow-hidden bg-slate-900">
        <img
          src="/patterns-building.jpg"
          alt="Patterns Headquarters"
          className="w-full h-full object-cover object-center"
        />
        {/* Soft natural gradient shadow */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-6 left-8 z-10 text-white">
          <p className="text-sm font-semibold tracking-wide drop-shadow-md">Patterns Technologies</p>
          <p className="text-xs text-white/80 drop-shadow-sm">Quality. Delivered.</p>
        </div>
      </div>

      {/* ── RIGHT SIDE: Crisp Light Login Form ────────────────────────────── */}
      <div className="w-full lg:w-5/12 min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-white relative">
        {/* Top Header with Patterns Logo */}
        <div className="pt-2 sm:pt-4 flex items-center justify-between">
          <Link href="/" className="inline-block transition-transform hover:scale-[1.02]">
            <img
              src="/patterns-logo.png"
              alt="Patterns"
              className="h-14 sm:h-16 w-auto object-contain"
            />
          </Link>
          <span className="hidden sm:inline-block px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-[#0066CC] border border-blue-100">
            Secure Portal
          </span>
        </div>

        {/* Center Main Form Area */}
        <div className="my-auto py-8 max-w-sm sm:max-w-md w-full mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Welcome Back!
            </h1>
            <p className="mt-2 text-sm text-slate-500 font-medium">
              Login with your email and password to continue
            </p>
          </div>

          {deviceKickoutNotice && (
            <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-3 shadow-xs animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{deviceKickoutNotice}</p>
                <p className="text-[11px] text-amber-700 mt-0.5">Please sign in again to use this device.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-center gap-3 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address <span className="text-[#0066CC]">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/20 outline-none transition-all shadow-2xs"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password <span className="text-[#0066CC]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/20 outline-none transition-all shadow-2xs pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* LOGIN Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 py-3.5 px-4 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AUTHENTICATING...</span>
                </>
              ) : (
                <span>LOGIN</span>
              )}
            </button>
          </form>

          {/* Quick Demo Pre-fill */}
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={handleQuickDemo}
              className="w-full py-2.5 px-3 rounded-lg bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/80 text-[#0066CC] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#0066CC]" />
              <span>Auto-fill Demo Account (demo@teamflow.dev)</span>
            </button>
          </div>

          {/* Create Account Link */}
          <div className="mt-6 text-center text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-bold text-[#0066CC] hover:underline">
              Create Account
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 pb-2 text-center text-xs text-slate-400">
          © 2026 Patterns. All rights reserved.
        </div>
      </div>
    </div>
  );
}
