'use client';

import React, { useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function WorkspaceMailRedirectContent() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/workspace/${params.id}?tab=mail`);
    }
  }, [params, router]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC] text-slate-800">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-xs text-slate-500 font-medium tracking-wide">Opening Mail Studio...</p>
      </div>
    </div>
  );
}

export default function WorkspaceMailRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC] text-slate-800">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-xs text-slate-500 font-medium tracking-wide">Loading Mail Studio...</p>
          </div>
        </div>
      }
    >
      <WorkspaceMailRedirectContent />
    </Suspense>
  );
}
