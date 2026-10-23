'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  Mail,
  Lock,
  MessageSquare,
  Video,
  FileText,
  Calendar,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
    <div className="min-h-screen w-full bg-[#F8FAFD] flex flex-col relative overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      {/* Ambient Blurred Glow Shapes matching Image 2 */}
      <div className="absolute -top-36 -right-36 w-[550px] h-[550px] rounded-full bg-gradient-to-br from-indigo-200/40 via-purple-200/25 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-36 -left-36 w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-blue-200/40 via-indigo-200/25 to-transparent blur-3xl pointer-events-none" />

      {/* Floating 3D Rounded Cubes (Decorative, matching Image 2) */}
      <div className="hidden lg:block absolute top-1/4 left-8 xl:left-14 w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-300/40 to-indigo-400/20 rotate-12 blur-[0.5px] pointer-events-none shadow-xs" />
      <div className="hidden lg:block absolute bottom-24 left-1/3 w-14 h-14 rounded-3xl bg-gradient-to-br from-indigo-400/25 to-purple-400/15 -rotate-12 blur-[0.5px] pointer-events-none shadow-xs" />

      {/* ─────────────────────────────────────────────────────────────
          TOP HEADER
      ───────────────────────────────────────────────────────────── */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center justify-between z-20">
        <Link href="/" className="flex items-center gap-2.5 group">
          <img
            src="/patterns-icon.png"
            alt="Patterns Chat"
            className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105"
          />
          <div className="flex items-center gap-1 font-black text-xl sm:text-2xl tracking-tight text-slate-900">
            <span>Patterns</span>
            <span className="text-indigo-600">Chat</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm text-slate-500 font-medium hidden sm:inline">
            Don&apos;t have an account?
          </span>
          <Link
            href="/register"
            className="px-4 py-2 rounded-xl border border-indigo-200/90 hover:border-indigo-300 bg-white hover:bg-indigo-50/60 text-indigo-600 font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 shadow-2xs group"
          >
            <span>Sign Up</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT: 2-COLUMN SPLIT (Image 2 Caliber)
      ───────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-10 flex-1 flex items-center justify-center w-full z-20">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* ── LEFT COLUMN: Brand Story & Features ─────────────────── */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50/90 border border-indigo-200/70 text-indigo-600 text-xs font-semibold mb-5 self-start shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>Team Collaboration Platform</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[54px] font-black tracking-tight text-slate-900 leading-[1.12]">
              Connect. Collaborate.
              <span className="block text-indigo-600 mt-1">Get Things Done.</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-4 sm:mt-5 text-sm sm:text-base text-slate-500 font-normal leading-relaxed max-w-lg">
              Patterns Chat brings your team, conversations, and tools into one powerful workspace. Chat, meet, share and get things done — all in one place.
            </p>

            {/* 4 Feature Items */}
            <div className="mt-8 space-y-4 max-w-lg">
              {/* Feature 1 */}
              <div className="flex items-center gap-3.5 sm:gap-4 group">
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 shadow-2xs group-hover:scale-105 transition-transform">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Team Messaging</h3>
                  <p className="text-xs text-slate-500 font-medium">Real-time chat with your team</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-center gap-3.5 sm:gap-4 group">
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 shadow-2xs group-hover:scale-105 transition-transform">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">HD Video Meetings</h3>
                  <p className="text-xs text-slate-500 font-medium">High quality calls & screen sharing</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-center gap-3.5 sm:gap-4 group">
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 shadow-2xs group-hover:scale-105 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">File Sharing</h3>
                  <p className="text-xs text-slate-500 font-medium">Secure & fast file sharing</p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex items-center gap-3.5 sm:gap-4 group">
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 shadow-2xs group-hover:scale-105 transition-transform">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Calendar & Scheduling</h3>
                  <p className="text-xs text-slate-500 font-medium">Never miss a meeting</p>
                </div>
              </div>
            </div>

            {/* Social Proof */}
            <div className="mt-8 sm:mt-10 flex items-center gap-3 pt-2">
              <div className="flex -space-x-2">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  alt="Teammate"
                  className="h-7 w-7 rounded-full border-2 border-white object-cover"
                />
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
                  alt="Teammate"
                  className="h-7 w-7 rounded-full border-2 border-white object-cover"
                />
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80"
                  alt="Teammate"
                  className="h-7 w-7 rounded-full border-2 border-white object-cover"
                />
                <img
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80"
                  alt="Teammate"
                  className="h-7 w-7 rounded-full border-2 border-white object-cover"
                />
              </div>
              <span className="text-xs font-semibold text-slate-600">
                Trusted by 10,000+ teams worldwide
              </span>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Crisp Floating Login Card (Image 2 Caliber) ── */}
          <div className="lg:col-span-6 xl:col-span-5 flex justify-center w-full">
            <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-[0_20px_50px_rgba(79,70,229,0.08)] p-6 sm:p-9 relative">
              {/* Card Header with Logo */}
              <div className="flex flex-col items-center justify-center text-center">
                <img
                  src="/patterns-icon.png"
                  alt="Patterns"
                  className="h-9 w-auto object-contain"
                />
                <div className="flex items-center gap-1 font-black text-xl tracking-tight text-slate-900 mt-1.5">
                  <span>Patterns</span>
                  <span className="text-indigo-600">Chat</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-4">
                  Welcome Back!
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Sign in to your account to continue collaborating with your team.
                </p>
              </div>

              {/* Segmented Pill Switcher (Image 2 Caliber) */}
              <div className="mt-6 flex items-center p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60">
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 text-white font-bold text-xs sm:text-sm shadow-xs transition-all"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Login</span>
                </button>
                <Link
                  href="/register"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-slate-600 hover:text-slate-900 font-semibold text-xs sm:text-sm transition-all"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Sign Up</span>
                </Link>
              </div>

              {/* Single Device Session Notice */}
              {deviceKickoutNotice && (
                <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-800 flex items-start gap-2.5 shadow-xs animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{deviceKickoutNotice}</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Please sign in again to use this device.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {/* Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email Address <span className="text-indigo-600">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Password <span className="text-indigo-600">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
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

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleQuickDemo}
                    className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Or continue with divider */}
              <div className="relative flex items-center justify-center my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100" />
                </div>
                <span className="relative bg-white px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  or continue with
                </span>
              </div>

              {/* Social Login Buttons (Image 2 Caliber) */}
              <div className="grid grid-cols-2 gap-3">
                {/* Google */}
                <button
                  type="button"
                  onClick={handleQuickDemo}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200/90 hover:bg-slate-50/80 transition-colors flex items-center justify-center gap-2 text-xs font-bold text-slate-700 shadow-2xs"
                  title="Sign in with Google (fills demo credentials)"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Google</span>
                </button>

                {/* Microsoft */}
                <button
                  type="button"
                  onClick={handleQuickDemo}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200/90 hover:bg-slate-50/80 transition-colors flex items-center justify-center gap-2 text-xs font-bold text-slate-700 shadow-2xs"
                  title="Sign in with Microsoft (fills demo credentials)"
                >
                  <svg className="h-4 w-4" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                  </svg>
                  <span>Microsoft</span>
                </button>
              </div>

              {/* Card Footer */}
              <div className="mt-6 text-center text-xs text-slate-500">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
                  Create an account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 z-20">
        © 2026 Patterns Chat Technologies. All rights reserved.
      </footer>
    </div>
  );
}
