'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const router = useRouter();
  const { user, register, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white selection:bg-[#0066CC] selection:text-white">
      {/* ── LEFT SIDE: Patterns Building / Office Photo ───────────────────── */}
      <div className="hidden lg:block lg:w-7/12 relative h-screen overflow-hidden bg-slate-900">
        <img
          src="/patterns-building.jpg"
          alt="Patterns Headquarters"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-6 left-8 z-10 text-white">
          <p className="text-sm font-semibold tracking-wide drop-shadow-md">Patterns Technologies</p>
          <p className="text-xs text-white/80 drop-shadow-sm">Quality. Delivered.</p>
        </div>
      </div>

      {/* ── RIGHT SIDE: Crisp Light Register Form ─────────────────────────── */}
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
            Join Team
          </span>
        </div>

        {/* Center Main Form Area */}
        <div className="my-auto py-8 max-w-sm sm:max-w-md w-full mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Create Account
            </h1>
            <p className="mt-2 text-sm text-slate-500 font-medium">
              Sign up to collaborate with your team on Patterns
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-center gap-3 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name <span className="text-[#0066CC]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sarah Connor"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/20 outline-none transition-all shadow-2xs"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Work Email Address <span className="text-[#0066CC]">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@company.com"
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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
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

            {/* REGISTER Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 py-3.5 px-4 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>CREATING ACCOUNT...</span>
                </>
              ) : (
                <span>REGISTER</span>
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-bold text-[#0066CC] hover:underline">
              Sign In
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
