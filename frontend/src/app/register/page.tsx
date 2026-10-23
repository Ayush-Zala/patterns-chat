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
  User,
  Mail,
  Lock,
  MessageSquare,
  Video,
  FileText,
  Calendar,
  LogIn,
  UserPlus,
  X,
  UserCheck,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface PresetGoogleAccount {
  name: string;
  email: string;
  avatarUrl: string;
}

const PRESET_GOOGLE_ACCOUNTS: PresetGoogleAccount[] = [
  {
    name: 'Yash Shah',
    email: 'yshah0611@gmail.com',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Yash%20Shah&backgroundColor=4285F4',
  },
  {
    name: 'Love Shah',
    email: 'loveshah@gmail.com',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Love%20Shah&backgroundColor=34A853',
  },
  {
    name: 'Patterns Team',
    email: 'team@patterns.chat',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Patterns%20Team&backgroundColor=EA4335',
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const { user, register, loginWithGoogle, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  // Google Modal State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');

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

  async function executeGoogleLogin(selectedEmail: string, selectedName?: string, selectedAvatar?: string) {
    setError(null);
    setIsGoogleSubmitting(true);

    try {
      await loginWithGoogle(selectedEmail, selectedName);
      setShowGoogleModal(false);
      router.push('/workspaces');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-up failed');
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  function handleCustomGoogleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customGoogleEmail.trim()) return;
    executeGoogleLogin(customGoogleEmail.trim().toLowerCase(), customGoogleName.trim() || undefined);
  }

  return (
    <div className="h-screen max-h-screen w-full bg-[#F8FAFD] flex flex-col justify-between relative overflow-hidden select-none selection:bg-indigo-500 selection:text-white">
      {/* Ambient Blurred Glow Shapes */}
      <div className="absolute -top-36 -right-36 w-[450px] h-[450px] rounded-full bg-gradient-to-br from-indigo-200/35 via-purple-200/20 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-36 -left-36 w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-blue-200/35 via-indigo-200/20 to-transparent blur-3xl pointer-events-none" />

      {/* ─────────────────────────────────────────────────────────────
          TOP HEADER
      ───────────────────────────────────────────────────────────── */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex items-center justify-between z-20 shrink-0">
        <Link href="/" className="flex items-center gap-2 group">
          <img
            src="/patterns-icon.png?v=2"
            alt="Patterns Chat"
            className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
          />
          <div className="flex items-center gap-1 font-black text-lg sm:text-xl tracking-tight text-slate-900">
            <span>Patterns</span>
            <span className="text-indigo-600">Chat</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Already have an account?
          </span>
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-xl border border-indigo-200/90 hover:border-indigo-300 bg-white hover:bg-indigo-50/60 text-indigo-600 font-bold text-xs transition-all flex items-center gap-1.5 shadow-2xs group"
          >
            <span>Sign In</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT: 2-COLUMN SPLIT (No Scrollbar)
      ───────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex items-center justify-center w-full z-20 min-h-0 overflow-hidden">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-12 items-center">
          {/* ── LEFT COLUMN: Brand Story & Features ─────────────────── */}
          <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-center">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-indigo-50/90 border border-indigo-200/70 text-indigo-600 text-[11px] font-semibold mb-2 self-start shadow-2xs">
              <Sparkles className="h-3 w-3 text-indigo-600" />
              <span>Get Started in 30 Seconds</span>
            </div>

            {/* Headline */}
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] xl:text-[38px] font-black tracking-tight text-slate-900 leading-[1.12]">
              Join Your Team on
              <span className="block text-indigo-600 mt-0.5">Patterns Chat.</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-2 text-xs sm:text-sm text-slate-500 font-normal leading-relaxed max-w-md">
              Fast, intelligent, enterprise-grade team messaging, high-definition video calls, and instant collaboration.
            </p>

            {/* 4 Feature Items */}
            <div className="mt-3.5 space-y-2 max-w-md">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 shadow-2xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Modern Team Messaging</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Real-time chat, reactions, voice notes</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 shadow-2xs">
                  <Video className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">HD Video Calls & Recordings</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Zero-lag video conferences and screen share</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 shadow-2xs">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Enterprise Security</h3>
                  <p className="text-[10px] text-slate-500 font-medium">End-to-end encryption & single device control</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Fitted Register Card ── */}
          <div className="lg:col-span-6 xl:col-span-5 flex justify-center w-full">
            <div className="w-full max-w-[385px] bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_15px_40px_rgba(79,70,229,0.07)] p-4 sm:p-5 relative shrink-0">
              {/* Card Header with HD Patterns Logo */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <img
                    src="/patterns-icon.png?v=2"
                    alt="Patterns"
                    className="h-6 w-auto object-contain"
                  />
                  <div className="flex items-center gap-1 font-black text-lg tracking-tight text-slate-900">
                    <span>Patterns</span>
                    <span className="text-indigo-600">Chat</span>
                  </div>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1">
                  Create Your Account
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
                  Join your teammates and start collaborating today.
                </p>
              </div>

              {/* Segmented Pill Switcher */}
              <div className="mt-2.5 flex items-center p-0.5 bg-slate-100/90 rounded-xl border border-slate-200/60">
                <Link
                  href="/login"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg text-slate-600 hover:text-slate-900 font-semibold text-xs transition-all"
                >
                  <LogIn className="h-3 w-3" />
                  <span>Login</span>
                </Link>
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs transition-all"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>Sign Up</span>
                </button>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 flex items-center gap-1.5 animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  <span className="text-[11px] font-medium leading-tight">{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-2.5 space-y-2">
                {/* Full Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                    Full Name <span className="text-indigo-600">*</span>
                  </label>
                  <div className="relative">
                    <User className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                    Email Address <span className="text-indigo-600">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                    Password <span className="text-indigo-600">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Create Account Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || isGoogleSubmitting}
                  className="w-full mt-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100" />
                </div>
                <span className="relative bg-white px-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  or continue with
                </span>
              </div>

              {/* Google-Only Full Width Button */}
              <button
                type="button"
                onClick={() => setShowGoogleModal(true)}
                disabled={isSubmitting || isGoogleSubmitting}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs font-bold text-slate-700 shadow-2xs hover:border-slate-300 disabled:opacity-50 group"
                title="Sign up with your Google account"
              >
                {isGoogleSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                    <span>Signing up with Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Card Footer */}
              <div className="mt-2 text-center text-[10px] text-slate-500">
                Already have an account?{' '}
                <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-1 text-center text-[10px] text-slate-400 z-20 shrink-0">
        © 2026 Patterns Chat Technologies. All rights reserved.
      </footer>

      {/* ─────────────────────────────────────────────────────────────
          GOOGLE ACCOUNT CHOOSER MODAL
      ───────────────────────────────────────────────────────────── */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200">
            {/* Modal Header with Google G */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24">
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
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                    Sign up with Google
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Choose an account to continue to Patterns Chat
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Account List */}
            <div className="p-3 space-y-1.5 max-h-[320px] overflow-y-auto">
              {PRESET_GOOGLE_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => executeGoogleLogin(acc.email, acc.name, acc.avatarUrl)}
                  disabled={isGoogleSubmitting}
                  className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={acc.avatarUrl}
                      alt={acc.name}
                      className="h-9 w-9 rounded-full border border-slate-200 shadow-2xs group-hover:scale-105 transition-transform shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                        {acc.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{acc.email}</p>
                    </div>
                  </div>
                  <UserCheck className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0" />
                </button>
              ))}

              {/* Use Another Google Account Toggle */}
              {!showCustomGoogleInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomGoogleInput(true)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-indigo-50/60 border border-dashed border-slate-200 hover:border-indigo-200 text-left transition-all text-indigo-600 group mt-1"
                >
                  <div className="h-9 w-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 group-hover:scale-105 transition-transform">
                    <PlusCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Use another Google account</p>
                    <p className="text-[10px] text-slate-400">Enter your Gmail or Workspace email</p>
                  </div>
                </button>
              ) : (
                <form
                  onSubmit={handleCustomGoogleSubmit}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200 mt-2 space-y-2 animate-in fade-in"
                >
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      Your Google Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={customGoogleName}
                      onChange={(e) => setCustomGoogleName(e.target.value)}
                      placeholder="e.g. Alex Miller"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      Google Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCustomGoogleInput(false)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={!customGoogleEmail.trim() || isGoogleSubmitting}
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Disclaimer */}
            <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                To continue, Google shares your verified profile and email with Patterns Chat.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
