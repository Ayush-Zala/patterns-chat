'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span className="text-base font-bold text-slate-900">TeamFlow</span>
            <span className="text-xs text-slate-500">| Slack-type modern web app</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-500">
            <span>Next.js 16 (App Router)</span>
            <span>•</span>
            <span>NestJS 12 REST API</span>
            <span>•</span>
            <span>Prisma ORM &amp; PostgreSQL</span>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1">
            <span>Crafted for high performance</span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© 2026 TeamFlow. All rights reserved.</p>
          <p>Module 1 Project Setup Baseline</p>
        </div>
      </div>
    </footer>
  );
}
