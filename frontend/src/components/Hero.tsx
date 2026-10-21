'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Terminal, Layers, Sparkles, Hash, Users, Bell } from 'lucide-react';
import { useHealth } from '@/hooks/use-health';

export function Hero() {
  const { health, loading, error } = useHealth();

  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
      {/* Background Decorative Gradients */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 -translate-x-1/2 transform-gpu blur-3xl sm:-top-80">
        <div
          className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-indigo-300 via-purple-300 to-pink-200 opacity-40"
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Module 1 Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/70 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm mb-6">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span>Module 1 Complete: Full-Stack Project Setup</span>
            <span className="h-1 w-1 rounded-full bg-indigo-400" />
            <span className="text-indigo-600 font-medium">Next.js + NestJS + Prisma</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl sm:leading-[1.15]">
            Where team conversations{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              flow naturally
            </span>
            .
          </h1>

          {/* Subheading */}
          <p className="mt-6 text-lg leading-8 text-slate-600 sm:text-xl">
            <strong>TeamFlow</strong> is a modern, modular Slack-type team communication platform.
            Engineered for speed, developer ergonomics, and enterprise-grade real-time collaboration.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/workspaces"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:bg-indigo-700 transition-all hover:scale-[1.02]"
            >
              <span>Launch TeamFlow Workspaces</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <a
              href="#architecture"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Layers className="h-4 w-4 text-slate-500" />
              <span>Explore Architecture</span>
            </a>
          </div>

          {/* Live Backend Connection Card */}
          <div className="mt-10 mx-auto max-w-xl rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-sm backdrop-blur-sm text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <Terminal className="h-4 w-4 text-indigo-600" />
                <span>Backend Health Verification</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">GET /api/health</span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {loading ? (
                    'Checking NestJS API status...'
                  ) : health ? (
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      {health.message}
                    </span>
                  ) : (
                    <span className="text-amber-600">
                      Backend offline ({error || 'Ensure backend is running on :3001'})
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connected to PostgreSQL Database via Prisma ORM
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    health?.status === 'ok'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {health?.status === 'ok' ? 'HTTP 200 OK' : 'PENDING'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Slack-Style UI Preview Canvas */}
        <div className="mt-14 sm:mt-20">
          <div className="relative mx-auto max-w-5xl rounded-2xl border border-slate-300/80 bg-white p-2 shadow-2xl shadow-indigo-900/10 sm:p-4">
            {/* Window Top Bar */}
            <div className="flex items-center justify-between pb-3 px-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-rose-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs font-medium text-slate-400">TeamFlow Workspace — Acme Corp</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px]">Ctrl + K</span>
              </div>
            </div>

            {/* Mock Slack Layout */}
            <div className="mt-2 grid grid-cols-1 md:grid-cols-12 min-h-[380px] rounded-xl overflow-hidden border border-slate-200">
              {/* Sidebar */}
              <div className="hidden md:flex md:col-span-4 lg:col-span-3 flex-col bg-slate-900 text-slate-300 p-4 justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="font-bold text-white text-sm">Acme Engineering</span>
                    <Bell className="h-4 w-4 text-slate-400" />
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Channels
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 rounded-lg bg-indigo-600/30 text-white px-2.5 py-1.5 font-medium">
                          <Hash className="h-4 w-4 text-indigo-400" />
                          <span>general</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg hover:bg-slate-800 px-2.5 py-1.5 text-slate-400">
                          <Hash className="h-4 w-4" />
                          <span>announcements</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg hover:bg-slate-800 px-2.5 py-1.5 text-slate-400">
                          <Hash className="h-4 w-4" />
                          <span>engineering</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Direct Messages
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 rounded-lg hover:bg-slate-800 px-2.5 py-1.5 text-slate-400">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          <span>Sarah Connor</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg hover:bg-slate-800 px-2.5 py-1.5 text-slate-400">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          <span>Alex Rivera</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                    JD
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white">Jeet Dabhi</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat View Canvas */}
              <div className="col-span-12 md:col-span-8 lg:col-span-9 bg-slate-50 flex flex-col justify-between p-4 sm:p-6">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <Hash className="h-5 w-5 text-slate-600" />
                      <span className="font-bold text-slate-900">general</span>
                      <span className="text-xs text-slate-400 hidden sm:inline">| Company-wide announcements and discussion</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Users className="h-4 w-4" />
                      <span>42 members</span>
                    </div>
                  </div>

                  {/* Messages Preview */}
                  <div className="mt-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-xl bg-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        SC
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">Sarah Connor</span>
                          <span className="text-[11px] text-slate-400">10:42 AM</span>
                        </div>
                        <p className="text-sm text-slate-700 mt-0.5">
                          Welcome to the new <span className="font-semibold text-indigo-600">TeamFlow</span> workspace! Module 1 project structure is live with independent Next.js frontend and NestJS API backend. 🚀
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 shadow-2xs">
                            👍 4
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 shadow-2xs">
                            🎉 6
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        TF
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">TeamFlow Bot</span>
                          <span className="rounded bg-indigo-100 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.2">APP</span>
                          <span className="text-[11px] text-slate-400">10:44 AM</span>
                        </div>
                        <div className="mt-1 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 space-y-1">
                          <p className="font-semibold text-slate-800">✅ Database & API Status</p>
                          <p>• PostgreSQL Server: Connected</p>
                          <p>• Prisma ORM Engine: Generated & Verified</p>
                          <p>• Ready for Module 2: Authentication</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input Bar Placeholder */}
                <div className="mt-6 pt-3 border-t border-slate-200">
                  <div className="flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm">
                    <span>Message #general (Setup preview — functional chat activates in Module 3)...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
