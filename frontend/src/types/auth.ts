export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  status?: string;
  presence?: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';
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

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'TEAM_LEAD' | 'MEMBER' | 'GUEST';

export interface WorkspaceMember {
  id: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    status?: string;
    presence?: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';
    createdAt?: string;
  };
}

export interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
}

export interface MeetingParticipant {
  id: string;
  meetingId: string;
  userId: string;
  status: 'INVITED' | 'ACCEPTED' | 'DECLINED';
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    status?: string;
    presence?: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';
  };
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  duration: number;
  meetingLink?: string;
  workspaceId: string;
  channelId?: string;
  hostId: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  host?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  channel?: {
    id: string;
    name: string;
    isPrivate?: boolean;
  };
  participants?: MeetingParticipant[];
  createdAt: string;
}

