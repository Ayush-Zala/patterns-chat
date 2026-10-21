import { User } from './auth';

export interface ChannelMemberItem {
  id: string;
  joinedAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    status?: string;
    presence?: PresenceStatus;
  };
}

export interface Channel {
  id: string;
  name: string;
  topic?: string | null;
  isPrivate: boolean;
  workspaceId: string;
  createdById: string;
  createdAt: string;
  members?: ChannelMemberItem[];
  _count?: {
    messages: number;
    members?: number;
  };
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  user: {
    id: string;
    name: string;
  };
}

export interface MessageReplyPreview {
  createdAt: string;
  user: {
    id?: string;
    name: string;
    avatarUrl?: string;
  };
}

export interface Attachment {
  id?: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt?: string;
}

export interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    status?: string;
  };
  attachments?: Attachment[];
  reactions?: Reaction[];
  replies?: MessageReplyPreview[];
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedById?: string;
  pinnedBy?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  _count?: {
    replies: number;
  };
}

export interface ThreadData {
  parent: Message;
  replies: Message[];
}

export type PresenceStatus = 'ONLINE' | 'AWAY' | 'OFFLINE';

export interface DirectMessage {
  id: string;
  content: string;
  conversationId: string;
  userId: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    status?: string;
    presence?: PresenceStatus;
  };
  attachments?: Attachment[];
  reactions?: Reaction[];
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedById?: string;
  pinnedBy?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

export interface ConversationParticipant {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status?: string;
  presence?: PresenceStatus;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  userOneId: string;
  userOne: ConversationParticipant;
  userTwoId: string;
  userTwo: ConversationParticipant;
  createdAt: string;
}

export interface Notification {
  id: string;
  workspaceId: string;
  userId: string;
  actorId: string;
  actor: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  type: 'MENTION' | 'REACTION' | 'DIRECT_MESSAGE' | 'THREAD_REPLY' | 'PIN';
  title: string;
  body: string;
  channelId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface SearchResult {
  messages: Array<any>;
  files: Array<any>;
  channels: Array<any>;
  people: Array<any>;
  total: number;
}
