'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Hash,
  Lock,
  Search,
  Users,
  Plus,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  Smile,
  Paperclip,
  Send,
  Bold,
  Italic,
  Code,
  X,
  Star,
  Headphones,
  AtSign,
  Quote,
  Strikethrough,
  Settings,
  HelpCircle,
  Clock,
  ArrowLeft,
  ArrowRight,
  Share2,
  Sparkles,
  Radio,
  Flame,
  Shield,
  Zap,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileCode,
  Download,
  Maximize2,
  File,
  LogOut,
  Pin,
  PinOff,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  CheckCheck,
  UserPlus,
  UserMinus,
  Mail,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Trash2,
  Phone,
  PhoneCall,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  Menu,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Workspace, WorkspaceMember } from '@/types/auth';
import {
  Channel,
  ChannelMemberItem,
  Message,
  Reaction,
  Attachment,
  Conversation,
  DirectMessage,
  ConversationParticipant,
  PresenceStatus,
  Notification,
  SearchResult,
} from '@/types/chat';
import { getSocket } from '@/lib/socket';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const QUICK_EMOJIS = ['👍', '❤️', '🎉', '🚀', '🔥', '👀'];

// Module 9: Enhanced Code Block with Language Badge & Copy-to-Clipboard
function CodeBlockView({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  let raw = content.trim();
  if (raw.startsWith('```')) raw = raw.slice(3);
  if (raw.endsWith('```')) raw = raw.slice(0, -3);

  const lines = raw.split('\n');
  let language = 'code';
  let code = raw;

  if (lines.length > 0 && /^[a-zA-Z0-9_#-]+$/.test(lines[0].trim())) {
    language = lines[0].trim().toLowerCase();
    code = lines.slice(1).join('\n');
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy code:', e);
    }
  };

  return (
    <div className="mt-2 my-2 rounded-xl border border-slate-800 bg-[#0F172A] shadow-md overflow-hidden font-mono text-xs text-slate-200">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1E293B]/95 border-b border-slate-800/80 text-[11px] text-slate-400 select-none">
        <div className="flex items-center gap-1.5">
          <Code className="h-3.5 w-3.5 text-indigo-400" />
          <span className="font-semibold uppercase tracking-wider text-[10px] text-indigo-300">
            {language}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-slate-700/60 text-slate-300 hover:text-white transition-all text-[11px]"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium text-[10px]">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 text-slate-400" />
              <span className="text-[10px]">Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-emerald-300/95 leading-relaxed font-mono selection:bg-indigo-600 selection:text-white">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function WorkspaceShellContent() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const { user, token, loading: authLoading, workspaces, logout, setCurrentWorkspace } = useAuth();

  // Core Data State
  const [currentWs, setCurrentWs] = useState<Workspace | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Module 5: Direct Messages & Presence State
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeRecipient, setActiveRecipient] = useState<ConversationParticipant | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [dmLoading, setDmLoading] = useState(false);
  const [userPresence, setUserPresence] = useState<PresenceStatus>('ONLINE');
  const [showPresenceMenu, setShowPresenceMenu] = useState(false);

  // Module 6: Reactions, Mentions & Uploads State (Any File Type & Multi-GB Streaming Support)
  interface UploadProgressInfo {
    fileName: string;
    percent: number;
    uploadedBytes: number;
    totalBytes: number;
    speed?: string;
  }
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingDMAttachments, setPendingDMAttachments] = useState<Attachment[]>([]);
  const [isUploadingDM, setIsUploadingDM] = useState(false);
  const [pendingThreadAttachments, setPendingThreadAttachments] = useState<Attachment[]>([]);
  const [isUploadingThread, setIsUploadingThread] = useState(false);
  const [isDraggingOverChannel, setIsDraggingOverChannel] = useState(false);
  const [isDraggingOverDM, setIsDraggingOverDM] = useState(false);
  const channelFileInputRef = useRef<HTMLInputElement>(null);
  const dmFileInputRef = useRef<HTMLInputElement>(null);
  const threadFileInputRef = useRef<HTMLInputElement>(null);

  // Mention Autocomplete State
  const [mentionType, setMentionType] = useState<'user' | 'channel' | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionTarget, setMentionTarget] = useState<'channel' | 'dm'>('channel');

  // Rich Emoji Picker Modal / Popover State
  const [activeEmojiPickerFor, setActiveEmojiPickerFor] = useState<{ messageId: string; isDM: boolean } | null>(null);
  const [emojiTab, setEmojiTab] = useState<'popular' | 'smileys' | 'work'>('popular');

  // Lightbox Preview Modal State
  const [activeLightboxImage, setActiveLightboxImage] = useState<{ url: string; fileName: string; fileSize?: number } | null>(null);

  // Thread Drawer State (Module 4)
  const [activeThreadParent, setActiveThreadParent] = useState<Message | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadInputText, setThreadInputText] = useState('');
  const [isSendingThreadReply, setIsSendingThreadReply] = useState(false);

  // UI state
  const [copiedCode, setCopiedCode] = useState(false);
  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [dmsCollapsed, setDmsCollapsed] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [huddleActive, setHuddleActive] = useState(false);
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);

  // Module 7: Pinned Messages State
  const [pinnedMessages, setPinnedMessages] = useState<(Message | DirectMessage)[]>([]);
  const [showPinnedDrawer, setShowPinnedDrawer] = useState(false);
  const [loadingPinned, setLoadingPinned] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Module 7: Full-Text Workspace Search State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<'all' | 'messages' | 'files' | 'channels' | 'people'>('all');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Module 7: Notification Center & Sound State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [notificationTab, setNotificationTab] = useState<'all' | 'unread' | 'mentions'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Invite Teammates Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<string | null>(null);
  const [inviteErrorMessage, setInviteErrorMessage] = useState<string | null>(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);

  // Kick / Remove Member State
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);
  const [removeMemberLoading, setRemoveMemberLoading] = useState(false);
  const [removeMemberError, setRemoveMemberError] = useState<string | null>(null);

  // Module 9: Message Editing & Deletion State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  // WebRTC 1-on-1 Audio/Video Calling State
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [callPeer, setCallPeer] = useState<{ id: string; name: string; avatarUrl?: string } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    from: { id: string; name: string; avatarUrl?: string };
    isVideo: boolean;
    signalData: any;
  } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callNotificationMsg, setCallNotificationMsg] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<any[]>([]);
  const callPeerRef = useRef<{ id: string; name: string; avatarUrl?: string } | null>(null);
  const callStatusRef = useRef<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Unread Message Badges State for Channels & Direct Messages
  const [unreadChannels, setUnreadChannels] = useState<Record<string, number>>({});
  const [unreadDirectMessages, setUnreadDirectMessages] = useState<Record<string, number>>({});
  const activeChannelRef = useRef<Channel | null>(null);
  const activeRecipientRef = useRef<ConversationParticipant | null>(null);

  const channelsRef = useRef<Channel[]>(channels);
  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  const membersRef = useRef<WorkspaceMember[]>(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const totalUnreadChannels = useMemo(
    () => Object.values(unreadChannels).reduce((sum, c) => sum + (c || 0), 0),
    [unreadChannels],
  );
  const totalUnreadDMs = useMemo(
    () => Object.values(unreadDirectMessages).reduce((sum, c) => sum + (c || 0), 0),
    [unreadDirectMessages],
  );
  const totalUnreadCount = totalUnreadChannels + totalUnreadDMs;

  // Floating Toast Alert for Messages arriving in other chats
  const [messageToast, setMessageToast] = useState<{
    id: string;
    type: 'channel' | 'dm';
    chatTitle: string;
    senderName: string;
    senderAvatar?: string;
    content: string;
    channel?: Channel;
    senderUser?: ConversationParticipant;
  } | null>(null);
  const messageToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
    if (activeChannel?.id) {
      setUnreadChannels((prev) => ({ ...prev, [activeChannel.id]: 0 }));
    }
  }, [activeChannel]);

  useEffect(() => {
    activeRecipientRef.current = activeRecipient;
    if (activeRecipient?.id) {
      setUnreadDirectMessages((prev) => ({ ...prev, [activeRecipient.id]: 0 }));
    }
  }, [activeRecipient]);

  // Update browser document tab title with unread indicator
  useEffect(() => {
    const baseTitle = currentWs?.name ? `${currentWs.name} - TeamFlow` : 'TeamFlow';
    if (totalUnreadCount > 0) {
      document.title = `(${totalUnreadCount}) 💬 ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [totalUnreadCount, currentWs?.name]);

  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneAudioCtxRef = useRef<any | null>(null);

  // Keyboard shortcut listener (⌘K / Ctrl+K, ⌘F / Ctrl+F and Escape)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowSearchModal(false);
        setShowPinnedDrawer(false);
        setShowNotificationDrawer(false);
        setShowCreateChannelModal(false);
        setShowMembersDrawer(false);
        setShowInviteModal(false);
        setMemberToRemove(null);
        setActiveLightboxImage(null);
        setActiveEmojiPickerFor(null);
        setMentionType(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // New Channel Form
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTopic, setNewChannelTopic] = useState('');
  const [newChannelIsPrivate, setNewChannelIsPrivate] = useState(false);
  const [newChannelSelectedMembers, setNewChannelSelectedMembers] = useState<string[]>([]);
  const [channelCreating, setChannelCreating] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  // Active Channel Members & Management State
  const [activeChannelMembers, setActiveChannelMembers] = useState<ChannelMemberItem[]>([]);
  const [showAddChannelMemberModal, setShowAddChannelMemberModal] = useState(false);
  const [selectedAddUserIds, setSelectedAddUserIds] = useState<string[]>([]);
  const [isAddingChannelMember, setIsAddingChannelMember] = useState(false);
  const [channelMembersTab, setChannelMembersTab] = useState<'channel' | 'workspace'>('channel');
  const [addMemberSearchQuery, setAddMemberSearchQuery] = useState('');

  // Main Message Composer
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hovered message for floating action bar
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // 1. Initial Load: Workspace, Channels, and Members
  useEffect(() => {
    // Wait until AuthProvider has completed reading localStorage
    if (authLoading) return;

    if (!token) {
      router.push('/login');
      return;
    }

    async function loadWorkspace() {
      try {
        setLoading(true);

        const wsRes = await fetch(`${API_URL}/workspaces/${workspaceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!wsRes.ok) throw new Error('Workspace not found');
        const wsData = await wsRes.json();
        setCurrentWs(wsData);
        setCurrentWorkspace(wsData);

        const chRes = await fetch(`${API_URL}/workspaces/${workspaceId}/channels`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (chRes.ok) {
          const chData: Channel[] = await chRes.json();
          setChannels(chData);
          if (chData.length > 0) {
            const generalCh = chData.find((c) => c.name === 'general') || chData[0];
            setActiveChannel(generalCh);
            if (generalCh.members) {
              setActiveChannelMembers(generalCh.members);
            }
          }
        }

        const membersRes = await fetch(`${API_URL}/workspaces/${workspaceId}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setMembers(membersData);
        }
      } catch (err) {
        console.error('Failed to load workspace:', err);
        router.push('/workspaces');
      } finally {
        setLoading(false);
      }
    }

    if (workspaceId) {
      loadWorkspace();
    }
  }, [workspaceId, token, authLoading, router, setCurrentWorkspace]);

  // 2. Load Messages & Socket.IO Realtime Listeners
  useEffect(() => {
    if (!activeChannel || !token) return;

    let isMounted = true;
    const socket = getSocket();

    async function loadMessages() {
      setMessagesLoading(true);
      try {
        const res = await fetch(`${API_URL}/channels/${activeChannel?.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && isMounted) {
          const data: Message[] = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        if (isMounted) setMessagesLoading(false);
      }
    }

    async function loadChannelMembers() {
      try {
        const res = await fetch(`${API_URL}/channels/${activeChannel?.id}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setActiveChannelMembers(data);
        }
      } catch (err) {
        console.error('Failed to load channel members:', err);
      }
    }

    loadMessages();
    loadChannelMembers();
    socket.emit('join_channel', { channelId: activeChannel.id });

    // Handle incoming main channel messages
    function handleNewMessage(msg: Message) {
      if (msg.channelId === activeChannel?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    }

    // Handle thread replies
    function handleNewThreadReply(data: { parentId: string; reply: Message }) {
      // 1. Update parent message replies count in main channel feed
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.parentId) {
            const currentCount = m._count?.replies || 0;
            return {
              ...m,
              _count: { replies: currentCount + 1 },
              replies: [
                {
                  createdAt: data.reply.createdAt,
                  user: {
                    id: data.reply.user.id,
                    name: data.reply.user.name,
                    avatarUrl: data.reply.user.avatarUrl,
                  },
                },
                ...(m.replies || []),
              ].slice(0, 3),
            };
          }
          return m;
        }),
      );

      // 2. If thread drawer is open for this parent, append the reply!
      setActiveThreadParent((currentParent) => {
        if (currentParent && currentParent.id === data.parentId) {
          setThreadReplies((prevReplies) => {
            if (prevReplies.some((r) => r.id === data.reply.id)) return prevReplies;
            return [...prevReplies, data.reply];
          });
          return {
            ...currentParent,
            _count: { replies: (currentParent._count?.replies || 0) + 1 },
          };
        }
        return currentParent;
      });
    }

    // Handle real-time reactions
    function handleReactionUpdated(data: { messageId: string; reactions: Reaction[] }) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.messageId) {
            return { ...m, reactions: data.reactions };
          }
          return m;
        }),
      );

      setActiveThreadParent((parent) => {
        if (parent && parent.id === data.messageId) {
          return { ...parent, reactions: data.reactions };
        }
        return parent;
      });

      setThreadReplies((replies) =>
        replies.map((r) => {
          if (r.id === data.messageId) {
            return { ...r, reactions: data.reactions };
          }
          return r;
        }),
      );
    }

    // Handle typing indicator
    function handleUserTyping(data: { channelId: string; userName: string; isTyping: boolean }) {
      if (data.channelId === activeChannel?.id && data.userName !== user?.name) {
        setTypingUsers((prev) => {
          if (data.isTyping) {
            return prev.includes(data.userName) ? prev : [...prev, data.userName];
          } else {
            return prev.filter((name) => name !== data.userName);
          }
        });
      }
    }

    // Handle real-time message editing & deletion
    function handleMessageUpdated(updated: Message) {
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, ...updated, isEdited: true } : m)),
      );
      setActiveThreadParent((parent) =>
        parent && parent.id === updated.id ? { ...parent, ...updated, isEdited: true } : parent,
      );
      setThreadReplies((replies) =>
        replies.map((r) => (r.id === updated.id ? { ...r, ...updated, isEdited: true } : r)),
      );
    }

    function handleMessageDeleted(data: { messageId: string; channelId?: string; parentId?: string | null }) {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      setActiveThreadParent((parent) => (parent && parent.id === data.messageId ? null : parent));
      setThreadReplies((replies) => replies.filter((r) => r.id !== data.messageId));
      if (data.parentId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.parentId
              ? {
                  ...m,
                  _count: {
                    ...m._count,
                    replies: Math.max(0, (m._count?.replies || 1) - 1),
                  },
                }
              : m,
          ),
        );
      }
    }

    socket.on('new_message', handleNewMessage);
    socket.on('new_thread_reply', handleNewThreadReply);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      isMounted = false;
      socket.emit('leave_channel', { channelId: activeChannel.id });
      socket.off('new_message', handleNewMessage);
      socket.off('new_thread_reply', handleNewThreadReply);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [activeChannel, token, user?.name]);

  // Module 5: Direct Messages Socket & Fetch Effect
  useEffect(() => {
    if (!activeConversation || !token) return;

    const socket = getSocket();
    socket.emit('join_conversation', { conversationId: activeConversation.id });

    function handleNewDirectMessage(msg: DirectMessage) {
      if (msg.conversationId === activeConversation?.id) {
        setDirectMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    }

    function handleDirectReactionUpdated(data: { directMessageId: string; reactions: Reaction[] }) {
      setDirectMessages((prev) =>
        prev.map((m) => (m.id === data.directMessageId ? { ...m, reactions: data.reactions } : m)),
      );
    }

    function handleDirectMessageUpdated(updated: DirectMessage) {
      setDirectMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, ...updated, isEdited: true } : m)),
      );
    }

    function handleDirectMessageDeleted(data: { messageId: string; conversationId?: string }) {
      setDirectMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    }

    socket.on('new_direct_message', handleNewDirectMessage);
    socket.on('direct_reaction_updated', handleDirectReactionUpdated);
    socket.on('direct_message_updated', handleDirectMessageUpdated);
    socket.on('direct_message_deleted', handleDirectMessageDeleted);

    return () => {
      socket.emit('leave_conversation', { conversationId: activeConversation.id });
      socket.off('new_direct_message', handleNewDirectMessage);
      socket.off('direct_reaction_updated', handleDirectReactionUpdated);
      socket.off('direct_message_updated', handleDirectMessageUpdated);
      socket.off('direct_message_deleted', handleDirectMessageDeleted);
    };
  }, [activeConversation, token]);

  // Global Presence Socket Listener
  useEffect(() => {
    const socket = getSocket();

    function handlePresenceUpdated(updatedUser: { id: string; presence: PresenceStatus }) {
      setMembers((prev) =>
        prev.map((m) =>
          m.user.id === updatedUser.id
            ? { ...m, user: { ...m.user, presence: updatedUser.presence } }
            : m,
        ),
      );
      setActiveRecipient((prev) =>
        prev && prev.id === updatedUser.id
          ? { ...prev, presence: updatedUser.presence }
          : prev,
      );
    }

    socket.on('presence_updated', handlePresenceUpdated);

    return () => {
      socket.off('presence_updated', handlePresenceUpdated);
    };
  }, []);

  // Play subtle Slack-like synth chime
  function playNotificationChime() {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      // Audio autoplay may be suppressed before user interaction
    }
  }

  // Keep call refs synchronized with state
  useEffect(() => {
    callPeerRef.current = callPeer;
  }, [callPeer]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // STUN Configuration for WebRTC P2P
  const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  // Ringtone Sounds
  function startOutgoingRingtone() {
    stopRingTone();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ringtoneAudioCtxRef.current = ctx;

      const playBeep = () => {
        if (!ringtoneAudioCtxRef.current) return;
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      };

      playBeep();
      ringtoneIntervalRef.current = setInterval(playBeep, 2400);
    } catch (e) {
      console.warn('Outgoing ringtone error:', e);
    }
  }

  function startIncomingRingtone() {
    stopRingTone();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ringtoneAudioCtxRef.current = ctx;

      const playChime = () => {
        if (!ringtoneAudioCtxRef.current) return;
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.12);
          gain.gain.setValueAtTime(0.09, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.35);
        });
      };

      playChime();
      ringtoneIntervalRef.current = setInterval(playChime, 2500);
    } catch (e) {
      console.warn('Incoming ringtone error:', e);
    }
  }

  function stopRingTone() {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (ringtoneAudioCtxRef.current) {
      try {
        ringtoneAudioCtxRef.current.close();
      } catch (e) {}
      ringtoneAudioCtxRef.current = null;
    }
  }

  // Resilient Media Stream Generation (with Synthetic Fallback for machines without webcam/mic)
  function createSyntheticStream(isVideo: boolean): MediaStream {
    const stream = new MediaStream();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        const dest = audioCtx.createMediaStreamDestination();
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) stream.addTrack(audioTrack);
      }
    } catch (e) {
      console.warn('Synthetic audio creation failed:', e);
    }

    if (isVideo && typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#6366f1';
          ctx.font = 'bold 24px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Live WebRTC Stream', 320, 180);
        }
        const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : null;
        if (canvasStream && canvasStream.getVideoTracks().length > 0) {
          stream.addTrack(canvasStream.getVideoTracks()[0]);
        }
      } catch (e) {
        console.warn('Synthetic video creation failed:', e);
      }
    }

    return stream;
  }

  async function getMediaStream(isVideo: boolean): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Media devices not supported in this browser. Please ensure you are using HTTPS or a modern browser like Chrome/Safari.');
      throw new Error('getUserMedia not supported');
    }

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    try {
      if (isVideo) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: {
              facingMode: 'user',
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
            },
          });
        } catch (videoErr) {
          console.warn('High-definition camera constraint failed, retrying basic video:', videoErr);
          return await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: true,
          });
        }
      } else {
        return await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      }
    } catch (err: any) {
      console.error('Permission denied or media hardware error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert(
          isVideo
            ? 'Camera and Microphone permissions are required to join the video call. Please allow microphone and camera access in your browser or device settings.'
            : 'Microphone permission is required to join the voice call. Please allow microphone access in your browser or device settings.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        alert(
          isVideo
            ? 'No camera or microphone was found on your device.'
            : 'No microphone was found on your device.'
        );
      } else {
        alert(`Could not access media devices: ${err.message || 'Permission or hardware error'}`);
      }
      throw err;
    }
  }

  function cleanupCall(notifyPeer: boolean = true) {
    stopRingTone();
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    pendingCandidatesRef.current = [];

    if (notifyPeer && callPeerRef.current?.id) {
      const socket = getSocket();
      socket.emit('end_call', { toUserId: callPeerRef.current.id });
    }

    setCallStatus('idle');
    setCallPeer(null);
    setIncomingCall(null);
    setCallDuration(0);
    setIsMicMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
  }

  async function handleStartCall(targetUser: { id: string; name: string; avatarUrl?: string }, isVideo: boolean) {
    if (!user) return;
    if (targetUser.id === user.id) {
      alert('You cannot call yourself.');
      return;
    }

    cleanupCall(false);
    setCallPeer(targetUser);
    setCallType(isVideo ? 'video' : 'audio');
    setCallStatus('calling');
    startOutgoingRingtone();

    // Unlock/pre-warm mobile audio pipeline on user touch gesture
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }

    try {
      const stream = await getMediaStream(isVideo);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const socket = getSocket();
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', {
            toUserId: targetUser.id,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('Received remote media track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          remoteStreamRef.current = remoteStream;

          // Dedicated mobile and desktop audio player
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.volume = 1.0;
            remoteAudioRef.current.play().catch((e) => {
              console.warn('remoteAudioRef play error:', e);
            });
          }

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch((e) => {
              console.warn('remoteVideoRef play error:', e);
            });
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call_user', {
        toUserId: targetUser.id,
        caller: {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        isVideo,
        signalData: offer,
      });
    } catch (err) {
      console.error('Failed to initiate call:', err);
      cleanupCall(false);
      setCallNotificationMsg('Could not initiate call (Microphone/Camera permission needed)');
      setTimeout(() => setCallNotificationMsg(null), 4000);
    }
  }

  async function handleAcceptCall() {
    if (!incomingCall || !user) return;
    stopRingTone();

    const caller = incomingCall.from;
    const isVideo = incomingCall.isVideo;
    setCallPeer(caller);
    setCallType(isVideo ? 'video' : 'audio');
    setCallStatus('connected');

    // Unlock/pre-warm mobile audio pipeline on user touch gesture
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }

    try {
      const stream = await getMediaStream(isVideo);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const socket = getSocket();
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', {
            toUserId: caller.id,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('Received remote media track on accept:', event.track.kind);
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          remoteStreamRef.current = remoteStream;

          // Dedicated mobile and desktop audio player
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.volume = 1.0;
            remoteAudioRef.current.play().catch((e) => {
              console.warn('remoteAudioRef play error:', e);
            });
          }

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch((e) => {
              console.warn('remoteVideoRef play error:', e);
            });
          }
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.signalData));

      for (const cand of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer_call', {
        toUserId: caller.id,
        signalData: answer,
      });

      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to accept call:', err);
      cleanupCall(true);
      setCallNotificationMsg('Call cancelled - camera/mic permission not granted');
      setTimeout(() => setCallNotificationMsg(null), 4000);
    }
  }

  function handleDeclineCall() {
    stopRingTone();
    if (incomingCall?.from?.id) {
      const socket = getSocket();
      socket.emit('decline_call', { toUserId: incomingCall.from.id });
    }
    setIncomingCall(null);
    setCallStatus('idle');
  }

  function toggleMic() {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  }

  function toggleCamera() {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  }

  async function toggleScreenShare() {
    if (!peerConnectionRef.current) return;
    try {
      if (!isScreenSharing) {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          alert('Screen sharing is not supported in this browser.');
          return;
        }
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        screenTrack.onended = () => {
          if (localStreamRef.current) {
            const originalVideoTrack = localStreamRef.current.getVideoTracks()[0];
            if (sender && originalVideoTrack) {
              sender.replaceTrack(originalVideoTrack);
            }
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
            }
          }
          setIsScreenSharing(false);
        };
        setIsScreenSharing(true);
      } else {
        const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (localStreamRef.current) {
          const originalVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (sender && originalVideoTrack) {
            sender.replaceTrack(originalVideoTrack);
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        }
        setIsScreenSharing(false);
      }
    } catch (err) {
      console.error('Screen sharing error:', err);
      setIsScreenSharing(false);
    }
  }

  function formatCallDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Bind video element streams on state changes
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [callStatus, isVideoMuted]);

  useEffect(() => {
    if (callStatus === 'connected' && remoteStreamRef.current) {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.play().catch((e) => console.warn('remoteAudio play failed:', e));
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch((e) => console.warn('remoteVideo play failed:', e));
      }
    }
  }, [callStatus]);

  // Global Call Socket Signaling Listener
  useEffect(() => {
    if (!user?.id) return;
    const socket = getSocket();
    socket.emit('join_user', { userId: user.id });

    async function handleIncomingCall(data: {
      from: { id: string; name: string; avatarUrl?: string };
      isVideo: boolean;
      signalData: any;
    }) {
      if (callStatusRef.current !== 'idle') {
        socket.emit('decline_call', { toUserId: data.from.id });
        return;
      }
      setIncomingCall(data);
      setCallPeer(data.from);
      setCallType(data.isVideo ? 'video' : 'audio');
      setCallStatus('incoming');
      startIncomingRingtone();
    }

    async function handleCallAccepted(data: { signalData: any }) {
      stopRingTone();
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signalData));
          for (const cand of pendingCandidatesRef.current) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
          }
          pendingCandidatesRef.current = [];
        } catch (e) {
          console.error('Failed to set remote description on call_accepted:', e);
        }
      }
      setCallStatus('connected');
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    async function handleIceCandidate(data: { candidate: any }) {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn('Error adding ice candidate:', e);
        }
      } else {
        pendingCandidatesRef.current.push(data.candidate);
      }
    }

    function handleCallEnded() {
      cleanupCall(false);
      setCallNotificationMsg('Call ended');
      setTimeout(() => setCallNotificationMsg(null), 3000);
    }

    function handleCallDeclined() {
      stopRingTone();
      cleanupCall(false);
      setCallNotificationMsg('User is busy or declined the call');
      setTimeout(() => setCallNotificationMsg(null), 3000);
    }

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_declined', handleCallDeclined);

    return () => {
      socket.emit('leave_user', { userId: user.id });
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_declined', handleCallDeclined);
    };
  }, [user?.id]);

  // Load Notifications & Unread Count
  useEffect(() => {
    if (!workspaceId || !token || !user) return;

    async function loadNotifications() {
      try {
        const [notifRes, countRes] = await Promise.all([
          fetch(`${API_URL}/workspaces/${workspaceId}/notifications`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/workspaces/${workspaceId}/notifications/unread-count`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (notifRes.ok) {
          const notifs = await notifRes.json();
          setNotifications(notifs);
        }
        if (countRes.ok) {
          const { count } = await countRes.json();
          setUnreadNotificationCount(count);
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    }

    loadNotifications();
  }, [workspaceId, token, user]);

  // Global Notification, Pin & Unread Activity Socket Listener
  useEffect(() => {
    if (!user?.id) return;
    const socket = getSocket();

    socket.emit('join_user', { userId: user.id });
    if (workspaceId) {
      socket.emit('join_workspace', { workspaceId });
    }

    function handleNewNotification(notif: Notification) {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadNotificationCount((prev) => prev + 1);
      playNotificationChime();
    }

    function handleMessagePinned(data: { messageId: string; isPinned: boolean; message: Message }) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? {
                ...m,
                isPinned: data.isPinned,
                pinnedBy: data.message.pinnedBy,
                pinnedAt: data.message.pinnedAt,
              }
            : m,
        ),
      );
      setPinnedMessages((prev) => {
        if (data.isPinned) {
          if (prev.some((m) => m.id === data.messageId)) return prev;
          return [data.message, ...prev];
        } else {
          return prev.filter((m) => m.id !== data.messageId);
        }
      });
    }

    function handleDirectMessagePinned(data: {
      messageId: string;
      isPinned: boolean;
      message: DirectMessage;
    }) {
      setDirectMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? {
                ...m,
                isPinned: data.isPinned,
                pinnedBy: data.message.pinnedBy,
                pinnedAt: data.message.pinnedAt,
              }
            : m,
        ),
      );
      setPinnedMessages((prev) => {
        if (data.isPinned) {
          if (prev.some((m) => m.id === data.messageId)) return prev;
          return [data.message, ...prev];
        } else {
          return prev.filter((m) => m.id !== data.messageId);
        }
      });
    }

    function handleWorkspaceChannelMessage(data: any) {
      const channelId = data?.channelId || data?.channel?.id;
      const msg = data?.message || data;
      if (!channelId || !msg) return;

      // Ignore messages sent by current user
      if (msg.userId === user?.id) return;

      // If user is currently looking at this channel (and not viewing a DM), ignore
      if (activeChannelRef.current?.id === channelId && !activeRecipientRef.current) {
        return;
      }

      setUnreadChannels((prev) => ({
        ...prev,
        [channelId]: (prev[channelId] || 0) + 1,
      }));

      playNotificationChime();

      // Show floating notification banner for the incoming message
      const matchingChannel = channelsRef.current.find((c) => c.id === channelId);
      if (matchingChannel) {
        if (messageToastTimerRef.current) clearTimeout(messageToastTimerRef.current);
        setMessageToast({
          id: msg.id || Date.now().toString(),
          type: 'channel',
          chatTitle: `#${matchingChannel.name}`,
          senderName: msg.user?.name || 'Teammate',
          senderAvatar: msg.user?.avatarUrl,
          content: msg.content || (msg.attachments?.length ? 'Sent an attachment' : 'Sent a message'),
          channel: matchingChannel,
        });
        messageToastTimerRef.current = setTimeout(() => {
          setMessageToast(null);
        }, 4500);
      }
    }

    function handleGlobalDirectMessage(msg: DirectMessage) {
      if (!msg || !msg.userId) return;
      // Ignore messages sent by current user
      if (msg.userId === user?.id) return;

      // If user is currently in direct message chat with this sender:
      if (activeRecipientRef.current?.id === msg.userId) {
        setDirectMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        return;
      }

      setUnreadDirectMessages((prev) => ({
        ...prev,
        [msg.userId]: (prev[msg.userId] || 0) + 1,
      }));

      playNotificationChime();

      // Show floating notification banner for the incoming DM
      const senderMember = membersRef.current.find((m) => m.user.id === msg.userId);
      const senderUser = senderMember?.user || msg.user;
      if (senderUser) {
        if (messageToastTimerRef.current) clearTimeout(messageToastTimerRef.current);
        setMessageToast({
          id: msg.id || Date.now().toString(),
          type: 'dm',
          chatTitle: senderUser.name,
          senderName: senderUser.name,
          senderAvatar: senderUser.avatarUrl,
          content: msg.content || (msg.attachments?.length ? 'Sent an attachment' : 'Sent a direct message'),
          senderUser: senderUser,
        });
        messageToastTimerRef.current = setTimeout(() => {
          setMessageToast(null);
        }, 4500);
      }
    }

    socket.on('new_notification', handleNewNotification);
    socket.on('message_pinned', handleMessagePinned);
    socket.on('direct_message_pinned', handleDirectMessagePinned);
    socket.on('workspace_channel_message', handleWorkspaceChannelMessage);
    socket.on('new_direct_message', handleGlobalDirectMessage);

    return () => {
      if (workspaceId) {
        socket.emit('leave_workspace', { workspaceId });
      }
      socket.emit('leave_user', { userId: user.id });
      socket.off('new_notification', handleNewNotification);
      socket.off('message_pinned', handleMessagePinned);
      socket.off('direct_message_pinned', handleDirectMessagePinned);
      socket.off('workspace_channel_message', handleWorkspaceChannelMessage);
      socket.off('new_direct_message', handleGlobalDirectMessage);
    };
  }, [workspaceId, user?.id, soundEnabled]);

  // Notifications Actions
  async function handleMarkNotificationAsRead(id: string) {
    if (!token) return;
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  }

  async function handleMarkAllNotificationsAsRead() {
    if (!token || !workspaceId) return;
    try {
      await fetch(`${API_URL}/workspaces/${workspaceId}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotificationCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  }

  // Pin / Unpin Actions
  async function handleTogglePinMessage(messageId: string, isDM: boolean) {
    if (!token) return;
    try {
      const endpoint = isDM
        ? `${API_URL}/conversations/${activeConversation?.id}/messages/${messageId}/pin`
        : `${API_URL}/channels/${activeChannel?.id}/messages/${messageId}/pin`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (isDM) {
          setDirectMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    isPinned: data.isPinned,
                    pinnedBy: data.message?.pinnedBy,
                    pinnedAt: data.message?.pinnedAt,
                  }
                : m,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    isPinned: data.isPinned,
                    pinnedBy: data.message?.pinnedBy,
                    pinnedAt: data.message?.pinnedAt,
                  }
                : m,
            ),
          );
        }
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  }

  async function handleLoadPinnedMessages() {
    if (!token) return;
    setLoadingPinned(true);
    setShowPinnedDrawer(true);
    try {
      const endpoint = activeRecipient
        ? `${API_URL}/conversations/${activeConversation?.id}/pins`
        : `${API_URL}/channels/${activeChannel?.id}/pins`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPinnedMessages(data);
      }
    } catch (err) {
      console.error('Failed to load pinned messages:', err);
    } finally {
      setLoadingPinned(false);
    }
  }

  // Module 9: Update Channel / Thread Message
  async function handleUpdateMessage(messageId: string, newContent: string) {
    if (!token || !newContent.trim()) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`${API_URL}/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newContent.trim() }),
      });

      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, ...updated, isEdited: true } : m)),
        );
        setActiveThreadParent((parent) =>
          parent && parent.id === messageId ? { ...parent, ...updated, isEdited: true } : parent,
        );
        setThreadReplies((replies) =>
          replies.map((r) => (r.id === messageId ? { ...r, ...updated, isEdited: true } : r)),
        );
        setEditingMessageId(null);
        setEditingContent('');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to update message');
      }
    } catch (err) {
      console.error('Failed to update message:', err);
    } finally {
      setIsSavingEdit(false);
    }
  }

  // Module 9: Delete Channel / Thread Message
  async function handleDeleteMessage(messageId: string) {
    if (!token) return;
    const confirmed = window.confirm('Are you sure you want to delete this message? This cannot be undone.');
    if (!confirmed) return;

    setDeletingMessageId(messageId);
    try {
      const res = await fetch(`${API_URL}/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({ messageId }));
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        setActiveThreadParent((parent) => (parent && parent.id === messageId ? null : parent));
        setThreadReplies((replies) => replies.filter((r) => r.id !== messageId));
        if (data.parentId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.parentId
                ? {
                    ...m,
                    _count: {
                      ...m._count,
                      replies: Math.max(0, (m._count?.replies || 1) - 1),
                    },
                  }
                : m,
            ),
          );
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to delete message');
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
    } finally {
      setDeletingMessageId(null);
    }
  }

  // Module 9: Update Direct Message
  async function handleUpdateDirectMessage(messageId: string, newContent: string) {
    if (!token || !newContent.trim()) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`${API_URL}/direct-messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newContent.trim() }),
      });

      if (res.ok) {
        const updated = await res.json();
        setDirectMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, ...updated, isEdited: true } : m)),
        );
        setEditingMessageId(null);
        setEditingContent('');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to update message');
      }
    } catch (err) {
      console.error('Failed to update direct message:', err);
    } finally {
      setIsSavingEdit(false);
    }
  }

  // Module 9: Delete Direct Message
  async function handleDeleteDirectMessage(messageId: string) {
    if (!token) return;
    const confirmed = window.confirm('Are you sure you want to delete this message? This cannot be undone.');
    if (!confirmed) return;

    setDeletingMessageId(messageId);
    try {
      const res = await fetch(`${API_URL}/direct-messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setDirectMessages((prev) => prev.filter((m) => m.id !== messageId));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to delete message');
      }
    } catch (err) {
      console.error('Failed to delete direct message:', err);
    } finally {
      setDeletingMessageId(null);
    }
  }

  function handleJumpToMessage(
    messageId: string,
    targetChannelId?: string | null,
    targetConversationId?: string | null,
  ) {
    if (targetChannelId && activeChannel?.id !== targetChannelId) {
      const targetCh = channels.find((c) => c.id === targetChannelId);
      if (targetCh) {
        setActiveChannel(targetCh);
        setActiveRecipient(null);
        setActiveConversation(null);
      }
    } else if (targetConversationId && activeConversation?.id !== targetConversationId) {
      // Find other member in this conversation
      const otherMember = members.find((m) => m.user.id !== user?.id);
      if (otherMember) {
        handleSelectDirectMessage(otherMember.user);
      }
    }

    setShowPinnedDrawer(false);
    setShowSearchModal(false);
    setShowNotificationDrawer(false);

    // Scroll and flash highlight
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId(null), 3000);
      }
    }, 300);
  }

  // Workspace Full-Text Search Handler with live fetch
  useEffect(() => {
    if (!showSearchModal || !workspaceId || !token) return;
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `${API_URL}/workspaces/${workspaceId}/search?q=${encodeURIComponent(
            searchQuery,
          )}&filter=${searchFilter}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data: SearchResult = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Failed to search workspace:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, searchFilter, showSearchModal, workspaceId, token]);

  // 3. Auto-scroll effects
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, directMessages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadReplies]);

  // Invite Teammate Action Handler
  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !token || !workspaceId) return;

    setInviteLoading(true);
    setInviteSuccessMessage(null);
    setInviteErrorMessage(null);

    try {
      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setInviteSuccessMessage(data.message || 'Teammate successfully added!');
        if (data.member) {
          setMembers((prev) => {
            if (prev.some((m) => m.id === data.member.id)) return prev;
            return [...prev, data.member];
          });
        }
        setInviteEmail('');
      } else {
        setInviteErrorMessage(
          data.message || 'Could not add user. Share the invite link or code with them.',
        );
      }
    } catch (err: any) {
      setInviteErrorMessage('Failed to connect to the server.');
    } finally {
      setInviteLoading(false);
    }
  }

  // Remove/Kick Member Action Handler
  async function handleConfirmRemoveMember() {
    if (!memberToRemove || !token || !workspaceId) return;

    setRemoveMemberLoading(true);
    setRemoveMemberError(null);

    try {
      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/members/${memberToRemove.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));

        if (activeRecipient?.id === memberToRemove.user?.id) {
          setActiveRecipient(null);
          setActiveConversation(null);
          if (channels.length > 0) {
            setActiveChannel(channels[0]);
          }
        }

        setMemberToRemove(null);
      } else {
        setRemoveMemberError(data.message || 'Failed to remove member from workspace');
      }
    } catch (err: any) {
      setRemoveMemberError('Failed to connect to the server');
    } finally {
      setRemoveMemberLoading(false);
    }
  }

  // Module 5 Handlers: Direct Messages & Presence
  async function handleSelectDirectMessage(targetUser: ConversationParticipant) {
    if (!token || !user) return;
    setShowMobileSidebar(false);
    setActiveChannel(null);
    setActiveThreadParent(null);
    setActiveRecipient(targetUser);
    setDmLoading(true);

    try {
      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId: targetUser.id }),
      });

      if (res.ok) {
        const convo: Conversation = await res.json();
        setActiveConversation(convo);

        const msgRes = await fetch(`${API_URL}/conversations/${convo.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (msgRes.ok) {
          const msgs: DirectMessage[] = await msgRes.json();
          setDirectMessages(msgs);
        }
      }
    } catch (err) {
      console.error('Failed to open direct conversation:', err);
    } finally {
      setDmLoading(false);
    }
  }

  async function handleSendDirectMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (
      (!inputText.trim() && pendingDMAttachments.length === 0) ||
      !activeConversation ||
      !token ||
      !user
    )
      return;

    const content = inputText.trim();
    const attachmentsToSend =
      pendingDMAttachments.length > 0
        ? pendingDMAttachments.map((att) => ({
            fileName: att.fileName,
            fileUrl: att.fileUrl || (att as any).url,
            fileType: att.fileType,
            fileSize: att.fileSize,
          }))
        : undefined;

    setIsSending(true);

    try {
      const res = await fetch(`${API_URL}/conversations/${activeConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content,
          attachments: attachmentsToSend,
        }),
      });

      if (res.ok) {
        const saved: DirectMessage = await res.json();
        setDirectMessages((prev) => {
          if (prev.some((m) => m.id === saved.id)) return prev;
          return [...prev, saved];
        });
        setInputText('');
        setPendingDMAttachments([]);
        setMentionType(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to send direct message. Please try again.');
      }
    } catch (err) {
      console.error('Failed to send direct message:', err);
      alert('Network error while sending direct message.');
    } finally {
      setIsSending(false);
    }
  }

  async function handleToggleDirectReaction(directMessageId: string, emoji: string) {
    if (!token || !user) return;

    try {
      const res = await fetch(`${API_URL}/conversations/messages/${directMessageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        setDirectMessages((prev) =>
          prev.map((m) => (m.id === directMessageId ? { ...m, reactions: data.reactions } : m)),
        );
      }
    } catch (err) {
      console.error('Failed to toggle direct reaction:', err);
    }
  }

  // File Upload Helpers (Supports any file type and multi-GB file uploads)
  function formatFileSize(bytes: number) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function uploadFile(file: File): Promise<Attachment | null> {
    return new Promise((resolve) => {
      if (!token) {
        resolve(null);
        return;
      }

      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      const startTime = Date.now();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          const elapsed = (Date.now() - startTime) / 1000;
          let speedStr = '';
          if (elapsed > 0.5) {
            const bytesPerSec = event.loaded / elapsed;
            speedStr = `${formatFileSize(bytesPerSec)}/s`;
          }

          setUploadProgress({
            fileName: file.name,
            percent,
            uploadedBytes: event.loaded,
            totalBytes: event.total,
            speed: speedStr,
          });
        }
      };

      xhr.onload = () => {
        setUploadProgress(null);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const normalized: Attachment = {
              id: data.id,
              fileName: data.fileName,
              fileUrl: data.fileUrl || data.url,
              fileType: data.fileType,
              fileSize: data.fileSize,
            };
            resolve(normalized);
          } catch (e) {
            console.error('Error parsing upload response:', e);
            resolve(null);
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            alert(err.message || 'File upload failed');
          } catch {
            alert(`File upload failed with status ${xhr.status}`);
          }
          resolve(null);
        }
      };

      xhr.onerror = () => {
        setUploadProgress(null);
        alert('File transfer failed due to a network connection error.');
        resolve(null);
      };

      xhr.onabort = () => {
        setUploadProgress(null);
        resolve(null);
      };

      xhr.open('POST', `${API_URL}/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  }

  async function handleChannelFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    for (let i = 0; i < files.length; i++) {
      const uploaded = await uploadFile(files[i]);
      if (uploaded) {
        setPendingAttachments((prev) => [...prev, uploaded]);
      }
    }
    setIsUploading(false);
  }

  async function handleDMFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsUploadingDM(true);
    for (let i = 0; i < files.length; i++) {
      const uploaded = await uploadFile(files[i]);
      if (uploaded) {
        setPendingDMAttachments((prev) => [...prev, uploaded]);
      }
    }
    setIsUploadingDM(false);
  }

  async function handleThreadFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsUploadingThread(true);
    for (let i = 0; i < files.length; i++) {
      const uploaded = await uploadFile(files[i]);
      if (uploaded) {
        setPendingThreadAttachments((prev) => [...prev, uploaded]);
      }
    }
    setIsUploadingThread(false);
  }

  async function handleUpdatePresence(newPresence: PresenceStatus) {
    if (!token || !user) return;
    setUserPresence(newPresence);
    setShowPresenceMenu(false);

    try {
      await fetch(`${API_URL}/users/presence`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ presence: newPresence }),
      });
    } catch (err) {
      console.error('Failed to update presence:', err);
    }
  }

  // 4. Open Thread Drawer
  async function openThread(parentMessage: Message) {
    if (!token) return;
    setActiveThreadParent(parentMessage);
    setShowMembersDrawer(false);
    setThreadLoading(true);

    try {
      const res = await fetch(`${API_URL}/messages/${parentMessage.id}/thread`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveThreadParent(data.parent);
        setThreadReplies(data.replies);
      }
    } catch (err) {
      console.error('Failed to load thread:', err);
    } finally {
      setThreadLoading(false);
    }
  }

  // 5. Send Thread Reply
  async function handleSendThreadReply(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (
      (!threadInputText.trim() && pendingThreadAttachments.length === 0) ||
      !activeThreadParent ||
      !activeChannel ||
      !token
    )
      return;

    const content = threadInputText.trim();
    const attachmentsToSend =
      pendingThreadAttachments.length > 0
        ? pendingThreadAttachments.map((att) => ({
            fileName: att.fileName,
            fileUrl: att.fileUrl || (att as any).url,
            fileType: att.fileType,
            fileSize: att.fileSize,
          }))
        : undefined;

    setIsSendingThreadReply(true);

    const socket = getSocket();

    try {
      const res = await fetch(`${API_URL}/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content,
          parentId: activeThreadParent.id,
          attachments: attachmentsToSend,
        }),
      });

      if (res.ok) {
        const replyMsg: Message = await res.json();
        setThreadReplies((prev) => {
          if (prev.some((r) => r.id === replyMsg.id)) return prev;
          return [...prev, replyMsg];
        });
        setThreadInputText('');
        setPendingThreadAttachments([]);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to send thread reply. Please try again.');
      }
    } catch (err) {
      console.error('Failed to send thread reply:', err);
      alert('Network error while sending thread reply.');
    } finally {
      setIsSendingThreadReply(false);
    }
  }

  // 6. Toggle Emoji Reaction
  async function handleToggleReaction(messageId: string, emoji: string) {
    if (!token || !user) return;

    try {
      const res = await fetch(`${API_URL}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m)),
        );
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  }

  // Send main message handler
  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (
      (!inputText.trim() && pendingAttachments.length === 0) ||
      !activeChannel ||
      !token ||
      !user
    )
      return;

    const content = inputText.trim();
    const attachmentsToSend =
      pendingAttachments.length > 0
        ? pendingAttachments.map((att) => ({
            fileName: att.fileName,
            fileUrl: att.fileUrl || (att as any).url,
            fileType: att.fileType,
            fileSize: att.fileSize,
          }))
        : undefined;

    setIsSending(true);

    const socket = getSocket();
    socket.emit('typing', { channelId: activeChannel.id, userName: user.name, isTyping: false });

    try {
      const res = await fetch(`${API_URL}/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content,
          attachments: attachmentsToSend,
        }),
      });

      if (res.ok) {
        const savedMsg: Message = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === savedMsg.id)) return prev;
          return [...prev, savedMsg];
        });
        setInputText('');
        setPendingAttachments([]);
        setMentionType(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to send message. Please try again.');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Network error while sending message.');
    } finally {
      setIsSending(false);
    }
  }

  // Typing debounce & Mention Detection
  function handleInputChange(
    e: React.ChangeEvent<HTMLTextAreaElement>,
    target: 'channel' | 'dm' = 'channel',
  ) {
    const val = e.target.value;
    setInputText(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBefore = val.slice(0, cursorPos);
    const lastAt = textBefore.lastIndexOf('@');
    const lastHash = textBefore.lastIndexOf('#');

    if (lastAt !== -1 && lastAt >= textBefore.lastIndexOf(' ')) {
      const q = textBefore.slice(lastAt + 1);
      setMentionType('user');
      setMentionQuery(q);
      setMentionTarget(target);
    } else if (lastHash !== -1 && lastHash >= textBefore.lastIndexOf(' ')) {
      const q = textBefore.slice(lastHash + 1);
      setMentionType('channel');
      setMentionQuery(q);
      setMentionTarget(target);
    } else {
      setMentionType(null);
      setMentionQuery('');
    }

    if (target === 'channel' && activeChannel && user) {
      const socket = getSocket();
      socket.emit('typing', { channelId: activeChannel.id, userName: user.name, isTyping: true });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', { channelId: activeChannel.id, userName: user.name, isTyping: false });
      }, 1800);
    }
  }

  function handleInsertMention(textToInsert: string) {
    if (!mentionType) return;
    const prefix = mentionType === 'user' ? '@' : '#';
    const lastTrigger = inputText.lastIndexOf(prefix);
    if (lastTrigger !== -1) {
      const before = inputText.slice(0, lastTrigger);
      const after = inputText.slice(lastTrigger + 1 + mentionQuery.length);
      setInputText(`${before}${prefix}${textToInsert} ${after}`);
    } else {
      setInputText((prev) => `${prev} ${prefix}${textToInsert} `);
    }
    setMentionType(null);
    setMentionQuery('');
  }

  function handleSwitchChannelByName(channelName: string) {
    const target = channels.find((c) => c.name.toLowerCase() === channelName.toLowerCase());
    if (target) {
      setActiveChannel(target);
      setActiveConversation(null);
      setActiveRecipient(null);
      setActiveThreadParent(null);
    }
  }

  // Create Channel
  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!newChannelName.trim() || !token) return;

    setChannelCreating(true);
    setChannelError(null);

    try {
      const formattedName = newChannelName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '');

      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formattedName,
          topic: newChannelTopic.trim() || undefined,
          isPrivate: newChannelIsPrivate,
          memberIds: newChannelSelectedMembers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create channel');
      }

      setChannels((prev) => [...prev, data]);
      setActiveChannel(data);
      if (data.members) {
        setActiveChannelMembers(data.members);
      }
      setShowCreateChannelModal(false);
      setNewChannelName('');
      setNewChannelTopic('');
      setNewChannelIsPrivate(false);
      setNewChannelSelectedMembers([]);
    } catch (err) {
      setChannelError(err instanceof Error ? err.message : 'Error creating channel');
    } finally {
      setChannelCreating(false);
    }
  }

  // Add members to active channel
  async function handleAddMembersToChannel() {
    if (!activeChannel || !token || selectedAddUserIds.length === 0) return;
    setIsAddingChannelMember(true);
    try {
      for (const targetUserId of selectedAddUserIds) {
        await fetch(`${API_URL}/channels/${activeChannel.id}/members`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: targetUserId }),
        });
      }
      // Reload channel members
      const res = await fetch(`${API_URL}/channels/${activeChannel.id}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveChannelMembers(data);
        setChannels((prev) =>
          prev.map((c) =>
            c.id === activeChannel.id
              ? {
                  ...c,
                  members: data,
                  _count: {
                    ...c._count,
                    messages: c._count?.messages || 0,
                    members: data.length,
                  },
                }
              : c
          )
        );
      }
      setShowAddChannelMemberModal(false);
      setSelectedAddUserIds([]);
      setAddMemberSearchQuery('');
    } catch (err) {
      console.error('Failed to add members to channel:', err);
    } finally {
      setIsAddingChannelMember(false);
    }
  }

  // Remove member from active channel
  async function handleRemoveChannelMember(targetUserId: string) {
    if (!activeChannel || !token) return;
    try {
      const res = await fetch(`${API_URL}/channels/${activeChannel.id}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActiveChannelMembers((prev) => prev.filter((m) => m.user.id !== targetUserId));
        setChannels((prev) =>
          prev.map((c) =>
            c.id === activeChannel.id
              ? {
                  ...c,
                  members: c.members?.filter((m) => m.user.id !== targetUserId),
                  _count: {
                    ...c._count,
                    messages: c._count?.messages || 0,
                    members: Math.max(0, (c._count?.members || 1) - 1),
                  },
                }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to remove member from channel:', err);
    }
  }

  function copyInviteCode() {
    if (!currentWs) return;
    navigator.clipboard.writeText(currentWs.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function copyInviteLink() {
    if (typeof window === 'undefined' || !currentWs) return;
    const origin = window.location.origin;
    const inviteUrl = `${origin}/workspaces?join=${currentWs.joinCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInviteLink(true);
    setTimeout(() => setCopiedInviteLink(false), 2500);
  }

  const isWorkspaceOwner =
    currentWs?.owner?.id === user?.id ||
    currentWs?.ownerId === user?.id ||
    members.some((m) => m.user?.id === user?.id && m.role === 'OWNER');

  // Format message text with @mentions, #channels, inline code, and code blocks
  function renderMessageContent(content: string) {
    if (!content) return null;

    // Check if message contains code blocks (```...```)
    if (content.includes('```')) {
      const parts = content.split(/(```[\s\S]*?```)/g);
      return (
        <div className="space-y-1">
          {parts.map((part, pIdx) => {
            if (part.startsWith('```') && part.endsWith('```')) {
              return <CodeBlockView key={pIdx} content={part} />;
            }
            if (!part.trim()) return null;
            return (
              <div key={pIdx}>
                {renderFormattedParagraph(part)}
              </div>
            );
          })}
        </div>
      );
    }

    return renderFormattedParagraph(content);
  }

  function renderFormattedParagraph(text: string) {
    const tokens = text.split(/(\s+)/);

    return (
      <p className="text-[14px] leading-relaxed text-slate-800 whitespace-pre-wrap font-normal selection:bg-indigo-500 selection:text-white">
        {tokens.map((token, i) => {
          // Inline code check: `code`
          if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
            const innerCode = token.slice(1, -1);
            return (
              <code
                key={i}
                className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-100 text-indigo-700 font-mono text-[12px] border border-slate-200/80 font-medium select-all"
              >
                {innerCode}
              </code>
            );
          }

          if (token.startsWith('@') && token.length > 1) {
            const cleanName = token.slice(1).replace(/[.,!?]+$/, '');
            const punctuation = token.slice(1 + cleanName.length);
            const isMe = user?.name && user.name.toLowerCase().includes(cleanName.toLowerCase());

            return (
              <React.Fragment key={i}>
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold text-xs transition-colors ${
                    isMe
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-2xs'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100/70'
                  }`}
                >
                  @{cleanName}
                </span>
                {punctuation}
              </React.Fragment>
            );
          }

          if (token.startsWith('#') && token.length > 1) {
            const cleanChannel = token.slice(1).replace(/[.,!?]+$/, '');
            const punctuation = token.slice(1 + cleanChannel.length);
            const channelExists = channels.some((c) => c.name.toLowerCase() === cleanChannel.toLowerCase());

            return (
              <React.Fragment key={i}>
                <button
                  type="button"
                  onClick={() => channelExists && handleSwitchChannelByName(cleanChannel)}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold text-xs transition-colors ${
                    channelExists
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 cursor-pointer'
                      : 'text-indigo-600 font-medium'
                  }`}
                >
                  #{cleanChannel}
                </button>
                {punctuation}
              </React.Fragment>
            );
          }

          return <span key={i}>{token}</span>;
        })}
      </p>
    );
  }

  // File Category Helper for Any Type of Shared Files
  function getFileCategory(fileType: string, fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (
      fileType.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)
    ) {
      return 'image';
    }
    if (
      fileType.startsWith('video/') ||
      ['mp4', 'mov', 'mkv', 'webm', 'avi', 'wmv', 'flv'].includes(ext)
    ) {
      return 'video';
    }
    if (
      fileType.startsWith('audio/') ||
      ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)
    ) {
      return 'audio';
    }
    if (['pdf'].includes(ext) || fileType === 'application/pdf') {
      return 'pdf';
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso', 'dmg', 'tgz'].includes(ext)) {
      return 'archive';
    }
    if (
      [
        'js',
        'ts',
        'tsx',
        'jsx',
        'py',
        'json',
        'html',
        'css',
        'scss',
        'cpp',
        'c',
        'java',
        'go',
        'rs',
        'php',
        'sh',
        'sql',
        'yaml',
        'yml',
        'xml',
      ].includes(ext)
    ) {
      return 'code';
    }
    return 'generic';
  }

  // Render message file & media attachments (Any format & any size up to GBs)
  function renderAttachments(attachments?: Attachment[]) {
    if (!attachments || attachments.length === 0) return null;

    return (
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        {attachments.map((att, idx) => {
          const category = getFileCategory(att.fileType, att.fileName);
          const fullUrl = att.fileUrl.startsWith('http')
            ? att.fileUrl
            : `${API_URL.replace('/api', '')}${att.fileUrl}`;
          const downloadUrl = `${API_URL}/upload/download/${att.fileUrl.split('/').pop()}?name=${encodeURIComponent(
            att.fileName,
          )}`;

          if (category === 'image') {
            return (
              <div
                key={idx}
                onClick={() =>
                  setActiveLightboxImage({
                    url: fullUrl,
                    fileName: att.fileName,
                    fileSize: att.fileSize,
                  })
                }
                className="group/img relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50 max-w-xs shadow-xs hover:shadow-md transition-all hover:scale-[1.01]"
              >
                <img
                  src={fullUrl}
                  alt={att.fileName}
                  className="max-h-56 w-auto object-cover rounded-2xl transition-transform group-hover/img:scale-105"
                />
                <div className="absolute inset-0 bg-slate-900/0 group-hover/img:bg-slate-900/30 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                  <div className="p-2 rounded-xl bg-white/90 backdrop-blur-sm text-slate-800 shadow-md flex items-center gap-1.5 text-xs font-semibold">
                    <Maximize2 className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Expand</span>
                  </div>
                </div>
              </div>
            );
          }

          if (category === 'video') {
            return (
              <div
                key={idx}
                className="rounded-2xl overflow-hidden border border-slate-200/90 bg-slate-900 max-w-md shadow-sm group/video"
              >
                <video
                  src={fullUrl}
                  controls
                  preload="metadata"
                  className="max-h-72 w-full object-contain bg-black"
                />
                <div className="p-2.5 bg-slate-900/95 text-white flex items-center justify-between text-xs border-t border-slate-800">
                  <div className="flex items-center gap-2 truncate mr-2">
                    <Film className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span className="font-bold truncate text-slate-100">{att.fileName}</span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      ({formatFileSize(att.fileSize)})
                    </span>
                  </div>
                  <a
                    href={downloadUrl}
                    download={att.fileName}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors shrink-0"
                    title="Download video"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </div>
            );
          }

          if (category === 'audio') {
            return (
              <div
                key={idx}
                className="p-3 rounded-2xl border border-slate-200/90 bg-white max-w-sm shadow-xs"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 truncate">
                    <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <Music className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 truncate">{att.fileName}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {formatFileSize(att.fileSize)}
                  </span>
                </div>
                <audio src={fullUrl} controls preload="metadata" className="w-full h-8" />
              </div>
            );
          }

          // Dynamic styling based on file category
          const styleConfig =
            category === 'pdf'
              ? {
                  badge: 'PDF',
                  badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
                  iconBox:
                    'bg-rose-50 border-rose-100 text-rose-600 group-hover/file:bg-rose-600',
                  Icon: FileText,
                }
              : category === 'archive'
              ? {
                  badge: att.fileName.split('.').pop()?.toUpperCase() || 'ARCHIVE',
                  badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
                  iconBox:
                    'bg-amber-50 border-amber-100 text-amber-600 group-hover/file:bg-amber-600',
                  Icon: Archive,
                }
              : category === 'code'
              ? {
                  badge: 'CODE',
                  badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  iconBox:
                    'bg-emerald-50 border-emerald-100 text-emerald-600 group-hover/file:bg-emerald-600',
                  Icon: FileCode,
                }
              : {
                  badge: att.fileName.split('.').pop()?.toUpperCase() || 'FILE',
                  badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                  iconBox:
                    'bg-indigo-50 border-indigo-100 text-indigo-600 group-hover/file:bg-indigo-600',
                  Icon: File,
                };

          const CardIcon = styleConfig.Icon;

          return (
            <a
              key={idx}
              href={downloadUrl}
              download={att.fileName}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200/90 bg-white hover:bg-slate-50 transition-all shadow-xs hover:shadow-sm max-w-sm group/file"
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${styleConfig.iconBox} group-hover/file:text-white`}
              >
                <CardIcon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-xs font-bold text-slate-900 truncate group-hover/file:text-indigo-600 transition-colors">
                    {att.fileName}
                  </p>
                  <span
                    className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase tracking-wider shrink-0 ${styleConfig.badgeColor}`}
                  >
                    {styleConfig.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium font-mono">
                  {formatFileSize(att.fileSize)}
                </p>
              </div>
              <div className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0">
                <Download className="h-4 w-4" />
              </div>
            </a>
          );
        })}
      </div>
    );
  }

  const EMOJI_CATEGORIES = {
    popular: ['👍', '❤️', '🔥', '🚀', '🎉', '👀', '💯', '👏', '🎯', '✨'],
    smileys: ['😀', '😂', '😍', '🥳', '😎', '🤔', '🙌', '🤩', '😴', '🤯', '😇', '😋'],
    work: ['✅', '⭐', '💡', '📌', '💻', '☕', '⚡', '🏆', '🔒', '📊', '📝', '🤝'],
  };

  function formatTimestamp(dateString: string) {
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function groupReactions(reactions?: Reaction[]) {
    if (!reactions || reactions.length === 0) return [];
    const map = new Map<string, { emoji: string; count: number; users: string[]; userHasReacted: boolean }>();

    for (const r of reactions) {
      const existing = map.get(r.emoji) || {
        emoji: r.emoji,
        count: 0,
        users: [],
        userHasReacted: false,
      };
      existing.count += 1;
      existing.users.push(r.user.name);
      if (r.userId === user?.id) {
        existing.userHasReacted = true;
      }
      map.set(r.emoji, existing);
    }

    return Array.from(map.values());
  }

  if (authLoading || loading || !currentWs || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC] text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />
            <Loader2 className="h-6 w-6 animate-spin text-white absolute inset-0 m-auto" />
          </div>
          <p className="text-xs text-slate-500 font-medium tracking-wide">Launching TeamFlow Workspace...</p>
        </div>
      </div>
    );
  }

  // Filtered lists for Command Palette
  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(commandPaletteQuery.toLowerCase()),
  );
  const filteredMembers = members.filter((m) =>
    m.user.name.toLowerCase().includes(commandPaletteQuery.toLowerCase()),
  );

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#F8FAFC] text-slate-900 antialiased font-sans select-none relative">
      {/* Mobile Backdrop Overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-30 md:hidden animate-in fade-in duration-200"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. UNIFIED STUDIO NAVIGATION SIDEBAR (Linear / Notion caliber)
      ───────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white flex flex-col shrink-0 border-r border-slate-200/80 shadow-2xl md:shadow-[2px_0_12px_rgba(0,0,0,0.02)] md:static md:translate-x-0 transition-transform duration-300 ease-in-out select-none ${
          showMobileSidebar ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Workspace Hub & Switcher Header */}
        <div className="p-3 border-b border-slate-100 relative">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowWorkspaceSwitcher(!showWorkspaceSwitcher)}
              className="flex-1 flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100/80 transition-all text-left min-w-0 group"
              title="Switch Workspace"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-600 text-white font-black text-sm shadow-md shadow-indigo-600/25 group-hover:scale-105 transition-transform">
                {currentWs.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-extrabold text-slate-900 text-sm tracking-tight truncate flex items-center gap-1.5">
                  <span className="truncate">{currentWs.name}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${showWorkspaceSwitcher ? 'rotate-180 text-indigo-600' : ''}`} />
                </span>
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
                  {isWorkspaceOwner && (
                    <span className="text-[9px] font-bold uppercase text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-200/80">
                      Owner
                    </span>
                  )}
                </span>
              </div>
            </button>

            {isWorkspaceOwner && (
              <button
                onClick={copyInviteCode}
                title="Copy Workspace Invite Code"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 transition-all shadow-subtle active:scale-95"
              >
                {copiedCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}

            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setShowMobileSidebar(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 md:hidden transition-colors shrink-0"
              title="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Workspace Switcher Popover */}
          {showWorkspaceSwitcher && (
            <div className="absolute top-full left-3 right-3 mt-1.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-2 z-50 animate-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-100 mb-1">
                <span>Switch Workspace</span>
                <span className="font-mono text-slate-400 font-normal">{workspaces.length} total</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {workspaces.map((ws) => {
                  const isActive = ws.id === currentWs.id;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setShowWorkspaceSwitcher(false);
                        router.push(`/workspace/${ws.id}`);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 shadow-2xs font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {ws.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate">{ws.name}</span>
                      </div>
                      {isActive && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 px-1">
                <Link
                  href="/workspaces"
                  onClick={() => setShowWorkspaceSwitcher(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>All Workspaces</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Global Spotlight Search Trigger inside Sidebar */}
        <div className="px-3 pt-3">
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-300 text-xs text-slate-500 hover:text-slate-800 transition-all shadow-subtle group"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              <span className="truncate font-medium">Search workspace...</span>
            </div>
            <kbd className="font-mono text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 font-bold shadow-2xs shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 no-scrollbar text-xs">
          {/* Quick Smart Views */}
          <div className="space-y-0.5">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium transition-all group"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>Command Switcher</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 font-bold">⌘K</span>
            </button>
          </div>

          {/* SPACES & CHANNELS */}
          <div>
            <div className="flex items-center justify-between px-2 py-1 text-slate-400 hover:text-slate-700 group">
              <button
                onClick={() => setChannelsCollapsed(!channelsCollapsed)}
                className="flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider text-slate-400 hover:text-slate-800 transition-colors"
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    channelsCollapsed ? '-rotate-90' : ''
                  }`}
                />
                <span>Channels ({channels.length})</span>
                {totalUnreadChannels > 0 && channelsCollapsed && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-[9px] font-bold text-white shadow-2xs">
                    {totalUnreadChannels}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowCreateChannelModal(true)}
                title="Create new channel"
                className="p-1 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {!channelsCollapsed && (
              <div className="space-y-0.5 mt-1">
                {channels.map((ch) => {
                  const isActive = activeChannel?.id === ch.id && !activeRecipient;
                  const unreadCount = unreadChannels[ch.id] || 0;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        setShowMobileSidebar(false);
                        setActiveChannel(ch);
                        setActiveRecipient(null);
                        setActiveConversation(null);
                        setActiveThreadParent(null);
                        setUnreadChannels((prev) => ({ ...prev, [ch.id]: 0 }));
                      }}
                      className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 font-medium text-xs transition-all text-left group ${
                        isActive
                          ? 'bg-indigo-50/90 text-indigo-900 font-bold border border-indigo-200/80 shadow-2xs'
                          : unreadCount > 0
                          ? 'bg-indigo-50/60 text-slate-900 font-bold border border-indigo-100 hover:bg-indigo-50'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-md shrink-0 ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : unreadCount > 0
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/70'
                          }`}
                        >
                          {ch.isPrivate ? (
                            <Lock className="h-2.5 w-2.5 text-amber-500" />
                          ) : (
                            <Hash className="h-3 w-3" />
                          )}
                        </div>
                        <span className={`truncate ${unreadCount > 0 && !isActive ? 'font-bold text-slate-900' : ''}`}>{ch.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {unreadCount > 0 && !isActive && (
                          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-[10px] font-black text-white shadow-xs animate-pulse">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                        {isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shadow-xs shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}

                <button
                  onClick={() => setShowCreateChannelModal(true)}
                  className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  <span>Create channel</span>
                </button>
              </div>
            )}
          </div>

          {/* DIRECT MESSAGES */}
          <div>
            <div className="flex items-center justify-between px-2 py-1 text-slate-400 hover:text-slate-700 group">
              <button
                onClick={() => setDmsCollapsed(!dmsCollapsed)}
                className="flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider text-slate-400 hover:text-slate-800 transition-colors"
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    dmsCollapsed ? '-rotate-90' : ''
                  }`}
                />
                <span>Direct Messages ({members.length})</span>
                {totalUnreadDMs > 0 && dmsCollapsed && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-600 text-[9px] font-bold text-white shadow-2xs">
                    {totalUnreadDMs}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-0.5">
                {isWorkspaceOwner && (
                  <button
                    onClick={() => {
                      setInviteErrorMessage(null);
                      setInviteSuccessMessage(null);
                      setShowInviteModal(true);
                    }}
                    title="Invite teammates"
                    className="p-1 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setShowMembersDrawer(true)}
                  title="View all workspace members"
                  className="p-1 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
                >
                  <Users className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {!dmsCollapsed && (
              <div className="space-y-0.5 mt-1">
                {members.map((m) => {
                  const isDmActive = activeRecipient?.id === m.user.id;
                  const isMe = m.user.id === user?.id;
                  const unreadCount = unreadDirectMessages[m.user.id] || 0;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        handleSelectDirectMessage(m.user);
                        setUnreadDirectMessages((prev) => ({ ...prev, [m.user.id]: 0 }));
                      }}
                      className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition-all group ${
                        isDmActive
                          ? 'bg-indigo-50/90 border border-indigo-200/80 text-indigo-900 font-bold shadow-2xs'
                          : unreadCount > 0
                          ? 'bg-emerald-50/80 border border-emerald-200/80 font-bold text-slate-900 shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={m.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                            alt={m.user.name}
                            className="h-6 w-6 rounded-lg border border-slate-200 object-cover"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-white ${
                              m.user.presence === 'AWAY'
                                ? 'bg-amber-400'
                                : m.user.presence === 'OFFLINE'
                                ? 'bg-slate-300'
                                : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                        <span className={`truncate text-xs ${unreadCount > 0 && !isDmActive ? 'font-bold text-slate-900' : 'font-medium'}`}>
                          {m.user.name} {isMe && <span className="text-[10px] text-slate-400 font-normal">(you)</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {unreadCount > 0 && !isDmActive && (
                          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-emerald-600 text-[10px] font-black text-white shadow-xs animate-pulse">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                        {m.role === 'OWNER' && !unreadCount && (
                          <span className="text-[9px] font-bold text-indigo-700 uppercase bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200/80 shrink-0">
                            Owner
                          </span>
                        )}
                        {!isMe && (
                          <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                            <span
                              role="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartCall(m.user, false);
                              }}
                              className="p-1 hover:bg-emerald-100 text-slate-400 hover:text-emerald-700 rounded-md transition-colors"
                              title={`Voice call ${m.user.name}`}
                            >
                              <Phone className="h-3 w-3" />
                            </span>
                            <span
                              role="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartCall(m.user, true);
                              }}
                              className="p-1 hover:bg-indigo-100 text-slate-400 hover:text-indigo-700 rounded-md transition-colors"
                              title={`Video call ${m.user.name}`}
                            >
                              <Video className="h-3 w-3" />
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}

                {isWorkspaceOwner && (
                  <button
                    onClick={() => {
                      setInviteErrorMessage(null);
                      setInviteSuccessMessage(null);
                      setShowInviteModal(true);
                    }}
                    className="w-full mt-2 flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium transition-all group border border-dashed border-indigo-200"
                  >
                    <div className="h-5 w-5 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Plus className="h-3 w-3" />
                    </div>
                    <span>Add teammates</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Unified Sidebar Footer: User Profile, Presence Popover & Settings */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60 relative">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowPresenceMenu(!showPresenceMenu)}
              className="flex-1 flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white hover:shadow-2xs transition-all text-left min-w-0"
              title="Change status or sign out"
            >
              <div className="relative shrink-0">
                <img
                  src={user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                  alt={user.name}
                  className="h-8 w-8 rounded-xl border border-slate-200 object-cover shadow-2xs"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                    userPresence === 'AWAY'
                      ? 'bg-amber-400'
                      : userPresence === 'OFFLINE'
                      ? 'bg-slate-300'
                      : 'bg-emerald-500'
                  }`}
                />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-bold text-xs text-slate-800 truncate">{user.name}</span>
                <span className="text-[10px] text-slate-400 truncate flex items-center gap-1 font-medium">
                  <span className={`h-1.5 w-1.5 rounded-full ${userPresence === 'AWAY' ? 'bg-amber-400' : userPresence === 'OFFLINE' ? 'bg-slate-300' : 'bg-emerald-500'}`} />
                  <span>{userPresence === 'AWAY' ? 'Away' : userPresence === 'OFFLINE' ? 'Offline' : 'Active'}</span>
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* User Presence Menu Popover */}
          {showPresenceMenu && (
            <div className="absolute bottom-full left-3 right-3 mb-2 rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-2 z-50 text-xs animate-in slide-in-from-bottom-2 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="font-bold text-slate-900 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate font-mono">{user.email}</p>
              </div>

              <div className="space-y-0.5 py-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1 block">
                  Set My Status
                </span>
                <button
                  onClick={() => {
                    handleUpdatePresence('ONLINE');
                    setShowPresenceMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition-colors ${
                    userPresence === 'ONLINE'
                      ? 'bg-emerald-50 text-emerald-800 font-bold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>🟢 Active (Online)</span>
                </button>
                <button
                  onClick={() => {
                    handleUpdatePresence('AWAY');
                    setShowPresenceMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition-colors ${
                    userPresence === 'AWAY'
                      ? 'bg-amber-50 text-amber-800 font-bold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>🟡 Away</span>
                </button>
                <button
                  onClick={() => {
                    handleUpdatePresence('OFFLINE');
                    setShowPresenceMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition-colors ${
                    userPresence === 'OFFLINE'
                      ? 'bg-slate-100 text-slate-800 font-bold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  <span>⚪ Invisible</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          2. FOCUSED CHAT WORKSPACE & CANVAS
      ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col bg-[#FAFBFC] min-w-0 text-slate-900 relative overflow-hidden">
        {/* Unified Canvas Header (Channel/DM Context + Live Controls - Always 1 single row) */}
        <header className="h-16 px-3 sm:px-6 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl flex items-center justify-between shrink-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex-nowrap whitespace-nowrap overflow-x-auto no-scrollbar gap-2 sm:gap-4">
          {/* Mobile hamburger menu button */}
          <button
            type="button"
            onClick={() => setShowMobileSidebar(true)}
            className="relative p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden transition-colors shrink-0"
            title="Open channels & messages"
            aria-label="Open channels and messages"
          >
            <Menu className="h-5 w-5" />
            {totalUnreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600 ring-2 ring-white"></span>
              </span>
            )}
          </button>

          {activeRecipient ? (
            <div className="flex items-center gap-3 min-w-0 shrink">
              <div className="relative shrink-0">
                <img
                  src={activeRecipient.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                  alt={activeRecipient.name}
                  className="h-9 w-9 rounded-xl border border-slate-200 object-cover shadow-2xs"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                    activeRecipient.presence === 'AWAY'
                      ? 'bg-amber-400'
                      : activeRecipient.presence === 'OFFLINE'
                      ? 'bg-slate-300'
                      : 'bg-emerald-500'
                  }`}
                />
              </div>
              <div className="flex flex-col min-w-0 justify-center">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-base tracking-tight leading-tight shrink-0">
                    {activeRecipient.name}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                      activeRecipient.presence === 'AWAY'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : activeRecipient.presence === 'OFFLINE'
                        ? 'bg-slate-100 text-slate-600 border border-slate-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {activeRecipient.presence === 'AWAY'
                      ? 'Away'
                      : activeRecipient.presence === 'OFFLINE'
                      ? 'Offline'
                      : 'Active now'}
                  </span>
                </div>
                <span
                  className="text-xs text-slate-400 truncate max-w-xs md:max-w-md font-mono leading-tight mt-0.5"
                  title={activeRecipient.email}
                >
                  {activeRecipient.email}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0 shrink">
              <button
                onClick={() => setIsStarred(!isStarred)}
                className="text-slate-400 hover:text-amber-500 transition-colors p-1 shrink-0"
                title="Star channel"
              >
                <Star
                  className={`h-4 w-4 ${
                    isStarred ? 'fill-amber-400 text-amber-500' : 'text-slate-400'
                  }`}
                />
              </button>

              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 shrink-0">
                  {activeChannel?.isPrivate ? (
                    <Lock className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Hash className="h-4.5 w-4.5" />
                  )}
                </div>
                <div className="flex flex-col min-w-0 justify-center">
                  <span className="font-black text-slate-900 text-base tracking-tight leading-tight shrink-0">
                    {activeChannel?.name}
                  </span>
                  {activeChannel?.topic && (
                    <span
                      className="text-xs text-slate-500 truncate max-w-sm md:max-w-md lg:max-w-xl font-normal leading-tight mt-0.5"
                      title={activeChannel.topic}
                    >
                      {activeChannel.topic}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Header Right Actions & Live Controls - Always 1 single row */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 1-on-1 Audio / Video Call Controls for DM */}
            {activeRecipient && (
              <>
                <button
                  type="button"
                  onClick={() => handleStartCall(activeRecipient, false)}
                  className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200/80 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-slate-700 transition-all shadow-subtle shrink-0 whitespace-nowrap"
                  title={`Start voice call with ${activeRecipient.name}`}
                >
                  <Phone className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="hidden sm:inline font-bold">Voice Call</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartCall(activeRecipient, true)}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 text-indigo-700 p-2 sm:px-3 sm:py-1.5 text-xs font-bold transition-all shadow-subtle shrink-0 whitespace-nowrap"
                  title={`Start video call with ${activeRecipient.name}`}
                >
                  <Video className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span className="hidden sm:inline font-bold">Video Call</span>
                </button>
              </>
            )}

            {/* Audio Huddle Button with Live Waves */}
            {!activeRecipient && (
              <button
                onClick={() => setHuddleActive(!huddleActive)}
              className={`flex items-center gap-1.5 sm:gap-2 rounded-xl p-2 sm:px-3 sm:py-1.5 text-xs font-bold border transition-all shadow-subtle shrink-0 whitespace-nowrap ${
                huddleActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 hover:border-slate-300'
              }`}
              title="Toggle Audio Huddle"
            >
              <Headphones className={`h-3.5 w-3.5 ${huddleActive ? 'text-emerald-600' : 'text-indigo-600'} shrink-0`} />
              <span className="hidden sm:inline">{huddleActive ? 'Huddle Live' : 'Start Huddle'}</span>
              {huddleActive && (
                <span className="flex items-center gap-0.5 ml-1">
                  <span className="h-2 w-0.5 bg-emerald-500 animate-pulse" />
                  <span className="h-3 w-0.5 bg-emerald-500 animate-pulse delay-75" />
                  <span className="h-1.5 w-0.5 bg-emerald-500 animate-pulse delay-150" />
                </span>
              )}
            </button>
          )}

            {/* Pinned Messages Button */}
            <button
              onClick={handleLoadPinnedMessages}
              className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/50 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-slate-700 hover:text-amber-800 transition-all shadow-subtle shrink-0 whitespace-nowrap"
              title="View pinned messages"
            >
              <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />
              <span className="hidden sm:inline">
                {activeRecipient
                  ? directMessages.filter((m) => m.isPinned).length
                  : messages.filter((m) => m.isPinned).length}{' '}
                Pinned
              </span>
            </button>

            {!activeRecipient && activeChannel && isWorkspaceOwner && (
              <button
                onClick={() => {
                  setSelectedAddUserIds([]);
                  setAddMemberSearchQuery('');
                  setShowAddChannelMemberModal(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100/80 hover:border-indigo-300 p-2 sm:px-3 sm:py-1.5 text-xs font-bold text-indigo-700 transition-all shadow-subtle shrink-0 whitespace-nowrap"
                title="Add people to this channel"
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Add People</span>
              </button>
            )}

            <button
              onClick={() => {
                setChannelMembersTab('channel');
                setShowMembersDrawer(!showMembersDrawer);
              }}
              className="flex items-center gap-1.5 sm:gap-2 rounded-xl bg-white border border-slate-200/80 hover:bg-slate-50 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-slate-700 transition-all shadow-subtle shrink-0 whitespace-nowrap"
              title="View channel members"
            >
              <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                {(activeRecipient
                  ? members
                  : !activeChannel?.isPrivate
                  ? members
                  : activeChannelMembers.length > 0
                  ? activeChannelMembers
                  : members
                )
                  .slice(0, 4)
                  .map((m: any, idx: number) => (
                    <img
                      key={idx}
                      className="inline-block h-5 w-5 rounded-md ring-1 ring-white object-cover"
                      src={m.user?.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                      alt={m.user?.name || 'Member'}
                    />
                  ))}
              </div>
              <span className="hidden sm:inline">
                {activeRecipient
                  ? `${members.length} ${members.length === 1 ? 'member' : 'members'}`
                  : !activeChannel?.isPrivate
                  ? `${members.length} ${members.length === 1 ? 'member' : 'members'}`
                  : `${activeChannelMembers.length || members.length} ${
                      (activeChannelMembers.length || members.length) === 1 ? 'member' : 'members'
                    }`}
              </span>
            </button>

            <span className="h-4 w-[1px] bg-slate-200 shrink-0" />

            {/* Audio Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs transition-all shadow-subtle shrink-0 ${
                soundEnabled
                  ? 'bg-slate-100/80 hover:bg-slate-200/70 border-slate-200/80 text-slate-600 hover:text-slate-900'
                  : 'bg-rose-50 border-rose-200 text-rose-500'
              }`}
              title={soundEnabled ? 'Chime sound enabled (Click to mute)' : 'Chime sound muted (Click to enable)'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* Notifications Center Bell */}
            <button
              onClick={() => setShowNotificationDrawer(true)}
              className="relative p-2 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 text-slate-600 hover:text-indigo-600 transition-all shadow-subtle shrink-0"
              title="Activity & Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white ring-2 ring-white animate-pulse">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>

            {/* Live Sync Status Pill */}
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50/90 border border-emerald-200/80 px-3 py-1 text-[11px] font-bold text-emerald-700 shadow-subtle shrink-0 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Sync</span>
            </div>
          </div>
        </header>

          {/* Main Feed + Thread Split */}
          <div className="flex-1 flex overflow-hidden">
            {activeRecipient ? (
              <div className="flex-1 flex flex-col justify-between overflow-hidden bg-white">
                {/* Direct Message Feed Stream */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-3">
                  {/* Direct Message Start Hero Card */}
                  <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-slate-50 border border-slate-200/80 mb-6 shadow-xs">
                    <div className="relative inline-block mb-3">
                      <img
                        src={activeRecipient.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                        alt={activeRecipient.name}
                        className="h-14 w-14 rounded-2xl border border-slate-200 object-cover shadow-md"
                      />
                      <span
                        className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-white ${
                          activeRecipient.presence === 'AWAY'
                            ? 'bg-amber-400'
                            : activeRecipient.presence === 'OFFLINE'
                            ? 'bg-slate-300'
                            : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      {activeRecipient.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 max-w-xl leading-relaxed">
                      This is the start of your 1-on-1 direct conversation with <strong>{activeRecipient.name}</strong>. Messages sent here are private and only visible between the two of you.
                    </p>
                  </div>

                  {/* Direct Messages List */}
                  {dmLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                    </div>
                  ) : directMessages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      No direct messages yet. Say hello to {activeRecipient.name.split(' ')[0]}! 👋
                    </div>
                  ) : (
                    directMessages.map((msg, index) => {
                      const prevMsg = directMessages[index - 1];
                      const isConsecutive =
                        prevMsg &&
                        prevMsg.userId === msg.userId &&
                        new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() <
                          5 * 60 * 1000;

                      const groupedDMReactions = groupReactions(msg.reactions);

                      return (
                        <div
                          key={msg.id}
                          id={`msg-${msg.id}`}
                          onMouseEnter={() => setHoveredMessageId(msg.id)}
                          onMouseLeave={() => setHoveredMessageId(null)}
                          className={`group relative flex items-start gap-3.5 rounded-2xl px-4 py-2 -mx-2 hover:bg-slate-50/90 transition-all ${
                            isConsecutive ? 'mt-0.5' : 'mt-2.5'
                          } ${
                            highlightedMessageId === msg.id
                              ? 'ring-2 ring-indigo-500 bg-indigo-50/70 shadow-md scale-[1.01]'
                              : ''
                          }`}
                        >
                          {/* Floating Action Bar for DM */}
                          {hoveredMessageId === msg.id && (
                            <div className="absolute right-4 -top-3.5 z-10 flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur-md px-2 py-1 shadow-lg text-slate-600">
                              {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleDirectReaction(msg.id, emoji)}
                                  className="p-1 hover:bg-slate-100 rounded-lg text-xs transition-transform hover:scale-125"
                                  title={`React ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                              <button
                                onClick={() => setActiveEmojiPickerFor({ messageId: msg.id, isDM: true })}
                                className="p-1 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-500 text-xs transition-colors"
                                title="More reactions"
                              >
                                <Smile className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-[1px] h-3 bg-slate-200 mx-0.5" />
                              <button
                                onClick={() => handleTogglePinMessage(msg.id, true)}
                                className={`p-1 rounded-lg text-xs transition-colors ${
                                  msg.isPinned
                                    ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                    : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                                }`}
                                title={msg.isPinned ? 'Unpin message' : 'Pin to conversation'}
                              >
                                <Pin className={`h-3.5 w-3.5 ${msg.isPinned ? 'fill-amber-400 text-amber-600' : ''}`} />
                              </button>

                              {/* Edit & Delete Actions for Author */}
                              {(msg.userId === user?.id || msg.user?.id === user?.id) && (
                                <>
                                  <span className="w-[1px] h-3 bg-slate-200 mx-0.5" />
                                  <button
                                    onClick={() => {
                                      setEditingMessageId(msg.id);
                                      setEditingContent(msg.content);
                                    }}
                                    className="p-1 hover:bg-slate-100 hover:text-indigo-600 rounded-lg text-slate-500 text-xs transition-colors"
                                    title="Edit message"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDirectMessage(msg.id)}
                                    className="p-1 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-500 text-xs transition-colors"
                                    title="Delete message"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                          {!isConsecutive ? (
                            <div className="relative shrink-0 mt-0.5">
                              <img
                                src={msg.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                                alt={msg.user.name}
                                className="h-10 w-10 rounded-xl border border-slate-200 object-cover shadow-2xs"
                              />
                            </div>
                          ) : (
                            <div className="w-10 shrink-0 text-right pr-2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 select-none">
                              {formatTimestamp(msg.createdAt)}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            {msg.isPinned && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50/90 border border-amber-200/90 px-2.5 py-0.5 rounded-lg w-fit mb-1 shadow-2xs">
                                <Pin className="h-3 w-3 fill-amber-500 text-amber-600" />
                                <span>Pinned by {msg.pinnedBy?.name || 'user'}</span>
                              </div>
                            )}

                            {!isConsecutive && (
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-[14px] text-slate-900 tracking-tight">
                                  {msg.user.name}
                                </span>
                                <span className="text-[11px] text-slate-400 font-normal">
                                  {formatTimestamp(msg.createdAt)}
                                </span>
                                {msg.isEdited && (
                                  <span className="text-[10px] text-slate-400 italic font-normal" title="Edited message">
                                    (edited)
                                  </span>
                                )}
                              </div>
                            )}

                            {editingMessageId === msg.id ? (
                              <div className="mt-1.5 rounded-xl border border-indigo-300 bg-white p-2.5 shadow-sm">
                                <textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleUpdateDirectMessage(msg.id, editingContent);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setEditingMessageId(null);
                                      setEditingContent('');
                                    }
                                  }}
                                  rows={3}
                                  autoFocus
                                  className="w-full resize-none text-[14px] text-slate-900 bg-transparent focus:outline-none leading-relaxed"
                                />
                                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                                  <span className="text-[11px] text-slate-400">
                                    <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono border border-slate-200">Enter</kbd> to save • <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono border border-slate-200">Esc</kbd> to cancel
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMessageId(null);
                                        setEditingContent('');
                                      }}
                                      disabled={isSavingEdit}
                                      className="px-2.5 py-1 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateDirectMessage(msg.id, editingContent)}
                                      disabled={isSavingEdit || !editingContent.trim()}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 shadow-2xs"
                                    >
                                      {isSavingEdit ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                                        </>
                                      ) : (
                                        'Save Changes'
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              msg.content && (
                                <div className="text-[14px] text-slate-800 leading-relaxed">
                                  {renderMessageContent(msg.content)}
                                  {isConsecutive && msg.isEdited && (
                                    <span className="ml-1 text-[10px] text-slate-400 italic select-none">
                                      (edited)
                                    </span>
                                  )}
                                </div>
                              )
                            )}

                            {/* Render Attachments */}
                            {renderAttachments(msg.attachments)}

                            {/* Reaction Pills for DM */}
                            {groupedDMReactions.length > 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {groupedDMReactions.map((r) => (
                                  <button
                                    key={r.emoji}
                                    onClick={() => handleToggleDirectReaction(msg.id, r.emoji)}
                                    title={`${r.users.join(', ')} reacted with ${r.emoji}`}
                                    className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-0.5 text-xs font-semibold border transition-all ${
                                      r.userHasReacted
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/60'
                                    }`}
                                  >
                                    <span>{r.emoji}</span>
                                    <span>{r.count}</span>
                                  </button>
                                ))}

                                <button
                                  onClick={() => setActiveEmojiPickerFor({ messageId: msg.id, isDM: true })}
                                  className="inline-flex items-center justify-center h-6 w-6 rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 text-slate-500 hover:text-indigo-600 text-xs transition-colors"
                                  title="Add reaction"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Floating Direct Message Composer */}
                <div className="px-3 sm:px-6 pb-3 sm:pb-6 pt-1 relative">
                  {/* Mention Autocomplete Dropdown for DM */}
                  {mentionType && mentionTarget === 'dm' && (
                    <div className="absolute left-3 right-3 sm:left-6 sm:right-6 bottom-[100%] mb-2 z-30 max-h-56 overflow-y-auto rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 flex items-center justify-between">
                        <span>{mentionType === 'user' ? 'Mention Member' : 'Mention Space / Channel'}</span>
                        <span>esc to dismiss</span>
                      </div>
                      {mentionType === 'user' ? (
                        members
                          .filter((m) => m.user.name.toLowerCase().includes(mentionQuery.toLowerCase()))
                          .map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleInsertMention(m.user.name)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-indigo-50/70 hover:text-indigo-900 transition-colors text-slate-700"
                            >
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={m.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                                  alt={m.user.name}
                                  className="h-6 w-6 rounded-lg border border-slate-200 object-cover"
                                />
                                <span className="font-bold text-slate-900">{m.user.name}</span>
                              </div>
                              <span className="text-[10px] text-indigo-500 font-medium">@{m.user.name}</span>
                            </button>
                          ))
                      ) : (
                        channels
                          .filter((c) => c.name.toLowerCase().includes(mentionQuery.toLowerCase()))
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleInsertMention(c.name)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-emerald-50/70 hover:text-emerald-900 transition-colors text-slate-700"
                            >
                              <div className="flex items-center gap-2">
                                <Hash className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="font-bold text-slate-900">{c.name}</span>
                              </div>
                              <span className="text-[10px] text-emerald-600 font-medium">#{c.name}</span>
                            </button>
                          ))
                      )}
                    </div>
                  )}

                  <form
                    onSubmit={handleSendDirectMessage}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingOverDM(true);
                    }}
                    onDragLeave={() => setIsDraggingOverDM(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingOverDM(false);
                      handleDMFileUpload(e.dataTransfer.files);
                    }}
                    className={`rounded-2xl border bg-white shadow-xl shadow-slate-200/60 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all overflow-hidden ${
                      isDraggingOverDM ? 'border-dashed border-2 border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20' : 'border-slate-200/90'
                    }`}
                  >
                    <input
                      type="file"
                      ref={dmFileInputRef}
                      onChange={(e) => handleDMFileUpload(e.target.files)}
                      className="hidden"
                      multiple
                    />

                    {/* Pending Attachments preview in DM composer */}
                    {pendingDMAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 px-4 pt-3 pb-2 border-b border-slate-100 bg-slate-50/50">
                        {pendingDMAttachments.map((att, idx) => {
                          const cat = getFileCategory(att.fileType, att.fileName);
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs group"
                            >
                              {cat === 'image' ? (
                                <ImageIcon className="h-3.5 w-3.5 text-indigo-600" />
                              ) : cat === 'video' ? (
                                <Film className="h-3.5 w-3.5 text-indigo-600" />
                              ) : cat === 'audio' ? (
                                <Music className="h-3.5 w-3.5 text-purple-600" />
                              ) : cat === 'archive' ? (
                                <Archive className="h-3.5 w-3.5 text-amber-600" />
                              ) : cat === 'code' ? (
                                <FileCode className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <FileText className="h-3.5 w-3.5 text-indigo-600" />
                              )}
                              <span className="font-semibold text-slate-800 max-w-[140px] truncate">{att.fileName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(att.fileSize)})</span>
                              <button
                                type="button"
                                onClick={() => setPendingDMAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-0.5 hover:bg-rose-50 hover:text-rose-600 rounded text-slate-400 transition-colors ml-0.5"
                                title="Remove file"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Real-Time Live Multi-GB Upload Progress Bar */}
                    {uploadProgress && (
                      <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-slate-50 border-b border-indigo-100/90 text-xs animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-slate-700 mb-1.5">
                          <div className="flex items-center gap-2 truncate mr-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 shrink-0" />
                            <span className="font-bold text-slate-900 truncate">{uploadProgress.fileName}</span>
                            <span className="text-[11px] text-slate-500 shrink-0 font-mono">
                              ({formatFileSize(uploadProgress.uploadedBytes)} / {formatFileSize(uploadProgress.totalBytes)})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                            {uploadProgress.speed && (
                              <span className="text-indigo-600 font-semibold">{uploadProgress.speed}</span>
                            )}
                            <span className="font-extrabold text-slate-900">{uploadProgress.percent}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-200/90 h-2 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 h-full rounded-full transition-all duration-150 ease-out"
                            style={{ width: `${uploadProgress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1 px-3.5 py-1.5 border-b border-slate-100 bg-slate-50/80 text-slate-500 text-xs">
                      <button
                        type="button"
                        onClick={() => setInputText((prev) => prev + '**bold text**')}
                        className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-700 transition-colors"
                        title="Bold"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputText((prev) => prev + '*italic text*')}
                        className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-700 transition-colors"
                        title="Italic"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputText((prev) => prev + '\n```\n// code snippet\n```\n')}
                        className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-700 transition-colors"
                        title="Code Block"
                      >
                        <Code className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <textarea
                      value={inputText}
                      onChange={(e) => handleInputChange(e, 'dm')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendDirectMessage();
                        }
                      }}
                      placeholder={`Direct message ${activeRecipient.name}... (Enter to send, Shift+Enter for new line)`}
                      rows={2}
                      className="w-full resize-none px-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                    />

                    <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-100 bg-slate-50/40">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <button
                          type="button"
                          onClick={() => setInputText((prev) => prev + ' 👋')}
                          className="p-1.5 hover:bg-slate-200/70 rounded-lg hover:text-slate-800 transition-colors"
                          title="Say wave"
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInputText((prev) => prev + '@');
                            setMentionType('user');
                            setMentionTarget('dm');
                          }}
                          className="p-1.5 hover:bg-slate-200/70 rounded-lg hover:text-slate-800 transition-colors"
                          title="Mention someone"
                        >
                          <AtSign className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => dmFileInputRef.current?.click()}
                          className="p-1.5 hover:bg-slate-200/70 rounded-lg hover:text-slate-800 transition-colors"
                          title="Attach File or Image"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                          Return to send
                        </span>
                        <button
                          type="submit"
                          disabled={isSending || (!inputText.trim() && pendingDMAttachments.length === 0)}
                          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                            inputText.trim() || pendingDMAttachments.length > 0
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/25 hover:scale-105 active:scale-95'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                          title="Send Message"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between overflow-hidden bg-white">
                {/* Message Feed Stream */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-3">
                  {/* Modern Start-Of-Channel Hero */}
                  <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-slate-50 border border-slate-200/80 mb-6 shadow-xs">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white mb-3 shadow-md shadow-indigo-600/20">
                      <Hash className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      Welcome to #{activeChannel?.name}!
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 max-w-2xl leading-relaxed">
                      {activeChannel?.topic ||
                        `This channel is the dedicated collaborative space for #${activeChannel?.name}. Share messages, reply in threads, or react with emojis.`}
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={() => setShowMembersDrawer(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        <Users className="h-3.5 w-3.5 text-indigo-600" />
                        <span>View members</span>
                      </button>
                      {isWorkspaceOwner && (
                        <button
                          onClick={copyInviteCode}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          <Copy className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Copy invite code</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages Stream */}
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      No messages in this space yet. Say hello to your team! 👋
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      const prevMsg = messages[index - 1];
                      const isConsecutive =
                        prevMsg &&
                        prevMsg.userId === msg.userId &&
                        new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() <
                          5 * 60 * 1000;

                      const groupedReactions = groupReactions(msg.reactions);
                      const repliesCount = msg._count?.replies || 0;

                      const isMentioned =
                        user?.name &&
                        msg.content.toLowerCase().includes('@' + user.name.toLowerCase());

                      return (
                        <div
                          key={msg.id}
                          id={`msg-${msg.id}`}
                          onMouseEnter={() => setHoveredMessageId(msg.id)}
                          onMouseLeave={() => setHoveredMessageId(null)}
                          className={`group relative flex items-start gap-3.5 rounded-2xl px-4 py-2 -mx-2 hover:bg-slate-50/90 transition-all ${
                            isConsecutive ? 'mt-0.5' : 'mt-2.5'
                          } ${
                            highlightedMessageId === msg.id
                              ? 'ring-2 ring-indigo-500 bg-indigo-50/70 shadow-md scale-[1.01]'
                              : activeThreadParent?.id === msg.id
                              ? 'bg-indigo-50/60 border border-indigo-200/90'
                              : isMentioned
                              ? 'bg-amber-50/30 border-l-4 border-l-amber-500 shadow-2xs'
                              : ''
                          }`}
                        >
                          {/* Modern Floating Action Bar */}
                          {hoveredMessageId === msg.id && (
                            <div className="absolute right-4 -top-3.5 z-10 flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur-md px-2 py-1 shadow-lg text-slate-600">
                              {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className="p-1 hover:bg-slate-100 rounded-lg text-xs transition-transform hover:scale-125"
                                  title={`React ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                              <button
                                onClick={() => setActiveEmojiPickerFor({ messageId: msg.id, isDM: false })}
                                className="p-1 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-500 text-xs transition-colors"
                                title="More reactions"
                              >
                                <Smile className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-[1px] h-3 bg-slate-200 mx-0.5" />
                              <button
                                onClick={() => handleTogglePinMessage(msg.id, false)}
                                className={`p-1 rounded-lg text-xs transition-colors ${
                                  msg.isPinned
                                    ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                    : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                                }`}
                                title={msg.isPinned ? 'Unpin message' : 'Pin to channel'}
                              >
                                <Pin className={`h-3.5 w-3.5 ${msg.isPinned ? 'fill-amber-400 text-amber-600' : ''}`} />
                              </button>
                              <span className="w-[1px] h-3 bg-slate-200 mx-0.5" />
                              <button
                                onClick={() => openThread(msg)}
                                className="p-1 hover:bg-indigo-600 hover:text-white rounded-lg text-slate-700 flex items-center gap-1 text-xs transition-colors"
                                title="Reply in thread"
                              >
                                <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                                <span className="text-[11px] font-semibold hidden sm:inline">Reply</span>
                              </button>

                              {/* Edit & Delete Actions for Author or Workspace Owner */}
                              {(msg.userId === user?.id || msg.user?.id === user?.id) && (
                                <>
                                  <span className="w-[1px] h-3 bg-slate-200 mx-0.5" />
                                  <button
                                    onClick={() => {
                                      setEditingMessageId(msg.id);
                                      setEditingContent(msg.content);
                                    }}
                                    className="p-1 hover:bg-slate-100 hover:text-indigo-600 rounded-lg text-slate-500 text-xs transition-colors"
                                    title="Edit message"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              {(msg.userId === user?.id || msg.user?.id === user?.id || isWorkspaceOwner) && (
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="p-1 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-500 text-xs transition-colors"
                                  title="Delete message"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Avatar Squircle / Timestamp */}
                          {!isConsecutive ? (
                            <div className="relative shrink-0 mt-0.5">
                              <img
                                src={msg.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                                alt={msg.user.name}
                                className="h-10 w-10 rounded-xl border border-slate-200 object-cover shadow-2xs"
                              />
                              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                            </div>
                          ) : (
                            <div className="w-10 shrink-0 text-right pr-2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 select-none">
                              {formatTimestamp(msg.createdAt)}
                            </div>
                          )}

                          {/* Message Content */}
                          <div className="flex-1 min-w-0">
                            {msg.isPinned && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50/90 border border-amber-200/90 px-2.5 py-0.5 rounded-lg w-fit mb-1 shadow-2xs">
                                <Pin className="h-3 w-3 fill-amber-500 text-amber-600" />
                                <span>Pinned by {msg.pinnedBy?.name || 'team member'}</span>
                              </div>
                            )}

                            {!isConsecutive && (
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-[14px] text-slate-900 hover:underline cursor-pointer tracking-tight">
                                  {msg.user.name}
                                </span>
                                <span className="text-[11px] text-slate-400 font-normal">
                                  {formatTimestamp(msg.createdAt)}
                                </span>
                                {msg.isEdited && (
                                  <span className="text-[10px] text-slate-400 italic font-normal" title="Edited message">
                                    (edited)
                                  </span>
                                )}
                                {isMentioned && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    <Sparkles className="h-2.5 w-2.5 text-amber-700" /> Mentioned you
                                  </span>
                                )}
                              </div>
                            )}

                            {editingMessageId === msg.id ? (
                              <div className="mt-1.5 rounded-xl border border-indigo-300 bg-white p-2.5 shadow-sm">
                                <textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleUpdateMessage(msg.id, editingContent);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setEditingMessageId(null);
                                      setEditingContent('');
                                    }
                                  }}
                                  rows={3}
                                  autoFocus
                                  className="w-full resize-none text-[14px] text-slate-900 bg-transparent focus:outline-none leading-relaxed"
                                />
                                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                                  <span className="text-[11px] text-slate-400">
                                    <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono border border-slate-200">Enter</kbd> to save • <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono border border-slate-200">Esc</kbd> to cancel
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMessageId(null);
                                        setEditingContent('');
                                      }}
                                      disabled={isSavingEdit}
                                      className="px-2.5 py-1 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateMessage(msg.id, editingContent)}
                                      disabled={isSavingEdit || !editingContent.trim()}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 shadow-2xs"
                                    >
                                      {isSavingEdit ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                                        </>
                                      ) : (
                                        'Save Changes'
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              msg.content && (
                                <div className="text-[14px] text-slate-800 leading-relaxed">
                                  {renderMessageContent(msg.content)}
                                  {isConsecutive && msg.isEdited && (
                                    <span className="ml-1 text-[10px] text-slate-400 italic select-none">
                                      (edited)
                                    </span>
                                  )}
                                </div>
                              )
                            )}

                            {/* Render Attachments */}
                            {renderAttachments(msg.attachments)}

                            {/* Reaction Pills */}
                            {groupedReactions.length > 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {groupedReactions.map((r) => (
                                  <button
                                    key={r.emoji}
                                    onClick={() => handleToggleReaction(msg.id, r.emoji)}
                                    title={`${r.users.join(', ')} reacted with ${r.emoji}`}
                                    className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-0.5 text-xs font-semibold border transition-all ${
                                      r.userHasReacted
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/60'
                                    }`}
                                  >
                                    <span>{r.emoji}</span>
                                    <span>{r.count}</span>
                                  </button>
                                ))}

                                <button
                                  onClick={() => setActiveEmojiPickerFor({ messageId: msg.id, isDM: false })}
                                  className="inline-flex items-center justify-center h-6 w-6 rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 text-slate-500 hover:text-indigo-600 text-xs transition-colors"
                                  title="Add reaction"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            )}

                            {/* Connected Thread Preview Pill */}
                            {repliesCount > 0 && (
                              <div className="mt-2.5">
                                <button
                                  onClick={() => openThread(msg)}
                                  className="group/pill inline-flex items-center gap-2.5 rounded-xl py-1 px-3 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200/90 transition-all shadow-2xs"
                                >
                                  {msg.replies && msg.replies.length > 0 && (
                                    <div className="flex -space-x-1.5 overflow-hidden">
                                      {msg.replies.map((reply, idx) => (
                                        <img
                                          key={idx}
                                          src={reply.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                                          alt={reply.user.name}
                                          className="inline-block h-4.5 w-4.5 rounded-full ring-1 ring-white"
                                        />
                                      ))}
                                    </div>
                                  )}
                                  <span>{repliesCount} {repliesCount === 1 ? 'reply' : 'replies'}</span>
                                  <span className="text-[11px] text-slate-500 font-normal">
                                    View discussion
                                  </span>
                                  <ChevronRight className="h-3 w-3 text-indigo-600 group-hover/pill:translate-x-0.5 transition-transform" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Typing Indicator */}
                <div className="px-3 sm:px-6 h-5 flex items-center text-xs text-indigo-600 font-medium italic">
                  {typingUsers.length > 0 && (
                    <span className="flex items-center gap-1.5 animate-pulse">
                      <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
                    </span>
                  )}
                </div>

                {/* Modern Floating Glass Message Composer */}
                <div className="px-3 sm:px-6 pb-3 sm:pb-6 pt-1 relative">
                  {/* Mention Autocomplete Dropdown for Channel */}
                  {mentionType && mentionTarget === 'channel' && (
                    <div className="absolute left-3 right-3 sm:left-6 sm:right-6 bottom-[100%] mb-2 z-30 max-h-56 overflow-y-auto rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 flex items-center justify-between">
                        <span>{mentionType === 'user' ? 'Mention Member' : 'Mention Space / Channel'}</span>
                        <span>esc to dismiss</span>
                      </div>
                      {mentionType === 'user' ? (
                        members
                          .filter((m) => m.user.name.toLowerCase().includes(mentionQuery.toLowerCase()))
                          .map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleInsertMention(m.user.name)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-indigo-50/70 hover:text-indigo-900 transition-colors text-slate-700"
                            >
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={m.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                                  alt={m.user.name}
                                  className="h-6 w-6 rounded-lg border border-slate-200 object-cover"
                                />
                                <span className="font-bold text-slate-900">{m.user.name}</span>
                              </div>
                              <span className="text-[10px] text-indigo-500 font-medium">@{m.user.name}</span>
                            </button>
                          ))
                      ) : (
                        channels
                          .filter((c) => c.name.toLowerCase().includes(mentionQuery.toLowerCase()))
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleInsertMention(c.name)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-emerald-50/70 hover:text-emerald-900 transition-colors text-slate-700"
                            >
                              <div className="flex items-center gap-2">
                                <Hash className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="font-bold text-slate-900">{c.name}</span>
                              </div>
                              <span className="text-[10px] text-emerald-600 font-medium">#{c.name}</span>
                            </button>
                          ))
                      )}
                    </div>
                  )}

                  <form
                    onSubmit={handleSendMessage}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingOverChannel(true);
                    }}
                    onDragLeave={() => setIsDraggingOverChannel(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingOverChannel(false);
                      handleChannelFileUpload(e.dataTransfer.files);
                    }}
                    className={`rounded-2xl border bg-white shadow-xl shadow-slate-200/60 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all overflow-hidden ${
                      isDraggingOverChannel ? 'border-dashed border-2 border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20' : 'border-slate-200/90'
                    }`}
                  >
                    <input
                      type="file"
                      ref={channelFileInputRef}
                      onChange={(e) => handleChannelFileUpload(e.target.files)}
                      className="hidden"
                      multiple
                    />

                    {/* Pending Attachments preview */}
                    {pendingAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 px-4 pt-3 pb-2 border-b border-slate-100 bg-slate-50/50">
                        {pendingAttachments.map((att, idx) => {
                          const cat = getFileCategory(att.fileType, att.fileName);
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs group"
                            >
                              {cat === 'image' ? (
                                <ImageIcon className="h-3.5 w-3.5 text-indigo-600" />
                              ) : cat === 'video' ? (
                                <Film className="h-3.5 w-3.5 text-indigo-600" />
                              ) : cat === 'audio' ? (
                                <Music className="h-3.5 w-3.5 text-purple-600" />
                              ) : cat === 'archive' ? (
                                <Archive className="h-3.5 w-3.5 text-amber-600" />
                              ) : cat === 'code' ? (
                                <FileCode className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <FileText className="h-3.5 w-3.5 text-indigo-600" />
                              )}
                              <span className="font-semibold text-slate-800 max-w-[140px] truncate">{att.fileName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(att.fileSize)})</span>
                              <button
                                type="button"
                                onClick={() => setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-0.5 hover:bg-rose-50 hover:text-rose-600 rounded text-slate-400 transition-colors ml-0.5"
                                title="Remove file"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Real-Time Live Multi-GB Upload Progress Bar */}
                    {uploadProgress && (
                      <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-slate-50 border-b border-indigo-100/90 text-xs animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-slate-700 mb-1.5">
                          <div className="flex items-center gap-2 truncate mr-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 shrink-0" />
                            <span className="font-bold text-slate-900 truncate">{uploadProgress.fileName}</span>
                            <span className="text-[11px] text-slate-500 shrink-0 font-mono">
                              ({formatFileSize(uploadProgress.uploadedBytes)} / {formatFileSize(uploadProgress.totalBytes)})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                            {uploadProgress.speed && (
                              <span className="text-indigo-600 font-semibold">{uploadProgress.speed}</span>
                            )}
                            <span className="font-extrabold text-slate-900">{uploadProgress.percent}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-200/90 h-2 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 h-full rounded-full transition-all duration-150 ease-out"
                            style={{ width: `${uploadProgress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Formatting Toolbar */}
                    <div className="flex items-center gap-1 px-3.5 py-1.5 border-b border-slate-100 bg-slate-50/80 text-slate-500 text-xs">
                      <button
                        type="button"
                        onClick={() => setInputText((prev) => prev + '**bold text**')}
                        className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-700 transition-colors"
                        title="Bold"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputText((prev) => prev + '*italic text*')}
                        className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-700 transition-colors"
                        title="Italic"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputText((prev) => prev + '~~strikethrough~~')}
                        className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-700 transition-colors"
                        title="Strikethrough"
                      >
                        <Strikethrough className="h-3.5 w-3.5" />
                      </button>
                      <span className="h-3.5 w-[1px] bg-slate-200 mx-1" />
                      <button
                        type="button"
                        onClick={() => setInputText((prev) => prev + '\n```\n// code snippet\n```\n')}
                        className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-700 transition-colors"
                        title="Code Block"
                      >
                        <Code className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputText((prev) => prev + '\n> Blockquote')}
                        className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-700 transition-colors"
                        title="Quote"
                      >
                        <Quote className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Composer Textarea */}
                    <textarea
                      value={inputText}
                      onChange={(e) => handleInputChange(e, 'channel')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={`Message #${activeChannel?.name || 'channel'} (Enter to send, Shift+Enter for new line)...`}
                      rows={2}
                      className="w-full resize-none px-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                    />

                    {/* Actions & Send Button */}
                    <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-100 bg-slate-50/40">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <button
                          type="button"
                          onClick={() => setInputText((prev) => prev + ' 👍')}
                          className="p-1.5 hover:bg-slate-200/70 rounded-lg hover:text-slate-800 transition-colors"
                          title="Add Emoji"
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInputText((prev) => prev + '@');
                            setMentionType('user');
                            setMentionTarget('channel');
                          }}
                          className="p-1.5 hover:bg-slate-200/70 rounded-lg hover:text-slate-800 transition-colors"
                          title="Mention someone"
                        >
                          <AtSign className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => channelFileInputRef.current?.click()}
                          className="p-1.5 hover:bg-slate-200/70 rounded-lg hover:text-slate-800 transition-colors"
                          title="Attach File or Image"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                          Return to send
                        </span>
                        <button
                          type="submit"
                          disabled={isSending || (!inputText.trim() && pendingAttachments.length === 0)}
                          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                            inputText.trim() || pendingAttachments.length > 0
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/25 hover:scale-105 active:scale-95'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                          title="Send Message"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                5. MODERN THREAD DRAWER (Slideout Side-Panel Light)
            ───────────────────────────────────────────────────────────── */}
            {activeThreadParent && (
              <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] md:relative md:inset-auto md:w-[380px] lg:w-[420px] border-l border-slate-200/80 bg-slate-50/95 flex flex-col shrink-0 animate-in slide-in-from-right duration-200 shadow-2xl">
                {/* Thread Header */}
                <div className="h-14 px-5 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-white">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 text-sm">Thread Discussion</span>
                    <span className="text-xs text-indigo-600 font-bold">#{activeChannel?.name}</span>
                  </div>
                  <button
                    onClick={() => setActiveThreadParent(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Thread Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Parent Message Card */}
                  <div className="p-4 rounded-2xl bg-white border-l-2 border-indigo-600 border border-slate-200/80 shadow-xs flex items-start gap-3">
                    <img
                      src={activeThreadParent.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                      alt={activeThreadParent.user.name}
                      className="h-9 w-9 rounded-xl border border-slate-200 object-cover shrink-0 mt-0.5 shadow-2xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[13.5px] text-slate-900">
                          {activeThreadParent.user.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          {formatTimestamp(activeThreadParent.createdAt)}
                        </span>
                        {activeThreadParent.isEdited && (
                          <span className="text-[10px] text-slate-400 italic font-normal" title="Edited message">
                            (edited)
                          </span>
                        )}
                      </div>
                      <div className="text-[13.5px] text-slate-800">
                        {renderMessageContent(activeThreadParent.content)}
                      </div>
                      {renderAttachments(activeThreadParent.attachments)}
                    </div>
                  </div>

                  {/* Replies Separator */}
                  <div className="flex items-center gap-3 my-2">
                    <div className="h-[1px] flex-1 bg-slate-200" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
                    </span>
                    <div className="h-[1px] flex-1 bg-slate-200" />
                  </div>

                  {/* Replies Stream */}
                  {threadLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                    </div>
                  ) : threadReplies.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No replies in this thread yet. Be the first to chime in!
                    </div>
                  ) : (
                    threadReplies.map((reply) => {
                      const isReplyAuthor = reply.user.id === user?.id || reply.userId === user?.id;
                      const canDeleteReply = isReplyAuthor || isWorkspaceOwner;

                      return (
                        <div
                          key={reply.id}
                          onMouseEnter={() => setHoveredMessageId(reply.id)}
                          onMouseLeave={() => setHoveredMessageId(null)}
                          className="group relative flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 transition-colors"
                        >
                          {/* Floating Action Bar for Reply */}
                          {hoveredMessageId === reply.id && (isReplyAuthor || canDeleteReply) && (
                            <div className="absolute right-3 -top-2.5 z-10 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md px-1.5 py-0.5 shadow-md text-slate-600">
                              {isReplyAuthor && (
                                <button
                                  onClick={() => {
                                    setEditingMessageId(reply.id);
                                    setEditingContent(reply.content);
                                  }}
                                  className="p-1 hover:bg-slate-100 hover:text-indigo-600 rounded-lg text-slate-500 text-xs transition-colors"
                                  title="Edit reply"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              )}
                              {canDeleteReply && (
                                <button
                                  onClick={() => handleDeleteMessage(reply.id)}
                                  className="p-1 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-500 text-xs transition-colors"
                                  title="Delete reply"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )}

                          <img
                            src={reply.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                            alt={reply.user.name}
                            className="h-8 w-8 rounded-lg border border-slate-200 object-cover shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-bold text-[13px] text-slate-900">
                                {reply.user.name}
                              </span>
                              <span className="text-[11px] text-slate-400 font-normal">
                                {formatTimestamp(reply.createdAt)}
                              </span>
                              {reply.isEdited && (
                                <span className="text-[10px] text-slate-400 italic font-normal" title="Edited message">
                                  (edited)
                                </span>
                              )}
                            </div>

                            {editingMessageId === reply.id ? (
                              <div className="mt-1 rounded-xl border border-indigo-300 bg-white p-2 shadow-xs">
                                <textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleUpdateMessage(reply.id, editingContent);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setEditingMessageId(null);
                                      setEditingContent('');
                                    }
                                  }}
                                  rows={2}
                                  autoFocus
                                  className="w-full resize-none text-[13px] text-slate-900 bg-transparent focus:outline-none leading-relaxed"
                                />
                                <div className="mt-1.5 flex items-center justify-between border-t border-slate-100 pt-1.5 text-xs">
                                  <span className="text-[10px] text-slate-400">
                                    <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[9px] font-mono border">Enter</kbd> save • <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[9px] font-mono border">Esc</kbd> cancel
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMessageId(null);
                                        setEditingContent('');
                                      }}
                                      disabled={isSavingEdit}
                                      className="px-2 py-0.5 text-slate-600 hover:text-slate-800 text-xs font-medium"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateMessage(reply.id, editingContent)}
                                      disabled={isSavingEdit || !editingContent.trim()}
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                                    >
                                      {isSavingEdit ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[13px] text-slate-800">
                                {renderMessageContent(reply.content)}
                              </div>
                            )}

                            {renderAttachments(reply.attachments)}
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div ref={threadEndRef} />
                </div>

                {/* Thread Composer */}
                <div className="p-3 border-t border-slate-200/80 bg-white">
                  <form
                    onSubmit={handleSendThreadReply}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/80 shadow-md focus-within:border-indigo-500 transition-all overflow-hidden"
                  >
                    <input
                      type="file"
                      ref={threadFileInputRef}
                      onChange={(e) => handleThreadFileUpload(e.target.files)}
                      className="hidden"
                      multiple
                    />

                    {/* Pending Attachments in Thread */}
                    {pendingThreadAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 px-3 pt-2.5 pb-2 border-b border-slate-200/60 bg-white">
                        {pendingThreadAttachments.map((att, idx) => {
                          const cat = getFileCategory(att.fileType, att.fileName);
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] shadow-2xs group"
                            >
                              {cat === 'image' ? (
                                <ImageIcon className="h-3 w-3 text-indigo-600" />
                              ) : cat === 'video' ? (
                                <Film className="h-3 w-3 text-indigo-600" />
                              ) : cat === 'audio' ? (
                                <Music className="h-3 w-3 text-purple-600" />
                              ) : cat === 'archive' ? (
                                <Archive className="h-3 w-3 text-amber-600" />
                              ) : cat === 'code' ? (
                                <FileCode className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <FileText className="h-3 w-3 text-indigo-600" />
                              )}
                              <span className="font-semibold text-slate-800 max-w-[110px] truncate">{att.fileName}</span>
                              <span className="text-[9px] text-slate-400 font-mono">({formatFileSize(att.fileSize)})</span>
                              <button
                                type="button"
                                onClick={() => setPendingThreadAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-0.5 hover:bg-rose-50 hover:text-rose-600 rounded text-slate-400 transition-colors"
                                title="Remove file"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Live Upload Progress in Thread */}
                    {isUploadingThread && uploadProgress && (
                      <div className="px-3 py-2 bg-indigo-50/70 border-b border-indigo-100 text-[11px]">
                        <div className="flex items-center justify-between text-slate-700 mb-1">
                          <span className="font-bold truncate max-w-[140px] text-slate-900">{uploadProgress.fileName}</span>
                          <span className="font-mono text-indigo-600 font-bold">{uploadProgress.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all duration-150"
                            style={{ width: `${uploadProgress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <textarea
                      value={threadInputText}
                      onChange={(e) => setThreadInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendThreadReply();
                        }
                      }}
                      placeholder="Reply in thread..."
                      rows={2}
                      className="w-full resize-none px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                    />

                    <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-200/60 bg-white">
                      <div className="flex items-center gap-1 text-slate-500">
                        <button
                          type="button"
                          onClick={() => setThreadInputText((prev) => prev + ' 👍')}
                          className="p-1 hover:bg-slate-100 rounded-lg text-xs"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          onClick={() => setThreadInputText((prev) => prev + ' ❤️')}
                          className="p-1 hover:bg-slate-100 rounded-lg text-xs"
                        >
                          ❤️
                        </button>
                        <button
                          type="button"
                          onClick={() => threadFileInputRef.current?.click()}
                          className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                          title="Attach any file (GBs supported)"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={isSendingThreadReply || (!threadInputText.trim() && pendingThreadAttachments.length === 0)}
                        className={`flex h-7 w-7 items-center justify-center rounded-xl transition-all ${
                          threadInputText.trim() || pendingThreadAttachments.length > 0
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                        title="Send Reply"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </form>
                </div>
              </aside>
            )}

            {/* Members Slideout Panel */}
            {showMembersDrawer && !activeThreadParent && (
              <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:relative md:inset-auto md:w-80 border-l border-slate-200/80 bg-white md:bg-slate-50/95 p-4 flex flex-col shrink-0 animate-in slide-in-from-right duration-150 shadow-2xl">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-600" />
                    <span className="font-bold text-sm text-slate-900">
                      {channelMembersTab === 'channel' && activeChannel && !activeRecipient
                        ? `#${activeChannel.name} Members`
                        : 'Workspace Members'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowMembersDrawer(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Tab Switcher if in a channel */}
                {!activeRecipient && activeChannel && (
                  <div className="flex rounded-xl bg-slate-200/60 p-1 mt-3 text-xs font-semibold text-slate-600">
                    <button
                      onClick={() => setChannelMembersTab('channel')}
                      className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
                        channelMembersTab === 'channel'
                          ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      In Channel ({!activeChannel?.isPrivate ? members.length : (activeChannelMembers.length || members.length)})
                    </button>
                    <button
                      onClick={() => setChannelMembersTab('workspace')}
                      className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
                        channelMembersTab === 'workspace'
                          ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      Workspace ({members.length})
                    </button>
                  </div>
                )}

                {/* Channel Members Tab Content */}
                {channelMembersTab === 'channel' && !activeRecipient && activeChannel ? (
                  <>
                    {isWorkspaceOwner && (
                      <div className="pt-3">
                        <button
                          onClick={() => {
                            setSelectedAddUserIds([]);
                            setAddMemberSearchQuery('');
                            setShowAddChannelMemberModal(true);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium text-xs transition-all shadow-sm"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Add People to #{activeChannel.name}</span>
                        </button>
                      </div>
                    )}

                    <div className="mt-3 flex-1 overflow-y-auto space-y-2">
                      {(() => {
                        const listToRender = !activeChannel?.isPrivate
                          ? members
                          : activeChannelMembers.length > 0
                          ? activeChannelMembers
                          : members;

                        return listToRender.map((m: any) => {
                          const isMe = m.user.id === user?.id;
                          const isCreator = m.user.id === activeChannel.createdById;
                          const canRemoveFromChannel =
                            isWorkspaceOwner &&
                            activeChannel.isPrivate &&
                            !isMe &&
                            !isCreator;

                          return (
                            <div
                              key={m.id}
                              className="flex items-center justify-between p-2 rounded-xl hover:bg-white transition-colors shadow-2xs group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative shrink-0">
                                  <img
                                    src={m.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                                    alt={m.user.name}
                                    className="h-8 w-8 rounded-lg border border-slate-200 object-cover"
                                  />
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white ${
                                      m.user.presence === 'AWAY'
                                        ? 'bg-amber-400'
                                        : m.user.presence === 'OFFLINE'
                                        ? 'bg-slate-300'
                                        : 'bg-emerald-500'
                                    }`}
                                  />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-slate-900 truncate">
                                    {m.user.name}{' '}
                                    {isMe && <span className="text-[10px] text-slate-400 font-normal">(you)</span>}
                                  </span>
                                  <span className="text-[10px] text-slate-500 truncate">
                                    {isCreator ? (
                                      <span className="font-semibold text-indigo-600">Channel Creator</span>
                                    ) : (
                                      'Member'
                                    )}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {!isMe && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleStartCall(m.user, false)}
                                      title={`Voice call ${m.user.name}`}
                                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                    >
                                      <Phone className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartCall(m.user, true)}
                                      title={`Video call ${m.user.name}`}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    >
                                      <Video className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                                {canRemoveFromChannel && (
                                  <button
                                    onClick={() => handleRemoveChannelMember(m.user.id)}
                                    title={`Remove ${m.user.name} from #${activeChannel.name}`}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                ) : (
                  /* Workspace Members Tab Content */
                  <>
                    {/* Quick Invite Button (Owner Only) */}
                    {isWorkspaceOwner && (
                      <div className="pt-3">
                        <button
                          onClick={() => {
                            setShowMembersDrawer(false);
                            setInviteErrorMessage(null);
                            setInviteSuccessMessage(null);
                            setShowInviteModal(true);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium text-xs transition-all shadow-sm"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Invite Teammate</span>
                        </button>
                      </div>
                    )}

                    <div className="mt-3 flex-1 overflow-y-auto space-y-2">
                      {members.map((m) => {
                        const isMe = m.user.id === user?.id;
                        const isMemberOwner =
                          m.role === 'OWNER' ||
                          currentWs?.owner?.id === m.user.id ||
                          currentWs?.ownerId === m.user.id;
                        const canRemove = isWorkspaceOwner && !isMe && !isMemberOwner;

                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-white transition-colors shadow-2xs group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <img
                                  src={m.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                                  alt={m.user.name}
                                  className="h-8 w-8 rounded-lg border border-slate-200 object-cover"
                                />
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white ${
                                    m.user.presence === 'AWAY'
                                      ? 'bg-amber-400'
                                      : m.user.presence === 'OFFLINE'
                                      ? 'bg-slate-300'
                                      : 'bg-emerald-500'
                                  }`}
                                />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {m.user.name}{' '}
                                  {isMe && <span className="text-[10px] text-slate-400 font-normal">(you)</span>}
                                </span>
                                <span className="text-[10px] text-slate-500 truncate">
                                  {isMemberOwner ? (
                                    <span className="font-semibold text-amber-600">Workspace Owner</span>
                                  ) : m.role === 'ADMIN' ? (
                                    <span className="font-semibold text-indigo-600">Admin</span>
                                  ) : (
                                    'Member'
                                  )}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!isMe && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStartCall(m.user, false)}
                                    title={`Voice call ${m.user.name}`}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartCall(m.user, true)}
                                    title={`Video call ${m.user.name}`}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  >
                                    <Video className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              {canRemove && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRemoveMemberError(null);
                                    setMemberToRemove(m);
                                  }}
                                  title={`Remove ${m.user.name} from workspace`}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </aside>
            )}
          </div>
        </main>

      {/* ─────────────────────────────────────────────────────────────
          6. COMMAND PALETTE MODAL (⌘K Quick Switcher Light)
      ───────────────────────────────────────────────────────────── */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-xs pt-20 px-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150">
            {/* Search Input Bar */}
            <div className="flex items-center px-4 border-b border-slate-100 bg-slate-50/80">
              <Search className="h-4 w-4 text-indigo-600 mr-3" />
              <input
                autoFocus
                type="text"
                value={commandPaletteQuery}
                onChange={(e) => setCommandPaletteQuery(e.target.value)}
                placeholder="Search channels, spaces, or team members..."
                className="w-full py-4 text-sm bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                onClick={() => setShowCommandPalette(false)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Results */}
            <div className="max-h-80 overflow-y-auto p-3 space-y-4">
              {/* Channels */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1.5">
                  Spaces &amp; Channels
                </span>
                <div className="space-y-1">
                  {filteredChannels.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400">No channels found</div>
                  ) : (
                    filteredChannels.map((c) => {
                      const unreadCount = unreadChannels[c.id] || 0;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setActiveChannel(c);
                            setActiveRecipient(null);
                            setActiveConversation(null);
                            setActiveThreadParent(null);
                            setUnreadChannels((prev) => ({ ...prev, [c.id]: 0 }));
                            setShowCommandPalette(false);
                            setCommandPaletteQuery('');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                            activeChannel?.id === c.id
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs'
                              : unreadCount > 0
                              ? 'bg-indigo-50/50 text-indigo-950 font-bold border border-indigo-100 hover:bg-indigo-50'
                              : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Hash className={`h-3.5 w-3.5 ${unreadCount > 0 ? 'text-indigo-600 font-bold' : 'text-slate-400'}`} />
                            <span className="truncate">{c.name}</span>
                            {c.isPrivate && <Lock className="h-3 w-3 text-amber-500 ml-1 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {unreadCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-[9px] font-black text-white shadow-2xs">
                                {unreadCount} new
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">Jump →</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Members */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1.5">
                  Workspace Members
                </span>
                <div className="space-y-1">
                  {filteredMembers.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400">No members found</div>
                  ) : (
                    filteredMembers.map((m) => {
                      const unreadCount = unreadDirectMessages[m.user.id] || 0;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            handleSelectDirectMessage(m.user);
                            setUnreadDirectMessages((prev) => ({ ...prev, [m.user.id]: 0 }));
                            setShowCommandPalette(false);
                            setCommandPaletteQuery('');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                            unreadCount > 0
                              ? 'bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 font-bold'
                              : 'text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <img
                              src={m.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                              alt={m.user.name}
                              className="h-5 w-5 rounded-md border border-slate-200 shrink-0"
                            />
                            <span className="truncate">{m.user.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {unreadCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-[9px] font-black text-white shadow-2xs">
                                {unreadCount} new
                              </span>
                            )}
                            <span className="text-[10px] text-indigo-500 font-semibold">Message →</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer Tip */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Navigate with mouse or click</span>
              <kbd className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">ESC to close</kbd>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. MODERN "CREATE CHANNEL" MODAL (Clean Glass Light)
      ───────────────────────────────────────────────────────────── */}
      {showCreateChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl text-slate-900 border border-slate-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600">
                  <Hash className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Create Space or Channel</h3>
              </div>
              <button
                onClick={() => setShowCreateChannelModal(false)}
                className="text-slate-400 hover:text-slate-800 p-1.5 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500 leading-relaxed">
              Channels are organized spaces where your team discusses projects, goals, or topics.
            </p>

            {channelError && (
              <div className="mt-3.5 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                {channelError}
              </div>
            )}

            <form onSubmit={handleCreateChannel} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Channel Name
                </label>
                <div className="relative mt-1.5 flex items-center">
                  <span className="absolute left-3.5 text-indigo-600 font-bold">#</span>
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="e.g. sprint-planning or design-system"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Topic (Optional)
                </label>
                <input
                  type="text"
                  value={newChannelTopic}
                  onChange={(e) => setNewChannelTopic(e.target.value)}
                  placeholder="What is this channel about?"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3.5 bg-slate-50">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Make Private</span>
                  <span className="text-[11px] text-slate-500 block">
                    Only invited members can view this channel
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={newChannelIsPrivate}
                  onChange={(e) => setNewChannelIsPrivate(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                />
              </div>

              {/* Teammates Selection: Only Workspace Owner can add teammates to new channels */}
              {isWorkspaceOwner && (
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Add Teammates (Optional)
                    </label>
                    <span className="text-[11px] text-indigo-600 font-semibold">
                      {newChannelSelectedMembers.length} selected
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    By default, you are the only member in this channel. Teammates are <span className="font-semibold text-slate-700">not added automatically</span>. Check anyone you want to include:
                  </p>

                  {members.filter((m) => m.user.id !== user?.id).length === 0 ? (
                    <div className="p-3 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      No other teammates in this workspace yet.
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/50 p-2 space-y-1">
                      {members
                        .filter((m) => m.user.id !== user?.id)
                        .map((m) => {
                          const isChecked = newChannelSelectedMembers.includes(m.user.id);
                          return (
                            <label
                              key={m.id}
                              className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-indigo-50 border border-indigo-200 shadow-2xs'
                                  : 'hover:bg-white border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={m.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                                  alt={m.user.name}
                                  className="h-6 w-6 rounded-md border border-slate-200 object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-slate-900 block truncate">
                                    {m.user.name}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block truncate">
                                    {m.user.email}
                                  </span>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewChannelSelectedMembers((prev) => [...prev, m.user.id]);
                                  } else {
                                    setNewChannelSelectedMembers((prev) =>
                                      prev.filter((id) => id !== m.user.id)
                                    );
                                  }
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                              />
                            </label>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateChannelModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={channelCreating || !newChannelName.trim()}
                  className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/25 hover:opacity-95 disabled:opacity-50 transition-all"
                >
                  {channelCreating ? 'Creating...' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7B. ADD PEOPLE TO ACTIVE CHANNEL MODAL
      ───────────────────────────────────────────────────────────── */}
      {showAddChannelMemberModal && activeChannel && isWorkspaceOwner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setShowAddChannelMemberModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl text-slate-900 border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add people to #{activeChannel.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Invite workspace members into this channel
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddChannelMemberModal(false)}
                className="text-slate-400 hover:text-slate-800 p-1.5 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={addMemberSearchQuery}
                  onChange={(e) => setAddMemberSearchQuery(e.target.value)}
                  placeholder="Search teammates by name or email..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              {(() => {
                const existingMemberUserIds = new Set(activeChannelMembers.map((m) => m.user.id));
                const eligibleMembers = members.filter(
                  (m) =>
                    !existingMemberUserIds.has(m.user.id) &&
                    (m.user.name.toLowerCase().includes(addMemberSearchQuery.toLowerCase()) ||
                      m.user.email.toLowerCase().includes(addMemberSearchQuery.toLowerCase()))
                );

                if (eligibleMembers.length === 0) {
                  return (
                    <div className="py-8 text-center rounded-2xl bg-slate-50 border border-slate-200/80">
                      <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500 mb-2" />
                      <p className="text-xs font-bold text-slate-800">
                        {addMemberSearchQuery
                          ? 'No matching teammates found'
                          : 'All teammates are already in this channel'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {addMemberSearchQuery
                          ? 'Try searching with a different name or email'
                          : 'Everyone from this workspace has joined'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200 p-2 space-y-1">
                    {eligibleMembers.map((m) => {
                      const isChecked = selectedAddUserIds.includes(m.user.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-indigo-50 border border-indigo-200 shadow-2xs'
                              : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={m.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                              alt={m.user.name}
                              className="h-7 w-7 rounded-lg border border-slate-200 object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 block truncate">
                                {m.user.name}
                              </span>
                              <span className="text-[10px] text-slate-500 block truncate">
                                {m.user.email}
                              </span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAddUserIds((prev) => [...prev, m.user.id]);
                              } else {
                                setSelectedAddUserIds((prev) =>
                                  prev.filter((id) => id !== m.user.id)
                                );
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                          />
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-medium">
                {selectedAddUserIds.length} {selectedAddUserIds.length === 1 ? 'person' : 'people'} selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddChannelMemberModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddMembersToChannel}
                  disabled={selectedAddUserIds.length === 0 || isAddingChannelMember}
                  className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/25 hover:opacity-95 disabled:opacity-50 transition-all"
                >
                  {isAddingChannelMember ? 'Adding...' : 'Add to Channel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. MODERN RICH EMOJI PICKER MODAL (Light Popover)
      ───────────────────────────────────────────────────────────── */}
      {activeEmojiPickerFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-2xs p-4 animate-in fade-in duration-150"
          onClick={() => setActiveEmojiPickerFor(null)}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smile className="h-4 w-4 text-indigo-600" />
                <span className="font-bold text-sm text-slate-900">Add Emoji Reaction</span>
              </div>
              <button
                onClick={() => setActiveEmojiPickerFor(null)}
                className="p-1 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 mt-3 p-1 rounded-xl bg-slate-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setEmojiTab('popular')}
                className={`flex-1 py-1 rounded-lg text-center transition-colors ${
                  emojiTab === 'popular'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Popular
              </button>
              <button
                type="button"
                onClick={() => setEmojiTab('smileys')}
                className={`flex-1 py-1 rounded-lg text-center transition-colors ${
                  emojiTab === 'smileys'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Smileys
              </button>
              <button
                type="button"
                onClick={() => setEmojiTab('work')}
                className={`flex-1 py-1 rounded-lg text-center transition-colors ${
                  emojiTab === 'work'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Status
              </button>
            </div>

            {/* Emoji Grid */}
            <div className="grid grid-cols-5 gap-2 mt-4 max-h-48 overflow-y-auto p-1">
              {EMOJI_CATEGORIES[emojiTab].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    if (activeEmojiPickerFor.isDM) {
                      handleToggleDirectReaction(activeEmojiPickerFor.messageId, emoji);
                    } else {
                      handleToggleReaction(activeEmojiPickerFor.messageId, emoji);
                    }
                    setActiveEmojiPickerFor(null);
                  }}
                  className="flex items-center justify-center h-10 w-10 text-xl rounded-xl hover:bg-indigo-50 hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          9. MODERN IMAGE LIGHTBOX MODAL (Full Resolution View)
      ───────────────────────────────────────────────────────────── */}
      {activeLightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setActiveLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <ImageIcon className="h-4 w-4 text-indigo-600" />
                <span className="font-bold text-sm text-slate-800">{activeLightboxImage.fileName}</span>
                {activeLightboxImage.fileSize && (
                  <span className="text-xs text-slate-400">
                    ({formatFileSize(activeLightboxImage.fileSize)})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={activeLightboxImage.url}
                  download={activeLightboxImage.fileName}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  title="Download image"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  onClick={() => setActiveLightboxImage(null)}
                  className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center overflow-auto bg-slate-950/5">
              <img
                src={activeLightboxImage.url}
                alt={activeLightboxImage.fileName}
                className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          10. PINNED MESSAGES DRAWER (Slack-Style Pinned Drawer)
      ───────────────────────────────────────────────────────────── */}
      {showPinnedDrawer && (
        <aside className="fixed inset-y-0 sm:top-12 sm:bottom-0 right-0 w-full sm:w-88 border-l border-slate-200/90 bg-white flex flex-col shrink-0 z-40 shadow-2xl animate-in slide-in-from-right-4 duration-200">
          <div className="h-14 px-5 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                <Pin className="h-4 w-4 fill-amber-500" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900">Pinned Messages</span>
                <p className="text-[11px] text-slate-500">
                  {activeRecipient ? `DM with ${activeRecipient.name}` : `#${activeChannel?.name}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPinnedDrawer(false)}
              className="p-1 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingPinned ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : pinnedMessages.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 mb-3 border border-amber-200/60">
                  <Pin className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold text-slate-800">No pinned items yet</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                  Pin important guidelines, announcements, or files so anyone in this space can easily find them later.
                </p>
              </div>
            ) : (
              pinnedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-indigo-300 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={msg.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                        alt={msg.user.name}
                        className="h-6 w-6 rounded-lg border border-slate-200 object-cover"
                      />
                      <span className="text-xs font-bold text-slate-900">{msg.user.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {formatTimestamp(msg.createdAt)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleTogglePinMessage(msg.id, !!activeRecipient)}
                      className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors"
                      title="Unpin message"
                    >
                      <PinOff className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {msg.content && (
                    <p className="text-xs text-slate-700 leading-relaxed mb-2 line-clamp-3">
                      {msg.content}
                    </p>
                  )}

                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2 text-[11px] font-semibold text-indigo-600 flex items-center gap-1.5">
                      <File className="h-3 w-3" />
                      <span>{msg.attachments.length} attachment(s)</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                    <span>Pinned by {msg.pinnedBy?.name || 'team member'}</span>
                    <button
                      onClick={() => handleJumpToMessage(msg.id)}
                      className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Jump to message →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* ─────────────────────────────────────────────────────────────
          11. ACTIVITY & NOTIFICATIONS DRAWER
      ───────────────────────────────────────────────────────────── */}
      {showNotificationDrawer && (
        <aside className="fixed inset-y-0 sm:top-12 sm:bottom-0 right-0 w-full sm:w-88 border-l border-slate-200/90 bg-white flex flex-col shrink-0 z-40 shadow-2xl animate-in slide-in-from-right-4 duration-200">
          <div className="h-14 px-5 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                <Bell className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm text-slate-900">Activity & Mentions</span>
            </div>
            <div className="flex items-center gap-2">
              {unreadNotificationCount > 0 && (
                <button
                  onClick={handleMarkAllNotificationsAsRead}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setShowNotificationDrawer(false)}
                className="p-1 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-100 bg-white text-xs font-semibold">
            {(['all', 'unread', 'mentions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setNotificationTab(tab)}
                className={`flex-1 py-1 rounded-xl text-center capitalize transition-colors ${
                  notificationTab === tab
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {notifications.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 mb-3 border border-indigo-200/60">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold text-slate-800">You're all caught up!</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                  When someone mentions you, reacts to your post, or replies in a thread, it will appear here.
                </p>
              </div>
            ) : (
              notifications
                .filter((n) => {
                  if (notificationTab === 'unread') return !n.isRead;
                  if (notificationTab === 'mentions') return n.type === 'MENTION';
                  return true;
                })
                .map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      handleMarkNotificationAsRead(notif.id);
                      if (notif.messageId) {
                        handleJumpToMessage(notif.messageId, notif.channelId, notif.conversationId);
                      }
                    }}
                    className={`rounded-2xl border p-3 cursor-pointer transition-all ${
                      !notif.isRead
                        ? 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/70 shadow-xs'
                        : 'border-slate-200/80 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={notif.actor?.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                          alt={notif.actor?.name || 'User'}
                          className="h-6 w-6 rounded-lg border border-slate-200 object-cover shrink-0"
                        />
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {notif.actor?.name}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                            notif.type === 'MENTION'
                              ? 'bg-amber-100 text-amber-800'
                              : notif.type === 'REACTION'
                              ? 'bg-purple-100 text-purple-800'
                              : notif.type === 'DIRECT_MESSAGE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {notif.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatTimestamp(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 leading-snug">
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {notif.body}
                      </p>
                    )}
                  </div>
                ))
            )}
          </div>
        </aside>
      )}

      {/* ─────────────────────────────────────────────────────────────
          12. WORKSPACE FULL-TEXT SEARCH MODAL (Slack-Grade Multi-Tab)
      ───────────────────────────────────────────────────────────── */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-xs p-4 pt-16 animate-in fade-in duration-150"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Box */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <Search className="h-5 w-5 text-indigo-600 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across all messages, files, channels, or people..."
                autoFocus
                className="w-full text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              {isSearching && <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-100 bg-slate-50/70 text-xs font-semibold">
              {(['all', 'messages', 'files', 'channels', 'people'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSearchFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl capitalize transition-colors flex items-center gap-1.5 ${
                    searchFilter === tab
                      ? 'bg-white text-indigo-700 font-bold border border-slate-200 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab}</span>
                  {searchResults && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      (
                      {tab === 'all'
                        ? searchResults.total
                        : tab === 'messages'
                        ? searchResults.messages.length
                        : tab === 'files'
                        ? searchResults.files.length
                        : tab === 'channels'
                        ? searchResults.channels.length
                        : searchResults.people.length}
                      )
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!searchQuery.trim() ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Type any keyword to search across the entire workspace.
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <span className="text-[10px] text-slate-400">Quick suggestions:</span>
                    <button
                      onClick={() => setSearchQuery('hello')}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-[11px] text-indigo-600 font-medium"
                    >
                      hello
                    </button>
                    <button
                      onClick={() => setSearchQuery('general')}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-[11px] text-indigo-600 font-medium"
                    >
                      general
                    </button>
                  </div>
                </div>
              ) : isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
              ) : !searchResults || searchResults.total === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No matching results found for "{searchQuery}". Try different keywords.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Matching Messages */}
                  {(searchFilter === 'all' || searchFilter === 'messages') &&
                    searchResults.messages.length > 0 && (
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1 mb-2">
                          Messages ({searchResults.messages.length})
                        </div>
                        <div className="space-y-2">
                          {searchResults.messages.map((m) => (
                            <div
                              key={m.id}
                              onClick={() => {
                                handleJumpToMessage(
                                  m.id,
                                  m.contextType === 'channel' ? m.channel?.id : null,
                                  m.contextType === 'direct' ? m.conversationId : null,
                                );
                              }}
                              className="rounded-2xl border border-slate-200/90 bg-white p-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer shadow-2xs"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={m.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                                    alt={m.user.name}
                                    className="h-5 w-5 rounded-md border border-slate-200 object-cover"
                                  />
                                  <span className="font-bold text-xs text-slate-900">{m.user.name}</span>
                                  <span className="text-[10px] text-slate-400">
                                    in {m.contextType === 'channel' ? `#${m.channel?.name}` : 'Direct Messages'}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {formatTimestamp(m.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                                {m.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Matching Files */}
                  {(searchFilter === 'all' || searchFilter === 'files') &&
                    searchResults.files.length > 0 && (
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1 mb-2">
                          Files & Media ({searchResults.files.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {searchResults.files.map((f) => (
                            <div
                              key={f.id}
                              onClick={() => {
                                if (f.fileType.startsWith('image/')) {
                                  setActiveLightboxImage({
                                    url: f.fileUrl,
                                    fileName: f.fileName,
                                    fileSize: f.fileSize,
                                  });
                                } else {
                                  window.open(f.fileUrl, '_blank');
                                }
                                setShowSearchModal(false);
                              }}
                              className="rounded-2xl border border-slate-200 bg-white p-3 hover:border-indigo-300 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-3 shadow-2xs"
                            >
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                                {f.fileType.startsWith('image/') ? (
                                  <ImageIcon className="h-4 w-4" />
                                ) : (
                                  <FileText className="h-4 w-4" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-xs text-slate-900 truncate">{f.fileName}</p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {formatFileSize(f.fileSize)} • shared by{' '}
                                  {f.message?.user?.name || f.directMessage?.user?.name || 'team'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Matching Channels */}
                  {(searchFilter === 'all' || searchFilter === 'channels') &&
                    searchResults.channels.length > 0 && (
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1 mb-2">
                          Channels ({searchResults.channels.length})
                        </div>
                        <div className="space-y-1.5">
                          {searchResults.channels.map((ch) => (
                            <button
                              key={ch.id}
                              onClick={() => {
                                setActiveChannel(ch);
                                setActiveRecipient(null);
                                setActiveConversation(null);
                                setShowSearchModal(false);
                              }}
                              className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors shadow-2xs"
                            >
                              <div className="flex items-center gap-2">
                                <Hash className="h-4 w-4 text-indigo-600" />
                                <span className="font-bold text-xs text-slate-900">#{ch.name}</span>
                                {ch.topic && (
                                  <span className="text-[11px] text-slate-500 font-normal truncate max-w-xs">
                                    — {ch.topic}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {ch._count?.messages || 0} messages
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Matching People */}
                  {(searchFilter === 'all' || searchFilter === 'people') &&
                    searchResults.people.length > 0 && (
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1 mb-2">
                          People ({searchResults.people.length})
                        </div>
                        <div className="space-y-1.5">
                          {searchResults.people.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                handleSelectDirectMessage(p);
                                setShowSearchModal(false);
                              }}
                              className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors shadow-2xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="relative">
                                  <img
                                    src={p.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                                    alt={p.name}
                                    className="h-7 w-7 rounded-lg border border-slate-200 object-cover"
                                  />
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-white ${
                                      p.presence === 'AWAY'
                                        ? 'bg-amber-400'
                                        : p.presence === 'OFFLINE'
                                        ? 'bg-slate-300'
                                        : 'bg-emerald-500'
                                    }`}
                                  />
                                </div>
                                <div>
                                  <span className="font-bold text-xs text-slate-900">{p.name}</span>
                                  <span className="text-[10px] text-slate-400 ml-2">{p.email}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200/60">
                                Message
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          INVITE TEAMMATES MODAL (Slack-fidelity Add Member Dialog)
      ───────────────────────────────────────────────────────────── */}
      {showInviteModal && isWorkspaceOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Add teammates to {currentWs?.name || 'Workspace'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Invite colleagues to collaborate in channels and direct messages
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Alert Feedback */}
              {inviteSuccessMessage && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{inviteSuccessMessage}</div>
                </div>
              )}

              {inviteErrorMessage && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{inviteErrorMessage}</div>
                </div>
              )}

              {/* Method 1: Direct Email Invitation */}
              <form onSubmit={handleInviteMember} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Invite by Registered Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    If they already have an account, they are added to this workspace immediately.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={inviteLoading || !inviteEmail.trim()}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {inviteLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Adding teammate...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Add to Workspace</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Or share an invite link
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Method 2: Shareable 1-Click Link & Code */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    1-Click Join Link
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 truncate font-mono">
                      <LinkIcon className="h-3.5 w-3.5 text-slate-400 mr-2 shrink-0" />
                      <span className="truncate">
                        {typeof window !== 'undefined'
                          ? `${window.location.origin}/workspaces?join=${currentWs?.joinCode}`
                          : `/workspaces?join=${currentWs?.joinCode}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={copyInviteLink}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors shadow-2xs"
                    >
                      {copiedInviteLink ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Join Code Card */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Workspace Invite Code
                    </span>
                    <span className="font-mono text-sm font-bold text-indigo-700">
                      {currentWs?.joinCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copyInviteCode}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                Invited members get instant access to all public channels
              </span>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          KICK / REMOVE MEMBER CONFIRMATION MODAL
      ───────────────────────────────────────────────────────────── */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                  <UserMinus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Remove from workspace</h3>
                  <p className="text-xs text-slate-500">Confirm member removal</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to remove <strong className="text-slate-900">{memberToRemove.user.name}</strong> ({memberToRemove.user.email}) from <strong className="text-slate-900">{currentWs?.name}</strong>?
              </p>

              <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>They will immediately lose access to all channels, direct messages, and shared files in this workspace.</span>
              </div>

              {removeMemberError && (
                <div className="mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{removeMemberError}</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={removeMemberLoading}
                  onClick={() => setMemberToRemove(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={removeMemberLoading}
                  onClick={handleConfirmRemoveMember}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {removeMemberLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Removing...</span>
                    </>
                  ) : (
                    <>
                      <UserMinus className="h-3.5 w-3.5" />
                      <span>Remove Member</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          INCOMING WORKSPACE / DM MESSAGE NOTIFICATION TOAST
      ───────────────────────────────────────────────────────────── */}
      {messageToast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-88 animate-in slide-in-from-top-3 fade-in duration-200">
          <div
            onClick={() => {
              if (messageToast.type === 'channel' && messageToast.channel) {
                setShowMobileSidebar(false);
                setActiveChannel(messageToast.channel);
                setActiveRecipient(null);
                setActiveConversation(null);
                setActiveThreadParent(null);
                setUnreadChannels((prev) => ({ ...prev, [messageToast.channel!.id]: 0 }));
              } else if (messageToast.type === 'dm' && messageToast.senderUser) {
                handleSelectDirectMessage(messageToast.senderUser);
                setUnreadDirectMessages((prev) => ({ ...prev, [messageToast.senderUser!.id]: 0 }));
              }
              setMessageToast(null);
            }}
            className="cursor-pointer group flex items-start gap-3 p-3 rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-indigo-200/90 hover:border-indigo-400 transition-all hover:scale-[1.01]"
          >
            <div className="relative shrink-0">
              <img
                src={messageToast.senderAvatar || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                alt={messageToast.senderName}
                className="h-9 w-9 rounded-xl border border-slate-200 object-cover shadow-2xs"
              />
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold shadow-xs">
                {messageToast.type === 'channel' ? '#' : '@'}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {messageToast.chatTitle}
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold group-hover:underline">
                  View →
                </span>
              </div>
              <p className="text-[11px] text-slate-600 truncate mt-0.5">
                <span className="font-semibold text-slate-800">{messageToast.senderName}:</span>{' '}
                {messageToast.content}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMessageToast(null);
              }}
              className="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded-lg transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CALL NOTIFICATION TOAST
      ───────────────────────────────────────────────────────────── */}
      {callNotificationMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 text-white shadow-2xl border border-slate-700/80 backdrop-blur-md text-xs font-semibold">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <span>{callNotificationMsg}</span>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          INCOMING CALL MODAL
      ───────────────────────────────────────────────────────────── */}
      {callStatus === 'incoming' && incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-700/80 overflow-hidden animate-in zoom-in-95 duration-200 p-6 flex flex-col items-center text-center mx-4">
            {/* Animated ringing avatar */}
            <div className="relative my-4">
              <div className="absolute -inset-3 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="absolute -inset-6 rounded-full bg-indigo-500/10 animate-pulse" />
              <img
                src={incomingCall.from.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                alt={incomingCall.from.name}
                className="h-24 w-24 rounded-full object-cover border-4 border-slate-700 relative z-10 shadow-xl"
              />
              <div className="absolute bottom-0 right-0 z-20 h-7 w-7 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center shadow-md">
                {incomingCall.isVideo ? (
                  <Video className="h-3.5 w-3.5 text-white" />
                ) : (
                  <Phone className="h-3.5 w-3.5 text-white" />
                )}
              </div>
            </div>

            <h3 className="font-bold text-lg text-white mt-1">{incomingCall.from.name}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Incoming {incomingCall.isVideo ? 'Video' : 'Audio'} Call...
            </p>
            <p className="text-[10px] text-slate-500 mt-2 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/50">
              {incomingCall.isVideo ? 'Camera & Mic permission required' : 'Microphone permission required'}
            </p>

            {/* Answer / Decline buttons */}
            <div className="mt-8 flex items-center gap-4 w-full">
              <button
                type="button"
                onClick={handleDeclineCall}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-600/90 hover:bg-rose-600 text-white font-semibold text-xs shadow-lg shadow-rose-600/30 transition-all hover:scale-102 active:scale-98"
              >
                <PhoneOff className="h-4 w-4" />
                <span>Decline</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptCall}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/40 transition-all hover:scale-102 active:scale-98 animate-pulse"
              >
                <PhoneCall className="h-4 w-4" />
                <span>Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ACTIVE / OUTGOING CALL OVERLAY
      ───────────────────────────────────────────────────────────── */}
      {(callStatus === 'calling' || callStatus === 'connected') && callPeer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full h-full sm:h-auto sm:max-w-3xl sm:rounded-3xl bg-slate-900 border sm:border-slate-700/80 shadow-2xl overflow-hidden flex flex-col justify-between sm:justify-start text-white">
            {/* Dedicated Remote Audio Output - Always mounted & unmuted for crystal-clear bidirectional sound */}
            <audio
              ref={remoteAudioRef}
              autoPlay
              playsInline
              style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            />

            {/* Call Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <img
                  src={callPeer.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                  alt={callPeer.name}
                  className="h-10 w-10 rounded-xl object-cover border border-slate-600 shadow-sm"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-white">{callPeer.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {callStatus === 'connected' ? (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold font-mono">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        {formatCallDuration(callDuration)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-amber-300 font-medium">
                        <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                        Calling...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-700/70 border border-slate-600 text-slate-300 flex items-center gap-1.5">
                  {callType === 'video' ? (
                    <>
                      <Video className="h-3 w-3 text-indigo-400" />
                      <span>Video Call</span>
                    </>
                  ) : (
                    <>
                      <Phone className="h-3 w-3 text-emerald-400" />
                      <span>Audio Call</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Media / Video Center Area */}
            <div className="relative bg-slate-950 flex-1 sm:flex-initial min-h-[300px] sm:min-h-[380px] md:min-h-[440px] flex items-center justify-center overflow-hidden">
              {callType === 'video' ? (
                <>
                  {/* Remote video stream (muted=true so remoteAudioRef outputs clear audio without mobile autoplay blocks) */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full min-h-[300px] sm:h-[380px] md:h-[440px] object-cover bg-slate-950"
                  />

                  {/* Ringing placeholder while waiting for answer */}
                  {callStatus === 'calling' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs">
                      <div className="relative">
                        <div className="absolute -inset-4 rounded-full bg-indigo-500/20 animate-ping" />
                        <img
                          src={callPeer.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                          alt={callPeer.name}
                          className="h-24 w-24 rounded-full object-cover border-4 border-slate-700 shadow-xl"
                        />
                      </div>
                      <h4 className="mt-4 font-bold text-base text-white">{callPeer.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">Ringing...</p>
                    </div>
                  )}

                  {/* Local video PiP (bottom right) */}
                  <div className="absolute bottom-4 right-4 w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden border-2 border-indigo-500/80 shadow-2xl bg-slate-900 group">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${isVideoMuted ? 'opacity-0' : 'opacity-100'}`}
                    />
                    {isVideoMuted && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-400 text-[10px] font-semibold">
                        Camera Off
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white font-medium">
                      You
                    </span>
                  </div>
                </>
              ) : (
                /* Audio Call Central Stage */
                <div className="py-16 flex flex-col items-center justify-center">
                  <div className="relative">
                    {callStatus === 'connected' && (
                      <>
                        <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping" />
                        <div className="absolute -inset-8 rounded-full bg-indigo-500/10 animate-pulse" />
                      </>
                    )}
                    {callStatus === 'calling' && (
                      <div className="absolute -inset-4 rounded-full bg-amber-500/20 animate-ping" />
                    )}
                    <img
                      src={callPeer.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                      alt={callPeer.name}
                      className="h-28 w-28 rounded-full object-cover border-4 border-slate-700 shadow-2xl relative z-10"
                    />
                  </div>
                  <h4 className="mt-5 font-bold text-lg text-white">{callPeer.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {callStatus === 'calling' ? 'Ringing teammate...' : `Audio Connected • ${formatCallDuration(callDuration)}`}
                  </p>
                </div>
              )}
            </div>

            {/* Call Control Toolbar */}
            <div className="p-3 sm:p-4 bg-slate-800/90 border-t border-slate-700/60 flex items-center justify-center gap-2 sm:gap-3 shrink-0">
              {/* Mic Toggle */}
              <button
                type="button"
                onClick={toggleMic}
                className={`p-3 sm:p-3.5 rounded-2xl transition-all shadow-md ${
                  isMicMuted
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30'
                    : 'bg-slate-700/80 hover:bg-slate-600 text-slate-200'
                }`}
                title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              {/* Camera Toggle */}
              {callType === 'video' && (
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={`p-3 sm:p-3.5 rounded-2xl transition-all shadow-md ${
                    isVideoMuted
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30'
                      : 'bg-slate-700/80 hover:bg-slate-600 text-slate-200'
                  }`}
                  title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </button>
              )}

              {/* Screen Share */}
              {callType === 'video' && (
                <button
                  type="button"
                  onClick={toggleScreenShare}
                  className={`p-3 sm:p-3.5 rounded-2xl transition-all shadow-md ${
                    isScreenSharing
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700/80 hover:bg-slate-600 text-slate-200'
                  }`}
                  title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
                >
                  <MonitorUp className="h-5 w-5" />
                </button>
              )}

              {/* End Call Button */}
              <button
                type="button"
                onClick={() => cleanupCall(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all hover:scale-102 active:scale-98 ml-1 sm:ml-2"
              >
                <PhoneOff className="h-5 w-5" />
                <span>End Call</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkspaceShellPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC] text-slate-800">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-xs text-slate-500 font-medium tracking-wide">Loading TeamFlow...</p>
          </div>
        </div>
      }
    >
      <WorkspaceShellContent />
    </Suspense>
  );
}

