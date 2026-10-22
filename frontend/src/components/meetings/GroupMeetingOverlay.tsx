'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Volume2,
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
  Check,
  Shield,
  Crown,
  Sparkles,
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
}

interface GroupMeetingOverlayProps {
  meetingId: string;
  meetingTitle: string;
  channelName?: string;
  workspaceId: string;
  user: User;
  userRole?: WorkspaceRole;
  socket: any;
  onLeaveMeeting: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function GroupMeetingOverlay({
  meetingId,
  meetingTitle,
  channelName,
  workspaceId,
  user,
  userRole,
  socket,
  onLeaveMeeting,
}: GroupMeetingOverlayProps) {
  // Local state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasCamera, setHasCamera] = useState(true);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [screenFitMode, setScreenFitMode] = useState<'cover' | 'contain'>('cover');
  const [callDuration, setCallDuration] = useState(0);

  // Participants & Multi-Peer Mesh
  const [remotePeers, setRemotePeers] = useState<Map<string, ParticipantItem>>(new Map());
  const [pinnedSocketId, setPinnedSocketId] = useState<string | null>(null);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Audio Device Selection
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('default');
  const [showSpeakerMenu, setShowSpeakerMenu] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, any[]>>(new Map());
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Start Meeting Timer
  useEffect(() => {
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, []);

  // Fullscreen Listener
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 1. Initialize Local Media Stream
  useEffect(() => {
    let active = true;

    async function initMedia() {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
          setHasCamera(true);
        } catch (err) {
          console.warn('Camera failed, falling back to audio only:', err);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
          });
          setHasCamera(false);
          setIsVideoMuted(true);
        }

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Join Meeting Room via Socket
        socket.emit('join_team_meeting', {
          meetingId,
          workspaceId,
          user: {
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: userRole,
          },
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
  }, [meetingId]);

  // Load Audio Outputs
  async function loadAudioOutputs() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter((d) => d.kind === 'audiooutput');
        setAudioDevices(outputs);
      } catch (e) {
        console.warn('Could not enumerate audio outputs:', e);
      }
    }
  }

  // 2. Multi-Peer WebRTC Mesh Socket Listeners
  useEffect(() => {
    if (!socket || !localStream) return;

    // A. Received list of existing peers in the room -> We initiate calls to them
    function handleExistingParticipants(data: { participants: ParticipantItem[] }) {
      data.participants.forEach((peer) => {
        if (peer.socketId === socket.id) return;
        createPeerConnection(peer.socketId, peer.user, true);
      });
    }

    // B. New user joined the room -> We register them and wait for their offer
    function handleUserJoined(data: { socketId: string; user: any }) {
      if (data.socketId === socket.id) return;
      createPeerConnection(data.socketId, data.user, false);
    }

    // C. P2P Signal forwarded from another peer (offer, answer, candidate)
    async function handlePeerSignal(data: { fromSocketId: string; signal: any; fromUser?: any }) {
      let pc = peerConnectionsRef.current.get(data.fromSocketId);
      if (!pc && data.fromUser) {
        pc = createPeerConnection(data.fromSocketId, data.fromUser, false);
      }
      if (!pc) return;

      const { signal } = data;
      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          // Process any queued ICE candidates
          const queued = pendingCandidatesRef.current.get(data.fromSocketId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingCandidatesRef.current.delete(data.fromSocketId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('meeting_peer_signal', {
            meetingId,
            toSocketId: data.fromSocketId,
            signal: answer,
            fromUser: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const queued = pendingCandidatesRef.current.get(data.fromSocketId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingCandidatesRef.current.delete(data.fromSocketId);
        } else if (signal.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
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

    // D. User left room
    function handleUserLeft(data: { socketId: string }) {
      const pc = peerConnectionsRef.current.get(data.socketId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.socketId);
      }
      setRemotePeers((prev) => {
        const next = new Map(prev);
        next.delete(data.socketId);
        return next;
      });
      if (pinnedSocketId === data.socketId) {
        setPinnedSocketId(null);
      }
    }

    // E. Media toggle from peer
    function handlePeerMediaToggle(data: { socketId: string; isMicMuted?: boolean; isVideoMuted?: boolean }) {
      setRemotePeers((prev) => {
        const next = new Map(prev);
        const item = next.get(data.socketId);
        if (item) {
          next.set(data.socketId, {
            ...item,
            isMicMuted: data.isMicMuted !== undefined ? data.isMicMuted : item.isMicMuted,
            isVideoMuted: data.isVideoMuted !== undefined ? data.isVideoMuted : item.isVideoMuted,
          });
        }
        return next;
      });
    }

    socket.on('meeting_existing_participants', handleExistingParticipants);
    socket.on('user_joined_team_meeting', handleUserJoined);
    socket.on('meeting_peer_signal', handlePeerSignal);
    socket.on('user_left_team_meeting', handleUserLeft);
    socket.on('peer_media_toggle', handlePeerMediaToggle);

    return () => {
      socket.off('meeting_existing_participants', handleExistingParticipants);
      socket.off('user_joined_team_meeting', handleUserJoined);
      socket.off('meeting_peer_signal', handlePeerSignal);
      socket.off('user_left_team_meeting', handleUserLeft);
      socket.off('peer_media_toggle', handlePeerMediaToggle);
    };
  }, [socket, localStream]);

  // Helper to create RTCPeerConnection for a mesh participant
  function createPeerConnection(targetSocketId: string, peerUser: any, isInitiator: boolean) {
    if (peerConnectionsRef.current.has(targetSocketId)) {
      return peerConnectionsRef.current.get(targetSocketId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(targetSocketId, pc);

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('meeting_peer_signal', {
          meetingId,
          toSocketId: targetSocketId,
          signal: { candidate: event.candidate },
        });
      }
    };

    // Handle remote stream tracks
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });

      setRemotePeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(targetSocketId) || {
          socketId: targetSocketId,
          user: peerUser,
        };
        next.set(targetSocketId, {
          ...existing,
          stream: remoteStream,
        });
        return next;
      });
    };

    // If initiator, create and send offer
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('meeting_peer_signal', {
            meetingId,
            toSocketId: targetSocketId,
            signal: pc.localDescription,
            fromUser: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
          });
        })
        .catch(console.error);
    }

    // Register peer in state
    setRemotePeers((prev) => {
      const next = new Map(prev);
      next.set(targetSocketId, {
        socketId: targetSocketId,
        user: peerUser,
        stream: remoteStream,
      });
      return next;
    });

    return pc;
  }

  // Cleanup all
  function cleanupAll() {
    socket.emit('leave_team_meeting', { meetingId, workspaceId });
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();

    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }

  // Controls Actions
  function toggleMic() {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const muted = !audioTrack.enabled;
      setIsMicMuted(muted);
      socket.emit('meeting_media_toggle', { meetingId, isMicMuted: muted });
    }
  }

  function toggleCamera() {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const muted = !videoTrack.enabled;
      setIsVideoMuted(muted);
      socket.emit('meeting_media_toggle', { meetingId, isVideoMuted: muted });
    }
  }

  async function flipCamera() {
    if (!localStream) return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStream.getVideoTracks()[0];

      if (oldVideoTrack) {
        localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      localStream.addTrack(newVideoTrack);
      setFacingMode(nextMode);

      // Replace track on all peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });
    } catch (err) {
      console.warn('Failed to flip camera:', err);
    }
  }

  async function toggleScreenShare() {
    if (isScreenSharing) {
      // Revert to camera
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
        });
        const camTrack = camStream.getVideoTracks()[0];
        const oldTrack = localStream?.getVideoTracks()[0];
        if (oldTrack) {
          localStream?.removeTrack(oldTrack);
          oldTrack.stop();
        }
        if (camTrack && localStream) {
          localStream.addTrack(camTrack);
          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(camTrack);
          });
        }
        setIsScreenSharing(false);
      } catch (e) {
        console.error(e);
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        const oldTrack = localStream?.getVideoTracks()[0];
        if (oldTrack && localStream) {
          localStream.removeTrack(oldTrack);
          oldTrack.stop();
          localStream.addTrack(screenTrack);
        }

        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen sharing cancelled:', err);
      }
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // Format Duration
  function formatDuration(sec: number) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  const peersArray = Array.from(remotePeers.values());
  const totalCount = peersArray.length + 1; // peers + self

  // Compute Zoom/Teams dynamic grid class
  const gridLayoutClass = useMemo(() => {
    if (pinnedSocketId) return 'flex flex-col';
    if (totalCount === 1) return 'grid-cols-1';
    if (totalCount === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (totalCount <= 4) return 'grid-cols-2 grid-rows-2';
    if (totalCount <= 6) return 'grid-cols-2 md:grid-cols-3';
    if (totalCount <= 9) return 'grid-cols-2 sm:grid-cols-3';
    return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
  }, [totalCount, pinnedSocketId]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 w-screen h-[100dvh] bg-slate-950 flex flex-col overflow-hidden text-white select-none animate-in fade-in duration-200"
    >
      {/* 1. Sleek Floating Top Header */}
      <div className="h-14 px-4 sm:px-6 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-600/30">
            <Users className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                {meetingTitle}
              </h2>
              {channelName && (
                <span className="text-[11px] font-semibold text-indigo-300 hidden sm:inline">
                  #{channelName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 font-mono font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {formatDuration(callDuration)}
              </span>
              <span>•</span>
              <span className="text-slate-300 font-medium">
                {totalCount} {totalCount === 1 ? 'participant' : 'participants'}
              </span>
            </div>
          </div>
        </div>

        {/* Header Right Badges & Toggles */}
        <div className="flex items-center gap-2 shrink-0">
          {isScreenSharing && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/20 border border-indigo-500/60 text-indigo-300 flex items-center gap-1.5 animate-pulse">
              <MonitorUp className="h-3 w-3" />
              <span className="hidden sm:inline">Sharing Screen</span>
            </span>
          )}

          {/* Fit / Fill Aspect Ratio Toggle */}
          <button
            type="button"
            onClick={() => setScreenFitMode((prev) => (prev === 'cover' ? 'contain' : 'cover'))}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title={screenFitMode === 'cover' ? 'Switch to Fit Screen (no crop)' : 'Switch to Fill Screen'}
          >
            <span>{screenFitMode === 'cover' ? 'Fill' : 'Fit'}</span>
          </button>

          {/* True Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 2. Main Video Stage (Zoom / Teams Responsive Grid) */}
      <div className="flex-1 overflow-hidden relative p-2 sm:p-3 bg-slate-950 flex flex-col justify-center">
        {pinnedSocketId ? (
          /* Spotlight / Pinned Mode */
          <div className="flex-1 flex flex-col md:flex-row gap-3 h-full overflow-hidden">
            {/* Pinned Hero Tile */}
            <div className="flex-1 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 relative shadow-2xl">
              {(() => {
                if (pinnedSocketId === 'self') {
                  return (
                    <div className="w-full h-full relative flex items-center justify-center bg-slate-900">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full ${
                          screenFitMode === 'contain' ? 'object-contain' : 'object-cover'
                        } ${isVideoMuted ? 'opacity-0' : 'opacity-100'}`}
                      />
                      {isVideoMuted && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <img
                            src={user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                            alt={user.name}
                            className="h-24 w-24 rounded-full border-4 border-slate-700"
                          />
                          <span className="mt-3 text-sm font-bold text-slate-300">{user.name} (You)</span>
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <button
                          type="button"
                          onClick={() => setPinnedSocketId(null)}
                          className="p-1.5 rounded-xl bg-black/60 text-white hover:bg-black/80"
                          title="Unpin"
                        >
                          <PinOff className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                }
                const peer = remotePeers.get(pinnedSocketId);
                if (!peer) return null;
                return (
                  <div className="w-full h-full relative flex items-center justify-center bg-slate-900">
                    <PeerVideoTile peer={peer} screenFitMode={screenFitMode} />
                    <div className="absolute top-3 right-3">
                      <button
                        type="button"
                        onClick={() => setPinnedSocketId(null)}
                        className="p-1.5 rounded-xl bg-black/60 text-white hover:bg-black/80"
                        title="Unpin"
                      >
                        <PinOff className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Thumbnail Strip for Other Participants */}
            <div className="h-28 md:h-full md:w-56 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0">
              {/* Self Thumbnail */}
              {pinnedSocketId !== 'self' && (
                <div
                  onClick={() => setPinnedSocketId('self')}
                  className="w-36 md:w-full h-24 md:h-32 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 relative cursor-pointer hover:border-indigo-500 transition-all"
                >
                  <video
                    ref={(el) => {
                      if (el && localStream) el.srcObject = localStream;
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-2 text-[10px] font-bold text-white bg-black/60 px-1 rounded">
                    You
                  </span>
                </div>
              )}
              {peersArray
                .filter((p) => p.socketId !== pinnedSocketId)
                .map((peer) => (
                  <div
                    key={peer.socketId}
                    onClick={() => setPinnedSocketId(peer.socketId)}
                    className="w-36 md:w-full h-24 md:h-32 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 relative cursor-pointer hover:border-indigo-500 transition-all"
                  >
                    <PeerVideoTile peer={peer} screenFitMode="cover" />
                  </div>
                ))}
            </div>
          </div>
        ) : (
          /* Grid Mode: Dynamic 1 to 16+ responsive grid */
          <div className={`grid ${gridLayoutClass} gap-2.5 h-full w-full overflow-y-auto max-h-full`}>
            {/* 1. Local User Tile */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-md group flex items-center justify-center min-h-[140px]">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full ${
                  screenFitMode === 'contain' ? 'object-contain' : 'object-cover'
                } ${isVideoMuted ? 'opacity-0' : 'opacity-100'}`}
              />

              {isVideoMuted && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-900/90">
                  <div className="relative">
                    <img
                      src={user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                      alt={user.name}
                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-slate-700 object-cover shadow-lg"
                    />
                  </div>
                  <span className="mt-2 text-xs font-bold text-slate-200">{user.name}</span>
                </div>
              )}

              {/* Tag / Pin Button */}
              <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/60 backdrop-blur-xs text-[11px] font-semibold text-white">
                <span>{user.name} (You)</span>
                {isMicMuted ? (
                  <MicOff className="h-3 w-3 text-rose-400" />
                ) : (
                  <Mic className="h-3 w-3 text-emerald-400" />
                )}
              </div>

              <button
                type="button"
                onClick={() => setPinnedSocketId('self')}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Pin video to large view"
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 2. Remote Participants Tiles */}
            {peersArray.map((peer) => (
              <div
                key={peer.socketId}
                className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-md group flex items-center justify-center min-h-[140px]"
              >
                <PeerVideoTile peer={peer} screenFitMode={screenFitMode} />

                {/* Name & Mic status tag */}
                <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/60 backdrop-blur-xs text-[11px] font-semibold text-white">
                  <span>{peer.user.name}</span>
                  {peer.isMicMuted ? (
                    <MicOff className="h-3 w-3 text-rose-400" />
                  ) : (
                    <Mic className="h-3 w-3 text-emerald-400" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setPinnedSocketId(peer.socketId)}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Pin video to large view"
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Floating Glassmorphism Controls Toolbar */}
      <div className="p-3 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-center gap-2 sm:gap-3 flex-wrap shrink-0 z-30">
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={toggleMic}
          className={`p-3 sm:p-3.5 rounded-2xl transition-all shadow-md ${
            isMicMuted
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
          }`}
          title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={toggleCamera}
          className={`p-3 sm:p-3.5 rounded-2xl transition-all shadow-md ${
            isVideoMuted || !hasCamera
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
          }`}
          title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {isVideoMuted || !hasCamera ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </button>

        {/* Flip Camera (Mobile) */}
        {hasCamera && (
          <button
            type="button"
            onClick={flipCamera}
            className="p-3 sm:p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-all shadow-md"
            title={`Flip Camera (${facingMode === 'user' ? 'Front' : 'Back'})`}
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        )}

        {/* Screen Share */}
        <button
          type="button"
          onClick={toggleScreenShare}
          className={`p-3 sm:p-3.5 rounded-2xl transition-all shadow-md ${
            isScreenSharing
              ? 'bg-indigo-600 text-white shadow-indigo-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
          }`}
          title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
        >
          <MonitorUp className="h-5 w-5" />
        </button>

        {/* View Participants Drawer */}
        <button
          type="button"
          onClick={() => setShowParticipantsDrawer(!showParticipantsDrawer)}
          className={`p-3 sm:p-3.5 rounded-2xl transition-all shadow-md flex items-center gap-1.5 ${
            showParticipantsDrawer
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
          }`}
          title="Meeting Participants"
        >
          <Users className="h-5 w-5" />
          <span className="text-xs font-bold">{totalCount}</span>
        </button>

        {/* End / Leave Meeting */}
        <button
          type="button"
          onClick={() => {
            cleanupAll();
            onLeaveMeeting();
          }}
          className="px-5 py-3 sm:py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center gap-2 hover:scale-102 active:scale-98"
          title="Leave meeting"
        >
          <PhoneOff className="h-4 w-4" />
          <span>Leave Call</span>
        </button>
      </div>

      {/* Participants Drawer (Slideout side panel) */}
      {showParticipantsDrawer && (
        <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
          <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-400" />
              <span>Participants ({totalCount})</span>
            </span>
            <button
              onClick={() => setShowParticipantsDrawer(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
            {/* Self */}
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                  alt={user.name}
                  className="h-8 w-8 rounded-lg object-cover border border-slate-700"
                />
                <div className="min-w-0">
                  <span className="font-bold text-slate-200 block truncate">{user.name} (You)</span>
                  <span className="text-[10px] text-indigo-400 font-semibold">
                    {ROLE_CONFIGS[userRole || 'MEMBER']?.label || 'Host'}
                  </span>
                </div>
              </div>
              <div>
                {isMicMuted ? (
                  <MicOff className="h-4 w-4 text-rose-400" />
                ) : (
                  <Mic className="h-4 w-4 text-emerald-400" />
                )}
              </div>
            </div>

            {/* Other peers */}
            {peersArray.map((peer) => (
              <div
                key={peer.socketId}
                className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between hover:bg-slate-800/70"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={peer.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                    alt={peer.user.name}
                    className="h-8 w-8 rounded-lg object-cover border border-slate-700"
                  />
                  <div className="min-w-0">
                    <span className="font-bold text-slate-200 block truncate">{peer.user.name}</span>
                    <span className="text-[10px] text-slate-400 block">
                      {ROLE_CONFIGS[peer.user.role || 'MEMBER']?.label || 'Participant'}
                    </span>
                  </div>
                </div>
                <div>
                  {peer.isMicMuted ? (
                    <MicOff className="h-4 w-4 text-rose-400" />
                  ) : (
                    <Mic className="h-4 w-4 text-emerald-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

// Subcomponent for Remote Peer Video Tile
function PeerVideoTile({ peer, screenFitMode }: { peer: ParticipantItem; screenFitMode: 'cover' | 'contain' }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      videoRef.current.play().catch(() => {});
    }
  }, [peer.stream]);

  if (peer.isVideoMuted || !peer.stream) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-slate-900/90">
        <img
          src={peer.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
          alt={peer.user.name}
          className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-slate-700 object-cover shadow-lg"
        />
        <span className="mt-2 text-xs font-bold text-slate-200">{peer.user.name}</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className={`w-full h-full ${
        screenFitMode === 'contain' ? 'object-contain' : 'object-cover'
      } bg-slate-950`}
    />
  );
}
