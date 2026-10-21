'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Menu, X, Radio, ArrowRight, User as UserIcon } from 'lucide-react';
import { useHealth } from '@/hooks/use-health';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { health, loading: healthLoading } = useHealth();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
              TeamFlow
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 -mt-1">
              Workplace Chat
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-indigo-600 transition-colors">
            Features
          </a>
          <a href="#architecture" className="hover:text-indigo-600 transition-colors">
            Architecture
          </a>
          <a href="#roadmap" className="hover:text-indigo-600 transition-colors">
            Modules
          </a>
          <a href="#tech-stack" className="hover:text-indigo-600 transition-colors">
            Tech Stack
          </a>
        </nav>

        {/* API Status Badge & Auth Actions */}
        <div className="hidden sm:flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1 text-xs font-medium text-slate-700">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  health?.status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  health?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span>
              {healthLoading
                ? 'Connecting API...'
                : health?.status === 'ok'
                ? 'API Online'
                : 'Standalone'}
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/workspaces"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
              >
                <span>Launch Workspaces</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25 hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white px-4 pt-2 pb-6 md:hidden">
          <div className="space-y-3">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              Features
            </a>
            <a
              href="#roadmap"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              Modules
            </a>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
            {user ? (
              <Link
                href="/workspaces"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Launch Workspaces
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
