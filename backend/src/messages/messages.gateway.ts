import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from './messages.service.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  // Active multi-participant team meeting rooms: meetingId -> Map<socketId, Participant>
  private activeMeetingRooms = new Map<
    string,
    Map<string, { socketId: string; user: { id: string; name: string; avatarUrl?: string } }>
  >();
  private socketToMeetingMap = new Map<string, string>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Client disconnected: ${client.id}`);
    const meetingId = this.socketToMeetingMap.get(client.id);
    if (meetingId) {
      this.leaveMeetingInternal(client, meetingId);
    }
  }

  emitForceLogout(userId: string, newSessionId: string) {
    if (this.server) {
      const room = `user:${userId}`;
      this.server.to(room).emit('force_logout', {
        reason: 'Account was logged into from another device.',
        newSessionId,
      });
      this.logger.log(`🚪 Emitted force_logout to room ${room} for new session ${newSessionId}`);
    }
  }

  @SubscribeMessage('join_channel')
  handleJoinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    if (data?.channelId) {
      const room = `channel:${data.channelId}`;
      client.join(room);
      this.logger.log(`👤 Socket ${client.id} joined room ${room}`);
      return { event: 'joined_channel', channelId: data.channelId };
    }
  }

  @SubscribeMessage('leave_channel')
  handleLeaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    if (data?.channelId) {
      const room = `channel:${data.channelId}`;
      client.leave(room);
      this.logger.log(`👤 Socket ${client.id} left room ${room}`);
      return { event: 'left_channel', channelId: data.channelId };
    }
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      const room = `conversation:${data.conversationId}`;
      client.join(room);
      this.logger.log(`💬 Socket ${client.id} joined conversation room ${room}`);
      return { event: 'joined_conversation', conversationId: data.conversationId };
    }
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      const room = `conversation:${data.conversationId}`;
      client.leave(room);
      this.logger.log(`💬 Socket ${client.id} left conversation room ${room}`);
      return { event: 'left_conversation', conversationId: data.conversationId };
    }
  }

  @SubscribeMessage('join_workspace')
  handleJoinWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string },
  ) {
    if (data?.workspaceId) {
      const room = `workspace:${data.workspaceId}`;
      client.join(room);
      this.logger.log(`🏢 Socket ${client.id} joined workspace room ${room}`);
      return { event: 'joined_workspace', workspaceId: data.workspaceId };
    }
  }

  @SubscribeMessage('leave_workspace')
  handleLeaveWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string },
  ) {
    if (data?.workspaceId) {
      const room = `workspace:${data.workspaceId}`;
      client.leave(room);
      this.logger.log(`🏢 Socket ${client.id} left workspace room ${room}`);
      return { event: 'left_workspace', workspaceId: data.workspaceId };
    }
  }

  @SubscribeMessage('join_user')
  handleJoinUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (data?.userId) {
      const room = `user:${data.userId}`;
      client.join(room);
      this.logger.log(`🔔 Socket ${client.id} joined user room ${room}`);
      return { event: 'joined_user', userId: data.userId };
    }
  }

  @SubscribeMessage('leave_user')
  handleLeaveUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (data?.userId) {
      const room = `user:${data.userId}`;
      client.leave(room);
      this.logger.log(`🔔 Socket ${client.id} left user room ${room}`);
      return { event: 'left_user', userId: data.userId };
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      channelId: string;
      content: string;
      token: string;
      parentId?: string;
    },
  ) {
    try {
      if (!data.token || !data.content || !data.channelId) {
        return { error: 'Missing required message parameters' };
      }

      // Verify JWT token to get sender identity
      const decoded: any = this.jwtService.verify(data.token);
      const userId = decoded.sub;

      const message = await this.messagesService.create(userId, data.channelId, {
        content: data.content,
        parentId: data.parentId,
      });

      const room = `channel:${data.channelId}`;

      if (data.parentId) {
        // Broadcast thread reply event
        this.server.to(room).emit('new_thread_reply', {
          parentId: data.parentId,
          reply: message,
        });
        this.logger.log(`🧵 Thread reply broadcast to room ${room} for parent ${data.parentId}`);
      } else {
        // Broadcast main channel message
        this.server.to(room).emit('new_message', message);
        if ((message as any).channel?.workspaceId) {
          this.server
            .to(`workspace:${(message as any).channel.workspaceId}`)
            .emit('workspace_channel_message', {
              channelId: data.channelId,
              message,
            });
        }
        this.logger.log(`💬 Message broadcast to room ${room} from user ${userId}`);
      }

      return { success: true, message };
    } catch (err) {
      this.logger.error('Failed to send message via websocket', err);
      return { error: 'Authentication or delivery failed' };
    }
  }

  @SubscribeMessage('toggle_reaction')
  async handleToggleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      messageId: string;
      emoji: string;
      token: string;
    },
  ) {
    try {
      if (!data.token || !data.messageId || !data.emoji) {
        return { error: 'Missing reaction parameters' };
      }

      const decoded: any = this.jwtService.verify(data.token);
      const userId = decoded.sub;

      const result = await this.messagesService.toggleReaction(userId, data.messageId, data.emoji);

      const room = `channel:${result.channelId}`;
      this.server.to(room).emit('reaction_updated', {
        messageId: result.messageId,
        reactions: result.reactions,
      });

      return { success: true, result };
    } catch (err) {
      this.logger.error('Failed to toggle reaction via websocket', err);
      return { error: 'Failed to update reaction' };
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      channelId: string;
      userName: string;
      isTyping: boolean;
    },
  ) {
    if (data?.channelId) {
      const room = `channel:${data.channelId}`;
      client.to(room).emit('user_typing', {
        channelId: data.channelId,
        userName: data.userName,
        isTyping: data.isTyping,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 1-on-1 Audio/Video Call Signaling (WebRTC)
  // ─────────────────────────────────────────────────────────────
  @SubscribeMessage('call_user')
  handleCallUser(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      toUserId: string;
      caller: { id: string; name: string; avatarUrl?: string };
      isVideo?: boolean;
      signalData?: any;
    },
  ) {
    if (data?.toUserId) {
      const room = `user:${data.toUserId}`;
      client.to(room).emit('incoming_call', {
        from: data.caller,
        isVideo: !!data.isVideo,
        signalData: data.signalData,
      });
      this.logger.log(`📞 Call initiated from ${data.caller?.name} to user ${data.toUserId}`);
    }
  }

  @SubscribeMessage('answer_call')
  handleAnswerCall(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      toUserId: string;
      signalData?: any;
    },
  ) {
    if (data?.toUserId) {
      const room = `user:${data.toUserId}`;
      client.to(room).emit('call_accepted', {
        signalData: data.signalData,
      });
      this.logger.log(`📞 Call accepted, response forwarded to user ${data.toUserId}`);
    }
  }

  @SubscribeMessage('ice_candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      toUserId: string;
      candidate: any;
    },
  ) {
    if (data?.toUserId) {
      const room = `user:${data.toUserId}`;
      client.to(room).emit('ice_candidate', {
        candidate: data.candidate,
      });
    }
  }

  @SubscribeMessage('end_call')
  handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      toUserId: string;
    },
  ) {
    if (data?.toUserId) {
      const room = `user:${data.toUserId}`;
      client.to(room).emit('call_ended');
      this.logger.log(`📞 Call ended for user ${data.toUserId}`);
    }
  }

  @SubscribeMessage('decline_call')
  handleDeclineCall(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      toUserId: string;
    },
  ) {
    if (data?.toUserId) {
      const room = `user:${data.toUserId}`;
      client.to(room).emit('call_declined');
      this.logger.log(`📞 Call declined for user ${data.toUserId}`);
    }
  }

  @SubscribeMessage('toggle_video')
  handleToggleVideo(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      toUserId: string;
      videoEnabled: boolean;
    },
  ) {
    if (data?.toUserId) {
      const room = `user:${data.toUserId}`;
      client.to(room).emit('peer_video_toggled', {
        videoEnabled: data.videoEnabled,
      });
      this.logger.log(`📹 Video toggled to ${data.videoEnabled} for user ${data.toUserId}`);
    }
  }

  @SubscribeMessage('renegotiate_call')
  handleRenegotiateCall(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      toUserId: string;
      signalData: any;
    },
  ) {
    if (data?.toUserId) {
      const room = `user:${data.toUserId}`;
      client.to(room).emit('call_renegotiate', {
        signalData: data.signalData,
      });
      this.logger.log(`🔄 Call renegotiation forwarded to user ${data.toUserId}`);
    }
  }

  @SubscribeMessage('renegotiate_answer')
  handleRenegotiateAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      toUserId: string;
      signalData: any;
    },
  ) {
    if (data?.toUserId) {
      const room = `user:${data.toUserId}`;
      client.to(room).emit('call_renegotiated', {
        signalData: data.signalData,
      });
      this.logger.log(`🔄 Call renegotiation answer forwarded to user ${data.toUserId}`);
    }
  }

  @SubscribeMessage('call_recording_state')
  handleCallRecordingState(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      toUserId: string;
      isRecording: boolean;
      recordedByName?: string;
    },
  ) {
    if (data?.toUserId) {
      const room = `user:${data.toUserId}`;
      client.to(room).emit('peer_recording_state', {
        isRecording: data.isRecording,
        recordedByName: data.recordedByName,
      });
      this.logger.log(`⏺️ Call recording state (${data.isRecording}) forwarded to user ${data.toUserId}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Multi-party Group Team Meeting Signaling (WebRTC Mesh 3-16+ users)
  // ─────────────────────────────────────────────────────────────
  @SubscribeMessage('join_team_meeting')
  handleJoinTeamMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      meetingId: string;
      channelId?: string;
      workspaceId?: string;
      user: { id: string; name: string; avatarUrl?: string };
    },
  ) {
    if (!data?.meetingId || !data?.user) return;

    const { meetingId, user, channelId, workspaceId } = data;
    const room = `meeting:${meetingId}`;
    client.join(room);

    if (!this.activeMeetingRooms.has(meetingId)) {
      this.activeMeetingRooms.set(meetingId, new Map());
    }

    const roomParticipants = this.activeMeetingRooms.get(meetingId)!;
    const existingList = Array.from(roomParticipants.values());

    roomParticipants.set(client.id, {
      socketId: client.id,
      user,
    });
    this.socketToMeetingMap.set(client.id, meetingId);

    // Send existing peers to joining client
    client.emit('meeting_existing_participants', {
      meetingId,
      participants: existingList,
    });

    // Notify other peers in room that a new peer joined
    client.to(room).emit('user_joined_team_meeting', {
      meetingId,
      socketId: client.id,
      user,
    });

    if (channelId) {
      this.server.to(`channel:${channelId}`).emit('channel_meeting_status', {
        meetingId,
        channelId,
        isActive: true,
        participantCount: roomParticipants.size,
      });
    }
    if (workspaceId) {
      this.server.to(`workspace:${workspaceId}`).emit('workspace_meeting_status', {
        meetingId,
        isActive: true,
        participantCount: roomParticipants.size,
      });
    }

    this.logger.log(`👥 User ${user.name} (${client.id}) joined meeting ${meetingId}. Total in room: ${roomParticipants.size}`);
  }

  @SubscribeMessage('meeting_peer_signal')
  handleMeetingPeerSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      toSocketId: string;
      meetingId: string;
      signal: any;
      fromUser?: { id: string; name: string; avatarUrl?: string };
    },
  ) {
    if (data?.toSocketId && data?.signal) {
      this.server.to(data.toSocketId).emit('meeting_peer_signal', {
        fromSocketId: client.id,
        meetingId: data.meetingId,
        signal: data.signal,
        fromUser: data.fromUser,
      });
    }
  }

  @SubscribeMessage('meeting_media_toggle')
  handleMeetingMediaToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      meetingId: string;
      isMicMuted?: boolean;
      isVideoMuted?: boolean;
      isScreenSharing?: boolean;
    },
  ) {
    if (data?.meetingId) {
      const room = `meeting:${data.meetingId}`;
      client.to(room).emit('peer_media_toggle', {
        socketId: client.id,
        ...data,
      });
    }
  }

  @SubscribeMessage('leave_team_meeting')
  handleLeaveTeamMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      meetingId: string;
      channelId?: string;
      workspaceId?: string;
    },
  ) {
    if (data?.meetingId) {
      this.leaveMeetingInternal(client, data.meetingId, data.channelId, data.workspaceId);
    }
  }

  private leaveMeetingInternal(client: Socket, meetingId: string, channelId?: string, workspaceId?: string) {
    const room = `meeting:${meetingId}`;
    client.leave(room);
    this.socketToMeetingMap.delete(client.id);

    const roomParticipants = this.activeMeetingRooms.get(meetingId);
    if (roomParticipants) {
      const leavingUser = roomParticipants.get(client.id);
      roomParticipants.delete(client.id);

      client.to(room).emit('user_left_team_meeting', {
        meetingId,
        socketId: client.id,
        userId: leavingUser?.user?.id,
      });

      const remaining = roomParticipants.size;
      this.logger.log(`🚪 User left group meeting ${meetingId}. Remaining: ${remaining}`);

      if (remaining === 0) {
        this.activeMeetingRooms.delete(meetingId);
      }

      if (channelId) {
        this.server.to(`channel:${channelId}`).emit('channel_meeting_status', {
          meetingId,
          channelId,
          isActive: remaining > 0,
          participantCount: remaining,
        });
      }
      if (workspaceId) {
        this.server.to(`workspace:${workspaceId}`).emit('workspace_meeting_status', {
          meetingId,
          isActive: remaining > 0,
          participantCount: remaining,
        });
      }
    }
  }
}

