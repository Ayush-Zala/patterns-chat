'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Workspace, AuthResponse } from '@/types/auth';
import { getSocket } from './socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  createWorkspace: (name: string) => Promise<Workspace>;
  joinWorkspace: (joinCode: string) => Promise<Workspace>;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  refreshWorkspaces: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('teamflow_token');
    const savedUser = localStorage.getItem('teamflow_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        fetchWorkspaces(savedToken);
      } catch (e) {
        localStorage.removeItem('teamflow_token');
        localStorage.removeItem('teamflow_user');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // Single active device enforcement: listen for force_logout broadcast
  useEffect(() => {
    if (!user?.id) return;
    const socket = getSocket();
    socket.emit('join_user', { userId: user.id });

    const handleForceLogout = (data: { reason?: string }) => {
      console.warn('⚠️ Force logout received from server:', data);
      logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=another_device';
      }
    };

    socket.on('force_logout', handleForceLogout);
    return () => {
      socket.off('force_logout', handleForceLogout);
    };
  }, [user?.id]);

  async function fetchWorkspaces(authToken: string, retryCount = 0) {
    try {
      const res = await fetch(`${API_URL}/workspaces`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login?reason=another_device';
        }
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
        if (data.length > 0) {
          setCurrentWorkspace((prev) => prev || data[0]);
        }
      }
    } catch (err) {
      // Safe non-blocking warning (won't trigger Next.js red error overlay)
      console.warn('Notice: Backend API is syncing or momentarily connecting:', err);
      if (retryCount < 2) {
        setTimeout(() => {
          fetchWorkspaces(authToken, retryCount + 1);
        }, 1500);
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    const { user: authedUser, accessToken } = data as AuthResponse;
    setToken(accessToken);
    setUser(authedUser);
    localStorage.setItem('teamflow_token', accessToken);
    localStorage.setItem('teamflow_user', JSON.stringify(authedUser));

    await fetchWorkspaces(accessToken);
  }

  async function register(name: string, email: string, password: string) {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    const { user: authedUser, accessToken } = data as AuthResponse;
    setToken(accessToken);
    setUser(authedUser);
    localStorage.setItem('teamflow_token', accessToken);
    localStorage.setItem('teamflow_user', JSON.stringify(authedUser));

    await fetchWorkspaces(accessToken);
  }

  function logout() {
    setUser(null);
    setToken(null);
    setWorkspaces([]);
    setCurrentWorkspace(null);
    localStorage.removeItem('teamflow_token');
    localStorage.removeItem('teamflow_user');
  }

  async function createWorkspace(name: string): Promise<Workspace> {
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_URL}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to create workspace');
    }

    await fetchWorkspaces(token);
    const newWs = data.workspace;
    setCurrentWorkspace(newWs);
    return newWs;
  }

  async function joinWorkspace(joinCode: string): Promise<Workspace> {
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_URL}/workspaces/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ joinCode }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to join workspace');
    }

    await fetchWorkspaces(token);
    const joinedWs = data.workspace;
    setCurrentWorkspace(joinedWs);
    return joinedWs;
  }

  async function refreshWorkspaces() {
    if (token) {
      await fetchWorkspaces(token);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        workspaces,
        currentWorkspace,
        loading,
        login,
        register,
        logout,
        createWorkspace,
        joinWorkspace,
        setCurrentWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
