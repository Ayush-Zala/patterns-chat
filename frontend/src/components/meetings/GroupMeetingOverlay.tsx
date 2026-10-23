'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Volume2,
  VolumeX,
  PhoneOff,
  Disc,
  Square,
  Users,
  Maximize2,
  Minimize2,
  RotateCcw,
  Pin,
  PinOff,
  X,
  Shield,
  Crown,
  Sparkles,
  MessageSquare,
  Send,
  UserPlus,
  Check,
  Search,
  Hand,
  MoreVertical,
  Copy,
} from 'lucide-react';
import { User, WorkspaceRole } from '@/types/auth';
import { ROLE_CONFIGS } from '@/lib/roles';

interface ParticipantItem {
  socketId: string;
  user: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
    role?: WorkspaceRole;
  };
  stream?: MediaStream;
  isMicMuted?: boolean;
  isVideoMuted?: boolean;
  isScreenSharing?: boolean;
  isSpeaking?: boolean;
  hasHandRaised?: boolean;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: number;
}

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: WorkspaceRole;
}

interface GroupMeetingOverlayProps {
  meetingId: string;
  meetingTitle: string;
  channelName?: string;
  workspaceId: string;
  user: User;
  userRole?: WorkspaceRole;
  socket: any;
  members?: WorkspaceMember[];
  onLeaveMeeting: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
  ],
};

