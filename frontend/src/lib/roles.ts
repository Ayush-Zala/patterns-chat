import { WorkspaceRole } from '@/types/auth';

export const ROLE_WEIGHTS: Record<WorkspaceRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  MANAGER: 30,
  TEAM_LEAD: 20,
  MEMBER: 10,
  GUEST: 0,
};

export interface RoleConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
}

export const ROLE_CONFIGS: Record<WorkspaceRole, RoleConfig> = {
  OWNER: {
    label: 'Super Admin',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-400/40',
    description: 'Workspace Creator with full authority over all settings and members',
  },
  ADMIN: {
    label: 'Admin',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-400/40',
    description: 'Can manage channels, invite members, and assign roles',
  },
  MANAGER: {
    label: 'Manager',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-400/40',
    description: 'Can manage projects, channels, and invite team leads/members',
  },
  TEAM_LEAD: {
    label: 'Team Lead',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-800',
    badgeBorder: 'border-cyan-400/40',
    description: 'Leads project channels and can invite team members',
  },
  MEMBER: {
    label: 'Member',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-400/40',
    description: 'Standard member with access to conversations and calls',
  },
  GUEST: {
    label: 'Guest',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-400/40',
    description: 'Restricted access guest with read-only permissions',
  },
};

export function canInviteMembers(role?: string): boolean {
  if (!role) return false;
  const weight = ROLE_WEIGHTS[role as WorkspaceRole] ?? 0;
  return weight >= ROLE_WEIGHTS.TEAM_LEAD;
}

export function getAllowedInviteRoles(myRole?: string): WorkspaceRole[] {
  if (!myRole) return [];
  const weight = ROLE_WEIGHTS[myRole as WorkspaceRole] ?? 0;
  if (weight >= ROLE_WEIGHTS.OWNER) {
    return ['ADMIN', 'MANAGER', 'TEAM_LEAD', 'MEMBER', 'GUEST'];
  }
  if (weight >= ROLE_WEIGHTS.ADMIN) {
    return ['ADMIN', 'MANAGER', 'TEAM_LEAD', 'MEMBER', 'GUEST'];
  }
  if (weight >= ROLE_WEIGHTS.MANAGER) {
    return ['MANAGER', 'TEAM_LEAD', 'MEMBER', 'GUEST'];
  }
  if (weight >= ROLE_WEIGHTS.TEAM_LEAD) {
    return ['TEAM_LEAD', 'MEMBER', 'GUEST'];
  }
  return [];
}

export function canManageMemberRole(myRole?: string, targetRole?: string): boolean {
  if (!myRole || !targetRole) return false;
  if (targetRole === 'OWNER') return false;
  const myWeight = ROLE_WEIGHTS[myRole as WorkspaceRole] ?? 0;
  const targetWeight = ROLE_WEIGHTS[targetRole as WorkspaceRole] ?? 0;
  if (myRole === 'OWNER') return true;
  return myWeight >= ROLE_WEIGHTS.MANAGER && myWeight > targetWeight;
}

export function canRemoveMember(myRole?: string, targetRole?: string, isMe?: boolean): boolean {
  if (isMe) return false;
  if (!myRole || !targetRole) return false;
  if (targetRole === 'OWNER') return false;
  if (myRole === 'OWNER') return true;
  const myWeight = ROLE_WEIGHTS[myRole as WorkspaceRole] ?? 0;
  const targetWeight = ROLE_WEIGHTS[targetRole as WorkspaceRole] ?? 0;
  return myWeight >= ROLE_WEIGHTS.TEAM_LEAD && myWeight > targetWeight;
}

export function canEditChannel(myRole?: string, isCreator?: boolean): boolean {
  if (isCreator) return true;
  if (!myRole) return false;
  const weight = ROLE_WEIGHTS[myRole as WorkspaceRole] ?? 0;
  return weight >= ROLE_WEIGHTS.TEAM_LEAD;
}

export function canDeleteChannel(myRole?: string, isCreator?: boolean): boolean {
  if (isCreator) return true;
  if (!myRole) return false;
  const weight = ROLE_WEIGHTS[myRole as WorkspaceRole] ?? 0;
  return weight >= ROLE_WEIGHTS.ADMIN;
}
