'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import LoginPage from './login/page';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/workspaces');
    }
  }, [user, loading, router]);

  // Directly show the clean Patterns login page with instant response and zero marketing fluff
  return <LoginPage />;
}