// Format seconds as MM:SS
function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Format timestamp as HH:MM AM/PM
function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function GroupMeetingOverlay({
  meetingId,
  meetingTitle,
  channelName,
  workspaceId,
  user,
  userRole,
  socket,
  members = [],
  onLeaveMeeting,
}: GroupMeetingOverlayProps) {
  // ── Local Media State ──────────────────────────────────────────
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasCamera, setHasCamera] = useState(true);
  const [hasHandRaised, setHasHandRaised] = useState(false);

  // ── UI State ───────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [screenFitMode, setScreenFitMode] = useState<'cover' | 'contain'>('cover');
  const [callDuration, setCallDuration] = useState(0);
  const [activePanel, setActivePanel] = useState<'none' | 'participants' | 'chat' | 'invite'>('none');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copyLinkStatus, setCopyLinkStatus] = useState(false);

  // ── Participants ───────────────────────────────────────────────
  const [remotePeers, setRemotePeers] = useState<Map<string, ParticipantItem>>(new Map());
  const [pinnedSocketId, setPinnedSocketId] = useState<string | null>(null);

  // ── Chat State ─────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // ── Recording State ────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // ── Invite State ───────────────────────────────────────────────
  const [inviteSearch, setInviteSearch] = useState('');
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  // ── Audio Output ───────────────────────────────────────────────
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('default');

  // ── Refs ───────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, any[]>>(new Map());
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speakingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // ── Meeting Timer ──────────────────────────────────────────────
  useEffect(() => {
    callTimerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, []);

  // ── Fullscreen Listener ────────────────────────────────────────
  useEffect(() => {
    const handle = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handle);
    return () => document.removeEventListener('fullscreenchange', handle);
  }, []);

  // ── Auto-scroll chat ───────────────────────────────────────────
  useEffect(() => {
    if (activePanel === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadChatCount(0);
    }
  }, [chatMessages, activePanel]);

  // ── Init Local Media & Join ────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function initMedia() {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          setHasCamera(true);
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
          });
          setHasCamera(false);
          setIsVideoMuted(true);
        }

        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }

        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        socket.emit('join_team_meeting', {
          meetingId,
          workspaceId,
          user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, role: userRole },
        });
      } catch (err) {
        console.error('Failed to get media devices:', err);
      }
    }

    initMedia();
    loadAudioOutputs();

    return () => {
      active = false;
      cleanupAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  async function loadAudioOutputs() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(devices.filter((d) => d.kind === 'audiooutput'));
      } catch { /* silent */ }
    }
  }

  // ── WebRTC Mesh Socket Listeners ───────────────────────────────
  useEffect(() => {
    if (!socket || !localStream) return;

    function handleExistingParticipants(data: { participants: ParticipantItem[] }) {
      data.participants.forEach((peer) => {
        if (peer.socketId === socket.id) return;
        createPeerConnection(peer.socketId, peer.user, true);
      });
    }

    function handleUserJoined(data: { socketId: string; user: any }) {
      if (data.socketId === socket.id) return;
      createPeerConnection(data.socketId, data.user, false);
      addSystemChat(`${data.user.name} joined the meeting`);
    }

    async function handlePeerSignal(data: { fromSocketId: string; signal: any; fromUser?: any }) {
      let pc = peerConnectionsRef.current.get(data.fromSocketId);
      if (!pc && data.fromUser) pc = createPeerConnection(data.fromSocketId, data.fromUser, false);
      if (!pc) return;

      const { signal } = data;
      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const queued = pendingCandidatesRef.current.get(data.fromSocketId) || [];
          for (const c of queued) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          pendingCandidatesRef.current.delete(data.fromSocketId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('meeting_peer_signal', {
            meetingId, toSocketId: data.fromSocketId, signal: answer,
            fromUser: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const queued = pendingCandidatesRef.current.get(data.fromSocketId) || [];
          for (const c of queued) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          pendingCandidatesRef.current.delete(data.fromSocketId);
        } else if (signal.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
          } else {
            const list = pendingCandidatesRef.current.get(data.fromSocketId) || [];
            list.push(signal.candidate);
            pendingCandidatesRef.current.set(data.fromSocketId, list);
          }
        }
      } catch (err) {
        console.warn('Error handling peer signal:', err);
      }
    }

    function handleUserLeft(data: { socketId: string; userId?: string }) {
      const pc = peerConnectionsRef.current.get(data.socketId);
      if (pc) { pc.close(); peerConnectionsRef.current.delete(data.socketId); }
      setRemotePeers((prev) => {
        const next = new Map(prev);
        const leaving = next.get(data.socketId);
        if (leaving) addSystemChat(`${leaving.user.name} left the meeting`);
        next.delete(data.socketId);
        return next;
      });
      if (pinnedSocketId === data.socketId) setPinnedSocketId(null);
    }

    function handlePeerMediaToggle(data: {
      socketId: string; isMicMuted?: boolean; isVideoMuted?: boolean; isScreenSharing?: boolean; hasHandRaised?: boolean;
    }) {
      setRemotePeers((prev) => {
        const next = new Map(prev);
        const item = next.get(data.socketId);
        if (item) {
          next.set(data.socketId, {
            ...item,
            ...(data.isMicMuted !== undefined && { isMicMuted: data.isMicMuted }),
            ...(data.isVideoMuted !== undefined && { isVideoMuted: data.isVideoMuted }),
            ...(data.isScreenSharing !== undefined && { isScreenSharing: data.isScreenSharing }),
            ...(data.hasHandRaised !== undefined && { hasHandRaised: data.hasHandRaised }),
          });
        }
        return next;
      });
    }

    function handleMeetingChat(data: ChatMessage) {
      setChatMessages((prev) => [...prev, data]);
      setUnreadChatCount((prev) => activePanel === 'chat' ? 0 : prev + 1);
    }

    socket.on('meeting_existing_participants', handleExistingParticipants);
    socket.on('user_joined_team_meeting', handleUserJoined);
    socket.on('meeting_peer_signal', handlePeerSignal);
    socket.on('user_left_team_meeting', handleUserLeft);
    socket.on('peer_media_toggle', handlePeerMediaToggle);
    socket.on('meeting_chat_message', handleMeetingChat);

    return () => {
      socket.off('meeting_existing_participants', handleExistingParticipants);
      socket.off('user_joined_team_meeting', handleUserJoined);
      socket.off('meeting_peer_signal', handlePeerSignal);
      socket.off('user_left_team_meeting', handleUserLeft);
      socket.off('peer_media_toggle', handlePeerMediaToggle);
      socket.off('meeting_chat_message', handleMeetingChat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, localStream, activePanel]);

  function addSystemChat(text: string) {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        content: text,
        timestamp: Date.now(),
      },
    ]);
  }

  // ── Create Peer Connection ─────────────────────────────────────
  function createPeerConnection(targetSocketId: string, peerUser: any, isInitiator: boolean) {
    if (peerConnectionsRef.current.has(targetSocketId)) {
      return peerConnectionsRef.current.get(targetSocketId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(targetSocketId, pc);

    // Add local tracks to connection
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('meeting_peer_signal', {
          meetingId, toSocketId: targetSocketId,
          signal: { candidate: event.candidate },
        });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        // Try to restart ICE
        pc.restartIce();
      }
    };

    // Handle remote tracks
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!remoteStream.getTracks().find((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });

      setRemotePeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(targetSocketId);
        next.set(targetSocketId, { ...(existing || { socketId: targetSocketId, user: peerUser }), stream: remoteStream });
        return next;
      });
    };

    // Create offer if initiator
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('meeting_peer_signal', {
            meetingId, toSocketId: targetSocketId,
            signal: pc.localDescription,
            fromUser: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
          });
        })
        .catch(console.error);
    }

    // Register peer
    setRemotePeers((prev) => {
      const next = new Map(prev);
      if (!next.has(targetSocketId)) {
        next.set(targetSocketId, { socketId: targetSocketId, user: peerUser, stream: remoteStream });
      }
      return next;
    });

    return pc;
  }

  // ── Cleanup ────────────────────────────────────────────────────
  function cleanupAll() {
    socket.emit('leave_team_meeting', { meetingId, workspaceId });
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();

    const stream = localStreamRef.current;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    speakingTimersRef.current.forEach((t) => clearTimeout(t));
  }

  // ── Controls ───────────────────────────────────────────────────
  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const muted = !audioTrack.enabled;
      setIsMicMuted(muted);
      socket.emit('meeting_media_toggle', { meetingId, isMicMuted: muted });
    }
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const muted = !videoTrack.enabled;
      setIsVideoMuted(muted);
      socket.emit('meeting_media_toggle', { meetingId, isVideoMuted: muted });
    }
  }

  async function flipCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextMode } });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = stream.getVideoTracks()[0];
      if (oldVideoTrack) { stream.removeTrack(oldVideoTrack); oldVideoTrack.stop(); }
      stream.addTrack(newVideoTrack);
      setFacingMode(nextMode);
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(newVideoTrack);
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) {
      console.warn('Failed to flip camera:', err);
    }
  }

  async function toggleScreenShare() {
    const stream = localStreamRef.current;
    if (isScreenSharing) {
      // Stop screen share → restore camera
      try {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;
        }
        if (stream && hasCamera && !isVideoMuted) {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
          const camTrack = camStream.getVideoTracks()[0];
          const oldTrack = stream.getVideoTracks()[0];
          if (oldTrack) { stream.removeTrack(oldTrack); oldTrack.stop(); }
          stream.addTrack(camTrack);
          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(camTrack);
          });
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        }
        setIsScreenSharing(false);
        socket.emit('meeting_media_toggle', { meetingId, isScreenSharing: false });
      } catch (e) {
        setIsScreenSharing(false);
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenStreamRef.current = screenStream;

        screenTrack.onended = () => toggleScreenShare();

        if (stream) {
          const oldTrack = stream.getVideoTracks()[0];
          if (oldTrack) { stream.removeTrack(oldTrack); oldTrack.stop(); }
          stream.addTrack(screenTrack);
        }

        // Add/replace on all peer connections
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          } else {
            // No video sender exists yet — add the track
            if (stream) pc.addTrack(screenTrack, stream);
          }
        });

        if (localVideoRef.current && stream) localVideoRef.current.srcObject = stream;
        setIsScreenSharing(true);
        socket.emit('meeting_media_toggle', { meetingId, isScreenSharing: true });
      } catch (err) {
        console.warn('Screen sharing cancelled or failed:', err);
      }
    }
  }

  function toggleHandRaise() {
    const raised = !hasHandRaised;
    setHasHandRaised(raised);
    socket.emit('meeting_media_toggle', { meetingId, hasHandRaised: raised });
    if (raised) addSystemChat(`${user.name} raised their hand ✋`);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // ── In-Meeting Recording ───────────────────────────────────────
  function startRecording() {
    const stream = localStreamRef.current;
    if (!stream || isRecording) return;
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-${meetingId.slice(0, 8)}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((p) => p + 1), 1000);
      socket.emit('meeting_media_toggle', { meetingId, isRecording: true });
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    socket.emit('meeting_media_toggle', { meetingId, isRecording: false });
  }

  // ── In-Meeting Chat ────────────────────────────────────────────
  function sendChatMessage() {
    if (!chatInput.trim()) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.avatarUrl,
      content: chatInput.trim(),
      timestamp: Date.now(),
    };
    socket.emit('meeting_chat_message', { meetingId, ...msg });
    setChatMessages((prev) => [...prev, msg]);
    setChatInput('');
  }

  // ── Invite Members ─────────────────────────────────────────────
  function inviteMember(memberId: string, memberName: string) {
    socket.emit('call_user', {
      toUserId: memberId,
      caller: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
      isVideo: true,
      meetingId,
    });
    setInvitedIds((prev) => new Set([...prev, memberId]));
  }

  function copyMeetingLink() {
    const url = `${window.location.origin}${window.location.pathname}?meeting=${meetingId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyLinkStatus(true);
      setTimeout(() => setCopyLinkStatus(false), 2000);
    });
  }

  // ── Grid Layout ────────────────────────────────────────────────
  const peersArray = Array.from(remotePeers.values());
  const totalCount = peersArray.length + 1;

  const gridLayoutClass = useMemo(() => {
    if (pinnedSocketId) return 'flex flex-col';
    if (totalCount === 1) return 'grid-cols-1';
    if (totalCount === 2) return 'grid-cols-1 md:grid-cols-2';
    if (totalCount <= 4) return 'grid-cols-2';
    if (totalCount <= 6) return 'grid-cols-2 md:grid-cols-3';
    if (totalCount <= 9) return 'grid-cols-3';
    if (totalCount <= 16) return 'grid-cols-3 md:grid-cols-4';
    return 'grid-cols-4 md:grid-cols-5';
  }, [totalCount, pinnedSocketId]);

  // ── Filtered members for invite (exclude already in meeting) ───
  const peerUserIds = new Set([user.id, ...peersArray.map((p) => p.user.id)]);
  const filteredMembers = members
    .filter((m) => !peerUserIds.has(m.id) && m.name.toLowerCase().includes(inviteSearch.toLowerCase()));

  const sidebarOpen = activePanel !== 'none';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] w-screen h-[100dvh] bg-[#0A0D14] flex flex-col overflow-hidden text-white select-none"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── TOP HEADER ──────────────────────────────────────────── */}
      <div className="h-14 px-4 sm:px-5 bg-[#111827]/90 backdrop-blur-md border-b border-white/5 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-600/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs">
                {meetingTitle}
              </h2>
              {channelName && (
                <span className="text-[11px] font-semibold text-violet-400 hidden sm:inline">#{channelName}</span>
              )}
              {isRecording && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 border border-rose-500/50 text-rose-400 flex items-center gap-1 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  REC {formatDuration(recordingDuration)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span className="flex items-center gap-1 text-emerald-400 font-mono font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {formatDuration(callDuration)}
              </span>
              <span>•</span>
              <span className="text-slate-300">{totalCount} participant{totalCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Header right */}
        <div className="flex items-center gap-2 shrink-0">
          {isScreenSharing && (
            <span className="hidden sm:flex px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 items-center gap-1.5">
              <MonitorUp className="h-3 w-3" /> Sharing Screen
            </span>
          )}
          {hasHandRaised && (
            <span className="hidden sm:flex px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 items-center gap-1.5">
              ✋ Hand Raised
            </span>
          )}
          <button
            type="button"
            onClick={() => setScreenFitMode((p) => p === 'cover' ? 'contain' : 'cover')}
            className="hidden sm:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold items-center gap-1.5 transition-colors"
            title="Toggle Fit/Fill"
          >
            {screenFitMode === 'cover' ? 'Fit' : 'Fill'}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Video Stage */}
        <div className="flex-1 overflow-hidden relative p-2 sm:p-3 flex flex-col min-w-0">
          {pinnedSocketId ? (
            /* Spotlight / Pinned Mode */
            <div className="flex-1 flex flex-col md:flex-row gap-2.5 h-full overflow-hidden">
              {/* Pinned Hero */}
              <div className="flex-1 rounded-2xl overflow-hidden bg-[#111827] border border-white/5 relative shadow-2xl min-h-0">
                {pinnedSocketId === 'self' ? (
                  <LocalVideoTile
                    localVideoRef={localVideoRef}
                    user={user}
                    isVideoMuted={isVideoMuted}
                    isMicMuted={isMicMuted}
                    screenFitMode={screenFitMode}
                    isScreenSharing={isScreenSharing}
                    onUnpin={() => setPinnedSocketId(null)}
                    isPinned
                    hasHandRaised={hasHandRaised}
                  />
                ) : (() => {
                  const peer = remotePeers.get(pinnedSocketId);
                  if (!peer) return null;
                  return (
                    <div className="w-full h-full relative">
                      <PeerVideoTile peer={peer} screenFitMode={screenFitMode} />
                      <button
                        type="button"
                        onClick={() => setPinnedSocketId(null)}
                        className="absolute top-3 right-3 p-1.5 rounded-xl bg-black/60 text-white hover:bg-black/80 z-10"
                      >
                        <PinOff className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Thumbnail Strip */}
              <div className="h-28 md:h-full md:w-52 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0 pb-1 md:pb-0">
                {pinnedSocketId !== 'self' && (
                  <ThumbnailTile
                    label={`${user.name} (You)`}
                    onClick={() => setPinnedSocketId('self')}
                    isVideoMuted={isVideoMuted}
                    avatarUrl={user.avatarUrl}
                    render={() => (
                      <video
                        ref={(el) => { if (el && localStreamRef.current) el.srcObject = localStreamRef.current; }}
                        autoPlay playsInline muted
                        className="w-full h-full object-cover"
                      />
                    )}
                  />
                )}
                {peersArray.filter((p) => p.socketId !== pinnedSocketId).map((peer) => (
                  <ThumbnailTile
                    key={peer.socketId}
                    label={peer.user.name}
                    onClick={() => setPinnedSocketId(peer.socketId)}
                    isVideoMuted={!!peer.isVideoMuted}
                    avatarUrl={peer.user.avatarUrl}
                    render={() => <PeerVideoTile peer={peer} screenFitMode="cover" />}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Grid Mode */
            <div className={`grid ${gridLayoutClass} gap-2.5 h-full w-full overflow-y-auto`}>
              {/* Local tile */}
              <div className="relative rounded-2xl overflow-hidden bg-[#111827] border border-white/5 shadow-md group flex items-center justify-center min-h-[120px]">
                <LocalVideoTile
                  localVideoRef={localVideoRef}
                  user={user}
                  isVideoMuted={isVideoMuted}
                  isMicMuted={isMicMuted}
                  screenFitMode={screenFitMode}
                  isScreenSharing={isScreenSharing}
                  onPin={() => setPinnedSocketId('self')}
                  hasHandRaised={hasHandRaised}
                />
              </div>

              {/* Remote tiles */}
              {peersArray.map((peer) => (
                <div
                  key={peer.socketId}
                  className="relative rounded-2xl overflow-hidden bg-[#111827] border border-white/5 shadow-md group flex items-center justify-center min-h-[120px]"
                >
                  <PeerVideoTile peer={peer} screenFitMode={screenFitMode} />

                  {/* Name/status overlay */}
                  <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/60 backdrop-blur-sm text-[11px] font-semibold text-white">
                    {peer.hasHandRaised && <span className="text-amber-400">✋</span>}
                    <span className="truncate max-w-[100px]">{peer.user.name}</span>
                    {peer.isMicMuted ? <MicOff className="h-3 w-3 text-rose-400 shrink-0" /> : <Mic className="h-3 w-3 text-emerald-400 shrink-0" />}
                    {peer.isScreenSharing && <MonitorUp className="h-3 w-3 text-indigo-400 shrink-0" />}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPinnedSocketId(peer.socketId)}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Pin to spotlight"
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SIDE PANEL ─────────────────────────────────────────── */}
        {sidebarOpen && (
          <aside className="w-72 sm:w-80 bg-[#111827] border-l border-white/5 flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-right duration-200 z-20">
            {/* Panel tabs */}
            <div className="h-12 flex border-b border-white/5 shrink-0">
              {(['participants', 'chat', 'invite'] as const).map((panel) => (
                <button
                  key={panel}
                  type="button"
                  onClick={() => setActivePanel(panel)}
                  className={`flex-1 text-xs font-semibold capitalize transition-colors relative ${
                    activePanel === panel
                      ? 'text-white bg-white/5'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/3'
                  }`}
                >
                  {panel === 'chat' && unreadChatCount > 0 && activePanel !== 'chat' && (
                    <span className="absolute top-2 right-4 h-4 w-4 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center">
                      {unreadChatCount > 9 ? '9+' : unreadChatCount}
                    </span>
                  )}
                  {panel}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setActivePanel('none')}
                className="px-3 text-slate-500 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Participants panel */}
            {activePanel === 'participants' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  In Meeting — {totalCount}
                </div>
                {/* Self */}
                <ParticipantRow
                  name={`${user.name} (You)`}
                  avatarUrl={user.avatarUrl}
                  role={userRole}
                  isMicMuted={isMicMuted}
                  isVideoMuted={isVideoMuted}
                  isScreenSharing={isScreenSharing}
                  hasHandRaised={hasHandRaised}
                />
                {peersArray.map((peer) => (
                  <ParticipantRow
                    key={peer.socketId}
                    name={peer.user.name}
                    avatarUrl={peer.user.avatarUrl}
                    role={peer.user.role}
                    isMicMuted={peer.isMicMuted}
                    isVideoMuted={peer.isVideoMuted}
                    isScreenSharing={peer.isScreenSharing}
                    hasHandRaised={peer.hasHandRaised}
                    onPin={() => { setPinnedSocketId(peer.socketId); setActivePanel('none'); }}
                  />
                ))}
              </div>
            )}

            {/* Chat panel */}
            {activePanel === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-slate-600 text-xs py-8">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No messages yet. Say hello! 👋
                    </div>
                  )}
                  {chatMessages.map((msg) =>
                    msg.senderId === 'system' ? (
                      <div key={msg.id} className="text-center text-[10px] text-slate-600 py-1">
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${msg.senderId === user.id ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <img
                          src={msg.senderAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msg.senderName)}`}
                          alt={msg.senderName}
                          className="h-7 w-7 rounded-full border border-white/10 object-cover shrink-0 mt-0.5"
                        />
                        <div className={`max-w-[75%] ${msg.senderId === user.id ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                          <div className={`flex items-center gap-1.5 ${msg.senderId === user.id ? 'flex-row-reverse' : ''}`}>
                            <span className="text-[10px] font-bold text-slate-400">{msg.senderId === user.id ? 'You' : msg.senderName}</span>
                            <span className="text-[9px] text-slate-600">{formatTime(msg.timestamp)}</span>
                          </div>
                          <div
                            className={`px-3 py-2 rounded-2xl text-[12px] leading-relaxed break-words ${
                              msg.senderId === user.id
                                ? 'bg-violet-600 text-white rounded-tr-sm'
                                : 'bg-white/8 text-slate-200 rounded-tl-sm'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input */}
                <div className="p-3 border-t border-white/5 shrink-0">
                  <div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/10 px-3 py-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
                      }}
                      placeholder="Message everyone..."
                      className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim()}
                      className="p-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-violet-500 transition-colors shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Invite panel */}
            {activePanel === 'invite' && (
              <div className="flex-1 flex flex-col min-h-0 p-3 gap-3">
                {/* Copy link */}
                <button
                  type="button"
                  onClick={copyMeetingLink}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-semibold transition-colors"
                >
                  {copyLinkStatus ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  {copyLinkStatus ? 'Link Copied!' : 'Copy Meeting Link'}
                </button>

                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Invite from Workspace
                </div>

                <div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/10 px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={inviteSearch}
                    onChange={(e) => setInviteSearch(e.target.value)}
                    placeholder="Search members..."
                    className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {filteredMembers.length === 0 && (
                    <div className="text-center text-slate-600 text-xs py-6">
                      {members.length === 0 ? 'All members are in the call' : 'No members found'}
                    </div>
                  )}
                  {filteredMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/3 hover:bg-white/6 transition-colors"
                    >
                      <img
                        src={m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name)}`}
                        alt={m.name}
                        className="h-8 w-8 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">{m.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{m.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => inviteMember(m.id, m.name)}
                        disabled={invitedIds.has(m.id)}
                        className={`shrink-0 p-1.5 rounded-lg text-xs font-semibold transition-all ${
                          invitedIds.has(m.id)
                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed'
                            : 'bg-violet-600 hover:bg-violet-500 text-white'
                        }`}
                        title={invitedIds.has(m.id) ? 'Invite sent' : 'Invite to meeting'}
                      >
                        {invitedIds.has(m.id) ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── CONTROLS TOOLBAR ─────────────────────────────────────── */}
      <div className="px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-[#111827]/95 backdrop-blur-md border-t border-white/5 flex items-center justify-center gap-2 flex-wrap shrink-0 z-30">
        {/* Mic */}
        <CtrlBtn
          active={!isMicMuted}
          danger={isMicMuted}
          onClick={toggleMic}
          title={isMicMuted ? 'Unmute' : 'Mute'}
        >
          {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </CtrlBtn>

        {/* Camera */}
        <CtrlBtn
          active={!isVideoMuted && hasCamera}
          danger={isVideoMuted || !hasCamera}
          onClick={toggleCamera}
          title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {isVideoMuted || !hasCamera ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </CtrlBtn>

        {/* Flip Camera (mobile) */}
        {hasCamera && (
          <CtrlBtn active onClick={flipCamera} title="Flip Camera" className="hidden sm:flex">
            <RotateCcw className="h-5 w-5" />
          </CtrlBtn>
        )}

        {/* Screen Share */}
        <CtrlBtn
          active={!isScreenSharing}
          accent={isScreenSharing}
          onClick={toggleScreenShare}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          <MonitorUp className="h-5 w-5" />
        </CtrlBtn>

        {/* Hand Raise */}
        <CtrlBtn
          active={!hasHandRaised}
          accent={hasHandRaised}
          onClick={toggleHandRaise}
          title={hasHandRaised ? 'Lower Hand' : 'Raise Hand'}
        >
          <span className="text-base leading-none">{hasHandRaised ? '✋' : '🤚'}</span>
        </CtrlBtn>

        {/* Recording */}
        <CtrlBtn
          active={!isRecording}
          danger={isRecording}
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          {isRecording ? <Square className="h-5 w-5" /> : <Disc className="h-5 w-5" />}
        </CtrlBtn>

        {/* Separator */}
        <div className="h-8 w-px bg-white/10 mx-1" />

        {/* Chat toggle */}
        <CtrlBtn
          active={activePanel !== 'chat'}
          accent={activePanel === 'chat'}
          onClick={() => setActivePanel((p) => p === 'chat' ? 'none' : 'chat')}
          title="Meeting Chat"
          badge={activePanel !== 'chat' && unreadChatCount > 0 ? String(unreadChatCount > 9 ? '9+' : unreadChatCount) : undefined}
        >
          <MessageSquare className="h-5 w-5" />
        </CtrlBtn>

        {/* Participants */}
        <CtrlBtn
          active={activePanel !== 'participants'}
          accent={activePanel === 'participants'}
          onClick={() => setActivePanel((p) => p === 'participants' ? 'none' : 'participants')}
          title="Participants"
        >
          <Users className="h-5 w-5" />
          <span className="text-xs font-bold">{totalCount}</span>
        </CtrlBtn>

        {/* Invite */}
        <CtrlBtn
          active={activePanel !== 'invite'}
          accent={activePanel === 'invite'}
          onClick={() => setActivePanel((p) => p === 'invite' ? 'none' : 'invite')}
          title="Invite People"
        >
          <UserPlus className="h-5 w-5" />
        </CtrlBtn>

        {/* Separator */}
        <div className="h-8 w-px bg-white/10 mx-1" />

        {/* Leave */}
        <button
          type="button"
          onClick={() => { cleanupAll(); onLeaveMeeting(); }}
          className="px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/20 flex items-center gap-2 active:scale-95"
          title="Leave meeting"
        >
          <PhoneOff className="h-4 w-4" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </div>
  );
}

// ── Control Button ─────────────────────────────────────────────────
function CtrlBtn({
  children,
  onClick,
  title,
  active = true,
  danger = false,
  accent = false,
  badge,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
  accent?: boolean;
  badge?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`relative p-3 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 ${
        danger
          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
          : accent
          ? 'bg-violet-600 text-white shadow-violet-600/20 hover:bg-violet-500'
          : 'bg-white/8 hover:bg-white/12 text-slate-300 hover:text-white border border-white/5'
      } ${className}`}
    >
      {children}
      {badge && (
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Local Video Tile ───────────────────────────────────────────────
function LocalVideoTile({
  localVideoRef,
  user,
  isVideoMuted,
  isMicMuted,
  screenFitMode,
  isScreenSharing,
  onPin,
  onUnpin,
  isPinned = false,
  hasHandRaised,
}: {
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  user: any;
  isVideoMuted: boolean;
  isMicMuted: boolean;
  screenFitMode: 'cover' | 'contain';
  isScreenSharing?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  isPinned?: boolean;
  hasHandRaised?: boolean;
}) {
  return (
    <div className="w-full h-full relative group">
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full ${screenFitMode === 'contain' ? 'object-contain' : 'object-cover'} ${isVideoMuted ? 'opacity-0' : 'opacity-100'}`}
      />
      {isVideoMuted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F1623]">
          <img
            src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
            alt={user.name}
            className="h-20 w-20 rounded-full border-2 border-white/10 object-cover"
          />
          <span className="mt-2.5 text-sm font-bold text-slate-300">{user.name}</span>
        </div>
      )}
      {/* Bottom overlay */}
      <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/60 backdrop-blur-sm text-[11px] font-semibold text-white">
        {hasHandRaised && <span className="text-amber-400">✋</span>}
        <span>{user.name} (You)</span>
        {isMicMuted ? <MicOff className="h-3 w-3 text-rose-400" /> : <Mic className="h-3 w-3 text-emerald-400" />}
        {isScreenSharing && <MonitorUp className="h-3 w-3 text-indigo-400" />}
      </div>
      {/* Pin/unpin button */}
      {isPinned ? (
        <button
          type="button"
          onClick={onUnpin}
          className="absolute top-3 right-3 p-1.5 rounded-xl bg-black/60 text-white hover:bg-black/80 z-10"
        >
          <PinOff className="h-4 w-4" />
        </button>
      ) : onPin ? (
        <button
          type="button"
          onClick={onPin}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Pin to spotlight"
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

// ── Thumbnail Tile (strip view) ────────────────────────────────────
function ThumbnailTile({
  label,
  onClick,
  isVideoMuted,
  avatarUrl,
  render,
}: {
  label: string;
  onClick: () => void;
  isVideoMuted: boolean;
  avatarUrl?: string;
  render: () => React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className="w-36 md:w-full h-24 md:h-32 rounded-xl bg-[#0F1623] border border-white/5 overflow-hidden shrink-0 relative cursor-pointer hover:border-violet-500/50 transition-all"
    >
      {isVideoMuted ? (
        <div className="w-full h-full flex items-center justify-center">
          <img
            src={avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=User`}
            alt={label}
            className="h-10 w-10 rounded-full border border-white/10"
          />
        </div>
      ) : (
        render()
      )}
      <span className="absolute bottom-1 left-1.5 text-[10px] font-bold text-white bg-black/60 px-1.5 rounded-md truncate max-w-[90%]">
        {label}
      </span>
    </div>
  );
}

// ── Participant Row ────────────────────────────────────────────────
function ParticipantRow({
  name,
  avatarUrl,
  role,
  isMicMuted,
  isVideoMuted,
  isScreenSharing,
  hasHandRaised,
  onPin,
}: {
  name: string;
  avatarUrl?: string;
  role?: WorkspaceRole;
  isMicMuted?: boolean;
  isVideoMuted?: boolean;
  isScreenSharing?: boolean;
  hasHandRaised?: boolean;
  onPin?: () => void;
}) {
  const roleConf = ROLE_CONFIGS[role || 'MEMBER'];
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/3 hover:bg-white/6 transition-colors group">
      <img
        src={avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`}
        alt={name}
        className="h-8 w-8 rounded-lg object-cover border border-white/10 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1">
          {hasHandRaised && <span className="text-amber-400 shrink-0">✋</span>}
          {name}
        </div>
        <div className="text-[10px] text-slate-500">{roleConf?.label || 'Participant'}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isScreenSharing && <span title="Sharing Screen"><MonitorUp className="h-3.5 w-3.5 text-indigo-400" /></span>}
        {isMicMuted
          ? <MicOff className="h-3.5 w-3.5 text-rose-400" />
          : <Mic className="h-3.5 w-3.5 text-emerald-400" />}
        {onPin && (
          <button
            type="button"
            onClick={onPin}
            className="p-1 rounded-lg text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
            title="Spotlight"
          >
            <Pin className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Remote Peer Video Tile ─────────────────────────────────────────
function PeerVideoTile({
  peer,
  screenFitMode,
}: {
  peer: ParticipantItem;
  screenFitMode: 'cover' | 'contain';
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      videoRef.current.play().catch(() => {});
    }
  }, [peer.stream]);

  if (peer.isVideoMuted || !peer.stream || peer.stream.getVideoTracks().length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0F1623]">
        <img
          src={peer.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(peer.user.name)}`}
          alt={peer.user.name}
          className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-white/10 object-cover"
        />
        <span className="mt-2.5 text-xs font-bold text-slate-300">{peer.user.name}</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className={`w-full h-full ${screenFitMode === 'contain' ? 'object-contain' : 'object-cover'} bg-[#0F1623]`}
    />
  );
}
