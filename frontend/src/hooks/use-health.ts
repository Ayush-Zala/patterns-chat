'use client';

import { useState, useEffect } from 'react';
import { ApiHealthResponse } from '@/types';

export function useHealth() {
  const [health, setHealth] = useState<ApiHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

    async function checkHealth() {
      try {
        setLoading(true);
        const res = await fetch(`${apiUrl}/health`);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data: ApiHealthResponse = await res.json();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reach API');
        setHealth(null);
      } finally {
        setLoading(false);
      }
    }

    checkHealth();
  }, []);

  return { health, loading, error };
}
