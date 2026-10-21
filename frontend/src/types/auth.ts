export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  status?: string;
  presence?: 'ONLINE' | 'AWAY' | 'OFFLINE';
  createdAt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  joinCode: string;
  role?: string;
  userRole?: string;
  joinedAt?: string;
  membersCount: number;
  ownerId?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface WorkspaceMember {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    status?: string;
    presence?: 'ONLINE' | 'AWAY' | 'OFFLINE';
    createdAt?: string;
  };
}

export interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
}
