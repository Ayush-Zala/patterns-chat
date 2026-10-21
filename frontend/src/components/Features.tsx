import React from 'react';
import {
  Server,
  Layout,
  Database,
  Lock,
  MessageSquare,
  Zap,
  FolderGit2,
  Cpu,
} from 'lucide-react';

export function Features() {
  const features = [
    {
      title: 'Decoupled Clean Architecture',
      description:
        'Frontend and Backend are kept in independent directories (frontend/ and backend/) without monorepo overhead.',
      icon: FolderGit2,
      tag: 'Modular',
    },
    {
      title: 'Next.js App Router & Tailwind CSS',
      description:
        'Engineered with modern React Server Components, client state isolation, and utility-first Tailwind styling.',
      icon: Layout,
      tag: 'Frontend',
    },
    {
      title: 'NestJS REST & Realtime Ready',
      description:
        'Robust enterprise backend with dependency injection, validation pipes, global prefixing, and CORS handling.',
      icon: Server,
      tag: 'Backend',
    },
    {
      title: 'PostgreSQL & Prisma ORM',
      description:
        'Type-safe database interactions with declarative schema modeling, seamless migrations, and query generation.',
      icon: Database,
      tag: 'Data',
    },
    {
      title: 'Sub-millisecond Real-Time Foundation',
      description:
        'Ready for Socket.io integration to broadcast messages, typing presence, and emoji reactions instantaneously.',
      icon: Zap,
      tag: 'Scalable',
    },
    {
      title: 'Security & Clean Environment Boundaries',
      description:
        'Separated environment variables for frontend and backend. Zero credential leakage to public browser bundles.',
      icon: Lock,
      tag: 'Security',
    },
  ];

  const modules = [
    { id: '01', name: 'Project Setup & Baseline', status: 'Completed', current: false },
    { id: '02', name: 'Authentication & Workspaces', status: 'Completed', current: false },
    { id: '03', name: 'Channels & Real-Time Chat', status: 'Completed', current: false },
    { id: '04', name: 'Threaded Conversations', status: 'Completed', current: false },
    { id: '05', name: 'Direct Messages & Presence', status: 'Completed', current: false },
    { id: '06', name: 'Reactions, Mentions & Uploads', status: 'Completed', current: false },
    { id: '07', name: 'Search, Pinning & Alerts', status: 'Completed', current: true },
    { id: '08', name: 'Slack UX Polish & Shortcuts', status: 'Upcoming', current: false },
  ];

  return (
    <div id="features" className="py-20 bg-slate-50 border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600">
            Engineered For Excellence
          </h2>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Clean, Scalable Architecture from Day One
          </p>
          <p className="mt-4 text-base text-slate-600">
            TeamFlow follows a strict separation of concerns, ensuring each service can scale, deploy, and evolve independently.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-slate-200 bg-white p-7 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {feature.tag}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Roadmap Module Matrix */}
        <div id="roadmap" className="mt-24 pt-12 border-t border-slate-200">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h3 className="text-2xl font-bold text-slate-900">
              Module-by-Module Progression Plan
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Step-by-step engineering roadmap. Every module completes a fully tested milestone before moving forward.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((mod) => (
              <div
                key={mod.id}
                className={`rounded-xl border p-4 transition-all ${
                  mod.current
                    ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 bg-white opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-slate-400">
                    MODULE {mod.id}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      mod.current
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {mod.status}
                  </span>
                </div>
                <p className="font-bold text-slate-900 text-sm">{mod.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture & Quickstart Section */}
        <div id="quickstart" className="mt-20 rounded-2xl bg-slate-900 text-slate-100 p-6 sm:p-10 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                Independent Execution
              </span>
              <h3 className="mt-2 text-2xl sm:text-3xl font-bold text-white">
                Run Frontend & Backend Independently
              </h3>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                Both applications are self-contained. Open two PowerShell terminal tabs from the project root to run both applications concurrently in development mode.
              </p>

              <div className="mt-6 space-y-3 text-xs font-mono">
                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                  <span className="text-slate-500"># Terminal 1 (Frontend):</span>
                  <p className="text-emerald-400 mt-1">cd frontend &amp;&amp; npm run dev</p>
                  <span className="text-slate-400 text-[11px]">→ Running at http://localhost:3000</span>
                </div>
                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                  <span className="text-slate-500"># Terminal 2 (Backend):</span>
                  <p className="text-emerald-400 mt-1">cd backend &amp;&amp; npm run start:dev</p>
                  <span className="text-slate-400 text-[11px]">→ Running at http://localhost:3001/api</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-5 border border-slate-800 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400">
                <span>Directory Structure</span>
                <span className="text-[11px] text-indigo-400">Windows PowerShell</span>
              </div>
              <pre className="mt-4 text-slate-300 overflow-x-auto text-[11px] leading-5">
{`teamflow/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   ├── .env.example
│   ├── .env.local
│   └── package.json
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── common/
│   │   ├── config/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env.example
│   ├── .env
│   └── package.json
│
├── .gitignore
└── README.md`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
