import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService, EmailProvider, EmailFolder } from '../common/prisma.service.js';
import { MessagesGateway } from '../messages/messages.gateway.js';

// Mail Service: Shared Group and Personal Inbox Management
@Injectable()
export class MailService {
  private accountReauthNeeded = new Map<string, boolean>();

  // Injected Prisma Service and Messages Gateway
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MessagesGateway))
    private readonly messagesGateway?: MessagesGateway,
  ) {}

  // Helper: validate whether current user has access to account (Direct Owner, Workspace Admin, or Channel Member)
  async validateAccountAccess(
    userId: string,
    accountId: string,
  ): Promise<{ account: any; isAdmin: boolean }> {
    const account = await this.prisma.emailAccount.findUnique({
      where: { id: accountId },
      include: {
        channel: {
          include: {
            workspace: { include: { members: true } },
            members: true,
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!account) {
      throw new NotFoundException('Mailbox not found');
    }

    // Direct creator/owner has full access
    if (account.userId === userId) {
      return { account, isAdmin: true };
    }

    // If shared group mailbox:
    if (account.isShared) {
      // 1. Workspace Admin / Owner has full master access to all group inboxes
      if (account.channel?.workspace) {
        const wsMember = account.channel.workspace.members?.find((m: any) => m.userId === userId);
        const isAdmin =
          wsMember &&
          (wsMember.role === 'ADMIN' ||
            wsMember.role === 'OWNER' ||
            account.channel.workspace.ownerId === userId);
        if (isAdmin) {
          return { account, isAdmin: true };
        }
      }

      // 2. Channel member has access to their group inbox
      if (account.channel?.members) {
        const isChannelMember = account.channel.members.some((m: any) => m.userId === userId);
        if (isChannelMember) {
          return { account, isAdmin: false };
        }
      }
    }

    throw new ForbiddenException('You do not have permission to access this group mailbox');
  }

  // List connected email accounts for user (personal + permitted group inboxes, with Admin Master view)
  async getAccounts(userId: string, workspaceId?: string) {
    let isAdmin = false;

    if (workspaceId) {
      const wsMember = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        include: { workspace: true },
      });
      if (
        wsMember &&
        (wsMember.role === 'ADMIN' ||
          wsMember.role === 'OWNER' ||
          wsMember.workspace.ownerId === userId)
      ) {
        isAdmin = true;
      }
    }

    let accounts: any[] = [];

    if (isAdmin && workspaceId) {
      // 👑 Workspace Admin / Owner sees:
      // 1. Their personal inboxes
      // 2. ALL shared group inboxes across the entire workspace (all 5 project groups!)
      accounts = await this.prisma.emailAccount.findMany({
        where: {
          OR: [
            { userId, isShared: false },
            { workspaceId, isShared: true },
          ],
        },
        include: {
          channel: { select: { id: true, name: true, isPrivate: true, createdById: true } },
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: [{ isShared: 'asc' }, { createdAt: 'desc' }],
      });
    } else if (workspaceId) {
      // 👥 Regular Group Member sees:
      // 1. Their personal inboxes
      // 2. Only shared group inboxes for channels they belong to
      const userChannelMemberships = await this.prisma.channelMember.findMany({
        where: { userId, channel: { workspaceId } },
        select: { channelId: true },
      });
      const channelIds = userChannelMemberships.map((cm) => cm.channelId);

      accounts = await this.prisma.emailAccount.findMany({
        where: {
          OR: [
            { userId, isShared: false },
            {
              workspaceId,
              isShared: true,
              OR: [
                { channelId: { in: channelIds } },
                { userId }, // accounts they created
              ],
            },
          ],
        },
        include: {
          channel: { select: { id: true, name: true, isPrivate: true, createdById: true } },
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: [{ isShared: 'asc' }, { createdAt: 'desc' }],
      });
    } else {
      // General fallback if no workspaceId provided
      accounts = await this.prisma.emailAccount.findMany({
        where: { userId },
        include: {
          channel: { select: { id: true, name: true, isPrivate: true, createdById: true } },
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (accounts.length === 0) return [];

    const accountIds = accounts.map((a) => a.id);

    // Group counts by accountId, folder, isRead, isStarred, isHandled
    const messageCounts = await this.prisma.emailMessage.groupBy({
      by: ['accountId', 'folder', 'isRead', 'isStarred', 'isHandled'],
      where: { accountId: { in: accountIds } },
      _count: { _all: true },
    });

    return accounts.map((acc) => {
      let inboxUnread = 0;
      let inboxTotal = 0;
      let starred = 0;
      let sent = 0;
      let drafts = 0;
      let trash = 0;
      let unhandledCount = 0;
      let handledCount = 0;

      for (const row of messageCounts) {
        if (row.accountId === acc.id) {
          const count = row._count._all;
          if (row.isStarred) starred += count;
          if (row.folder === 'INBOX') {
            inboxTotal += count;
            if (!row.isRead) inboxUnread += count;
            if (!row.isHandled) unhandledCount += count;
            if (row.isHandled) handledCount += count;
          } else if (row.folder === 'SENT') {
            sent += count;
          } else if (row.folder === 'DRAFTS') {
            drafts += count;
          } else if (row.folder === 'TRASH') {
            trash += count;
          }
        }
      }

      const isChannelShared = acc.isShared && acc.channel;
      const displayTitle = acc.displayName
        ? acc.displayName
        : isChannelShared
        ? `#${acc.channel.name} Group Inbox`
        : acc.emailAddress.split('@')[0];

      const isChannelAdmin =
        isAdmin ||
        acc.userId === userId ||
        (acc.channel && acc.channel.createdById === userId);

      return {
        id: acc.id,
        emailAddress: acc.emailAddress,
        displayName: displayTitle,
        provider: acc.provider,
        avatarUrl: acc.avatarUrl,
        isActive: acc.isActive,
        isShared: acc.isShared,
        channelId: acc.channelId,
        channelName: acc.channel?.name || null,
        channelCreatedById: acc.channel?.createdById || null,
        isChannelAdmin,
        workspaceId: acc.workspaceId,
        isAdminMaster: isAdmin && acc.isShared && acc.userId !== userId,
        ownerId: acc.userId,
        ownerName: acc.user?.name || 'Team Member',
        isOwner: acc.userId === userId,
        requiresReauth: !acc.refreshToken || !!this.accountReauthNeeded.get(acc.id),
        unreadCount: inboxUnread,
        unhandledCount,
        handledCount,
        inboxUnreadCount: inboxUnread,
        inboxTotalCount: inboxTotal,
        starredCount: starred,
        sentCount: sent,
        draftsCount: drafts,
        trashCount: trash,
        lastSyncedAt: acc.lastSyncedAt,
        createdAt: acc.createdAt,
      };
    });
  }

  // Generate Google OAuth 2.0 Consent URL for Connecting Mailbox (NO User Signup)
  async getGoogleAuthUrl(userId: string, redirectUri?: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID || 'dummy_google_client_id.apps.googleusercontent.com';
    const redirect = redirectUri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?provider=google`;
    const scopes = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid',
    ].join(' ');

    const state = 'connect_mail';

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent(
      scopes,
    )}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

    return { authUrl, url: authUrl, clientIdConfigured: !!process.env.GOOGLE_CLIENT_ID };
  }

  async handleGoogleCallback(
    userId: string,
    code: string,
    redirectUri?: string,
    emailAddressInput?: string,
    workspaceId?: string,
    channelId?: string,
    isShared?: boolean,
  ) {
    let emailAddress = emailAddressInput;
    let accessToken = 'oauth_access_token_demo';
    let refreshToken = 'oauth_refresh_token_demo';

    const redirect = redirectUri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?provider=google`;

    // If real Google OAuth credentials configured, exchange authorization code
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirect,
            grant_type: 'authorization_code',
          }),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
          accessToken = tokenData.access_token;
          refreshToken = tokenData.refresh_token || refreshToken;

          // Fetch profile email
          const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const userData = await userRes.json();
          if (userData.email) {
            emailAddress = userData.email;
          }
        } else {
          console.error('Google token exchange error in mail service:', tokenData);
        }
      } catch (err) {
        console.warn('Google OAuth token exchange fallback:', err);
      }
    }

    if (!emailAddress) {
      emailAddress = emailAddressInput || 'user@patterns.com';
    }

    // ONLY upsert EmailAccount linked to the active logged-in user - NO User signup/creation
    const account = await this.upsertAccountAndSeed(userId, {
      emailAddress,
      provider: EmailProvider.GOOGLE,
      displayName: emailAddress.split('@')[0],
      accessToken,
      refreshToken,
      workspaceId,
      channelId,
      isShared,
    });

    // Immediately sync real emails from user's live Gmail account
    try {
      await this.syncGmailAccount(account);
    } catch (syncErr) {
      console.warn('Initial Gmail sync failed:', syncErr);
    }

    return { success: true, emailAccount: account };
  }

  // Generate Microsoft 365 OAuth Consent URL for Connecting Mailbox (NO User Signup)
  async getMicrosoftAuthUrl(userId: string, redirectUri?: string) {
    const clientId = process.env.MICROSOFT_CLIENT_ID || 'dummy_ms_client_id';
    const redirect = redirectUri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?provider=microsoft`;
    const scopes = ['Mail.Read', 'Mail.Send', 'User.Read', 'offline_access'].join(' ');
    const state = 'connect_mail';

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(
      clientId,
    )}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(
      scopes,
    )}&state=${encodeURIComponent(state)}`;

    return { authUrl, url: authUrl, clientIdConfigured: !!process.env.MICROSOFT_CLIENT_ID };
  }

  // Handle Microsoft OAuth Callback & Link Mail Account to Current User
  async handleMicrosoftCallback(
    userId: string,
    code: string,
    redirectUri?: string,
    emailAddressInput?: string,
    workspaceId?: string,
    channelId?: string,
    isShared?: boolean,
  ) {
    let emailAddress = emailAddressInput;
    let accessToken = 'ms_graph_token';
    let refreshToken = 'ms_refresh_token';

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirect = redirectUri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?provider=microsoft`;

    if (clientId && clientSecret) {
      try {
        const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirect,
            grant_type: 'authorization_code',
          }),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
          accessToken = tokenData.access_token;
          refreshToken = tokenData.refresh_token || refreshToken;

          const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const profile = await profileRes.json();
          emailAddress = (profile.mail || profile.userPrincipalName || emailAddress).toLowerCase().trim();
        }
      } catch (err) {
        console.warn('Microsoft OAuth token exchange fallback:', err);
      }
    }

    if (!emailAddress) {
      emailAddress = emailAddressInput || 'team@outlook.com';
    }

    const account = await this.upsertAccountAndSeed(userId, {
      emailAddress,
      provider: EmailProvider.MICROSOFT,
      displayName: emailAddress.split('@')[0],
      accessToken,
      refreshToken,
      workspaceId,
      channelId,
      isShared,
    });

    // Immediately sync real emails from user's live Microsoft 365 / Outlook account
    try {
      await this.syncMicrosoftAccount(account);
    } catch (syncErr) {
      console.warn('Initial Microsoft sync failed:', syncErr);
    }

    return { success: true, emailAccount: account };
  }

  // Connect Custom / Company Email (Google Workspace, M365, or Corporate Domain)
  async connectAccount(
    userId: string,
    data: {
      emailAddress: string;
      provider?: EmailProvider;
      displayName?: string;
      channelId?: string;
      workspaceId?: string;
      isShared?: boolean;
    },
  ) {
    if (!data.emailAddress || !data.emailAddress.includes('@')) {
      throw new BadRequestException('A valid email address is required.');
    }

    let workspaceId = data.workspaceId;
    let channelId = data.channelId;
    let isShared = !!data.isShared || !!channelId;

    if (channelId) {
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
        select: { id: true, workspaceId: true, name: true },
      });
      if (channel) {
        workspaceId = channel.workspaceId;
        if (!data.displayName) {
          data.displayName = `#${channel.name} Group Inbox`;
        }
      }
    }

    return this.upsertAccountAndSeed(userId, {
      emailAddress: data.emailAddress.trim().toLowerCase(),
      provider: data.provider || EmailProvider.CUSTOM,
      displayName: data.displayName || data.emailAddress.split('@')[0],
      accessToken: 'custom_token',
      workspaceId,
      channelId,
      isShared,
    });
  }

  // Helper to upsert account & seed initial emails
  private async upsertAccountAndSeed(
    userId: string,
    accountData: {
      emailAddress: string;
      provider: EmailProvider;
      displayName: string;
      accessToken?: string;
      refreshToken?: string;
      workspaceId?: string;
      channelId?: string;
      isShared?: boolean;
    },
  ) {
    let account = await this.prisma.emailAccount.findUnique({
      where: {
        userId_emailAddress: {
          userId,
          emailAddress: accountData.emailAddress,
        },
      },
    });

    if (!account) {
      account = await this.prisma.emailAccount.create({
        data: {
          userId,
          emailAddress: accountData.emailAddress,
          provider: accountData.provider,
          displayName: accountData.displayName,
          accessToken: accountData.accessToken,
          refreshToken: accountData.refreshToken,
          workspaceId: accountData.workspaceId,
          channelId: accountData.channelId,
          isShared: accountData.isShared || false,
          lastSyncedAt: new Date(),
        },
      });

      // Seed realistic corporate welcome emails for immediate testing
      await this.seedInitialEmailsForAccount(account.id, account.emailAddress);
    } else {
      account = await this.prisma.emailAccount.update({
        where: { id: account.id },
        data: {
          accessToken: accountData.accessToken || account.accessToken,
          refreshToken: accountData.refreshToken || account.refreshToken,
          workspaceId: accountData.workspaceId || account.workspaceId,
          channelId: accountData.channelId !== undefined ? accountData.channelId : account.channelId,
          isShared: accountData.isShared !== undefined ? accountData.isShared : account.isShared,
          displayName: accountData.displayName || account.displayName,
          lastSyncedAt: new Date(),
          isActive: true,
        },
      });
    }

    // Broadcast account connected if shared with channel/workspace
    if (account.isShared && this.messagesGateway?.server) {
      if (account.channelId) {
        this.messagesGateway.server.to(`channel:${account.channelId}`).emit('group_inbox_updated', {
          accountId: account.id,
          channelId: account.channelId,
        });
      }
      if (account.workspaceId) {
        this.messagesGateway.server.to(`workspace:${account.workspaceId}`).emit('group_inbox_updated', {
          accountId: account.id,
          workspaceId: account.workspaceId,
        });
      }
    }

    return account;
  }

  private async seedInitialEmailsForAccount(accountId: string, userEmail: string) {
    const sampleEmails = [
      {
        externalMessageId: `msg_${Math.random().toString(36).substring(2, 9)}`,
        folder: EmailFolder.INBOX,
        fromName: 'Google Cloud Platform',
        fromAddress: 'cloud-noreply@google.com',
        toAddresses: [userEmail],
        subject: 'Welcome to Google Cloud & Patterns Communication OAuth Service',
        snippet: 'Your OAuth integration has been verified. You can now synchronize messages securely across Patterns...',
        bodyHtml: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b;">
            <h2 style="color: #4f46e5; margin-bottom: 8px;">Google Cloud OAuth Authorization Verified</h2>
            <p>Hello,</p>
            <p>Your email account <strong>${userEmail}</strong> was successfully connected to <strong>Patterns Communication</strong> via Google OAuth 2.0.</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0; font-weight: 600; color: #0f172a;">OAuth Permissions Granted:</p>
              <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #475569;">
                <li>Read incoming inbox messages and threads</li>
                <li>Send outbound emails via Gmail API</li>
                <li>Secure token refresh delegation</li>
              </ul>
            </div>
            <p>You can manage your connected apps anytime from your Google Account Security Dashboard.</p>
            <p style="color: #64748b; font-size: 13px;">Best regards,<br/>The Google Cloud Platform Team</p>
          </div>
        `,
        isRead: false,
        isStarred: true,
        hasAttachments: false,
        receivedAt: new Date(),
      },
      {
        externalMessageId: `msg_${Math.random().toString(36).substring(2, 9)}`,
        folder: EmailFolder.INBOX,
        fromName: 'Sarah Jenkins',
        fromAddress: 'sarah.jenkins@patterns.com',
        toAddresses: [userEmail],
        ccAddresses: ['dev-team@patterns.com'],
        subject: 'Q4 Product Roadmap & Sprint Deliverables Review',
        snippet: 'Hi team, please find attached the reviewed sprint goals and client deliverables for next week...',
        bodyHtml: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b;">
            <p>Hi Team,</p>
            <p>Great progress on the sprint deliverables this week! Below are the key milestones scheduled for our upcoming deployment:</p>
            <ol style="margin: 12px 0; padding-left: 20px;">
              <li><strong>WebRTC Calling:</strong> 1-on-1 voice & video with screen share & speaker selector</li>
              <li><strong>Group Meetings:</strong> Multi-user video grid with Google Meet style room codes</li>
              <li><strong>OAuth Mail Inbox:</strong> Integrated company email sync right inside Patterns</li>
            </ol>
            <p>Let's review these during our daily sync today. Feel free to share this thread in the <code>#general</code> channel!</p>
            <p>Cheers,<br/><strong>Sarah Jenkins</strong><br/>Head of Product, Patterns</p>
          </div>
        `,
        isRead: true,
        isStarred: false,
        hasAttachments: true,
        attachmentsJson: [
          {
            fileName: 'Patterns_Roadmap_Q4.pdf',
            fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            fileSize: 420000,
            contentType: 'application/pdf',
          },
        ],
        receivedAt: new Date(Date.now() - 3600000 * 3),
      },
      {
        externalMessageId: `msg_${Math.random().toString(36).substring(2, 9)}`,
        folder: EmailFolder.INBOX,
        fromName: 'David Chen',
        fromAddress: 'david.chen@acme-corp.com',
        toAddresses: [userEmail],
        subject: 'Contract Signed & Kickoff Scheduling',
        snippet: 'Hey! We just completed signing the enterprise agreement. When can we schedule the technical kickoff?',
        bodyHtml: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b;">
            <p>Hi,</p>
            <p>We are thrilled to officially partner with Patterns Communication! The contract has been countersigned by our legal department.</p>
            <p>Can we jump on a video meeting tomorrow afternoon around 3:00 PM EST? You can send over a meeting link or invite.</p>
            <p>Looking forward to working together!</p>
            <p>Best regards,<br/><strong>David Chen</strong><br/>VP of Engineering, Acme Corp</p>
          </div>
        `,
        isRead: false,
        isStarred: true,
        hasAttachments: false,
        receivedAt: new Date(Date.now() - 3600000 * 8),
      },
      {
        externalMessageId: `msg_${Math.random().toString(36).substring(2, 9)}`,
        folder: EmailFolder.SENT,
        fromName: 'Me',
        fromAddress: userEmail,
        toAddresses: ['david.chen@acme-corp.com'],
        subject: 'Re: Enterprise Agreement & Welcome to Patterns',
        snippet: 'Thanks David, we are excited to have you on board! I have attached our architecture overview...',
        bodyHtml: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b;">
            <p>Hi David,</p>
            <p>Thank you for the quick turnaround on the contract! Looking forward to tomorrow's kickoff call.</p>
            <p>Talk soon!</p>
          </div>
        `,
        isRead: true,
        isStarred: false,
        hasAttachments: false,
        receivedAt: new Date(Date.now() - 3600000 * 24),
      },
    ];

    for (const email of sampleEmails) {
      await this.prisma.emailMessage.create({
        data: {
          accountId,
          ...email,
        },
      });
    }
  }

  // Disconnect an account
  async disconnectAccount(userId: string, accountId: string) {
    const account = await this.prisma.emailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new NotFoundException('Email account not found');

    await this.prisma.emailAccount.delete({
      where: { id: accountId },
    });

    return { success: true, message: 'Email account disconnected successfully' };
  }

  // Fetch messages with filters, folders, search, pagination, and Handled/Done status
  async getMessages(
    userId: string,
    query: {
      accountId?: string;
      workspaceId?: string;
      folder?: string;
      status?: 'all' | 'unhandled' | 'done';
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    let accountIds: string[] = [];

    if (query.accountId) {
      await this.validateAccountAccess(userId, query.accountId);
      accountIds = [query.accountId];
    } else {
      const accessibleAccounts = await this.getAccounts(userId, query.workspaceId);
      accountIds = accessibleAccounts.map((a) => a.id);
    }

    if (accountIds.length === 0) {
      return { messages: [], total: 0, page: 1, totalPages: 0 };
    }

    const folder = (query.folder?.toUpperCase() as EmailFolder) || EmailFolder.INBOX;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      accountId: { in: accountIds },
    };

    if (folder === EmailFolder.STARRED) {
      where.isStarred = true;
    } else {
      where.folder = folder;
    }

    // Status filter: unhandled vs done
    if (query.status === 'unhandled') {
      where.isHandled = false;
    } else if (query.status === 'done') {
      where.isHandled = true;
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { snippet: { contains: q, mode: 'insensitive' } },
        { fromName: { contains: q, mode: 'insensitive' } },
        { fromAddress: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, messages] = await Promise.all([
      this.prisma.emailMessage.count({ where }),
      this.prisma.emailMessage.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          accountId: true,
          externalMessageId: true,
          folder: true,
          fromName: true,
          fromAddress: true,
          toAddresses: true,
          ccAddresses: true,
          subject: true,
          snippet: true,
          isRead: true,
          isStarred: true,
          isHandled: true,
          handledById: true,
          handledByName: true,
          handledAt: true,
          sentById: true,
          sentByName: true,
          hasAttachments: true,
          attachmentsJson: true,
          receivedAt: true,
          createdAt: true,
        },
      }),
    ]);

    const formattedMessages = messages.map((m: any) => ({
      ...m,
      attachments: (m.attachmentsJson as any[]) || [],
    }));

    return {
      messages: formattedMessages,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    };
  }

  // Get single full email message with body
  async getMessageById(userId: string, messageId: string) {
    const message = await this.prisma.emailMessage.findUnique({
      where: { id: messageId },
      include: {
        account: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
            userId: true,
            provider: true,
            isShared: true,
            channelId: true,
            workspaceId: true,
          },
        },
        handledBy: { select: { id: true, name: true, avatarUrl: true } },
        sentBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!message) {
      throw new NotFoundException('Email message not found');
    }

    await this.validateAccountAccess(userId, message.accountId);

    // Auto mark as read on view
    if (!message.isRead) {
      await this.prisma.emailMessage.update({
        where: { id: messageId },
        data: { isRead: true },
      });
      message.isRead = true;

      // Broadcast read update to all team members across devices
      if (this.messagesGateway?.server) {
        const readPayload = {
          messageId,
          accountId: message.accountId,
          isRead: true,
          readBy: { id: userId },
        };
        if (message.account.channelId) {
          this.messagesGateway.server.to(`channel:${message.account.channelId}`).emit('email_read_updated', readPayload);
        }
        if (message.account.workspaceId) {
          this.messagesGateway.server.to(`workspace:${message.account.workspaceId}`).emit('email_read_updated', readPayload);
        }
        this.messagesGateway.server.to(`user:${message.account.userId}`).emit('email_read_updated', readPayload);
      }

      if (message.account?.provider === EmailProvider.GOOGLE && message.externalMessageId) {
        this.syncLabelToGmail(message.account, message.externalMessageId, [], ['UNREAD']).catch(() => {});
      }
    }

    return {
      ...message,
      attachments: (message.attachmentsJson as any[]) || [],
    };
  }

  // Toggle read/unread status with group sync
  async toggleRead(userId: string, messageId: string, isRead?: boolean) {
    const message = await this.prisma.emailMessage.findUnique({
      where: { id: messageId },
      include: { account: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const { account } = await this.validateAccountAccess(userId, message.accountId);

    const newRead = isRead !== undefined ? isRead : !message.isRead;
    const updated = await this.prisma.emailMessage.update({
      where: { id: messageId },
      data: { isRead: newRead },
    });

    // Broadcast real-time read update to all group members across devices
    if (this.messagesGateway?.server) {
      const readPayload = {
        messageId,
        accountId: account.id,
        isRead: newRead,
        readBy: { id: userId },
      };
      if (account.channelId) {
        this.messagesGateway.server.to(`channel:${account.channelId}`).emit('email_read_updated', readPayload);
      }
      if (account.workspaceId) {
        this.messagesGateway.server.to(`workspace:${account.workspaceId}`).emit('email_read_updated', readPayload);
      }
      this.messagesGateway.server.to(`user:${account.userId}`).emit('email_read_updated', readPayload);
    }

    if (message.account?.provider === EmailProvider.GOOGLE && message.externalMessageId) {
      this.syncLabelToGmail(
        message.account,
        message.externalMessageId,
        newRead ? [] : ['UNREAD'],
        newRead ? ['UNREAD'] : [],
      ).catch(() => {});
    }
    return updated;
  }

  // Toggle Handled / Done status with instant cross-device team sync
  async toggleHandled(userId: string, messageId: string, isHandled?: boolean) {
    const message = await this.prisma.emailMessage.findUnique({
      where: { id: messageId },
      include: { account: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const { account } = await this.validateAccountAccess(userId, message.accountId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true },
    });

    const targetHandled = isHandled !== undefined ? isHandled : !message.isHandled;

    const updated = await this.prisma.emailMessage.update({
      where: { id: messageId },
      data: {
        isHandled: targetHandled,
        handledById: targetHandled ? userId : null,
        handledByName: targetHandled ? (user?.name || 'Team Member') : null,
        handledAt: targetHandled ? new Date() : null,
        ...(targetHandled ? { isRead: true } : {}),
      },
    });

    // Broadcast to all team members across all devices via Socket.IO
    if (this.messagesGateway?.server) {
      const payload = {
        messageId,
        accountId: account.id,
        isHandled: targetHandled,
        isRead: updated.isRead,
        handledBy: targetHandled ? { id: userId, name: user?.name, avatarUrl: user?.avatarUrl } : null,
        handledAt: updated.handledAt,
      };

      if (account.channelId) {
        this.messagesGateway.server.to(`channel:${account.channelId}`).emit('email_handled_updated', payload);
      }
      if (account.workspaceId) {
        this.messagesGateway.server.to(`workspace:${account.workspaceId}`).emit('email_handled_updated', payload);
      }
      this.messagesGateway.server.to(`user:${account.userId}`).emit('email_handled_updated', payload);
      this.messagesGateway.server.to(`user:${userId}`).emit('email_handled_updated', payload);
    }

    return updated;
  }

  // Toggle star
  async toggleStar(userId: string, messageId: string) {
    const message = await this.prisma.emailMessage.findUnique({
      where: { id: messageId },
      include: { account: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.validateAccountAccess(userId, message.accountId);

    const newStarred = !message.isStarred;
    const updated = await this.prisma.emailMessage.update({
      where: { id: messageId },
      data: { isStarred: newStarred },
    });
    if (message.account?.provider === EmailProvider.GOOGLE && message.externalMessageId) {
      this.syncLabelToGmail(
        message.account,
        message.externalMessageId,
        newStarred ? ['STARRED'] : [],
        newStarred ? [] : ['STARRED'],
      ).catch(() => {});
    }
    return updated;
  }

  // Send new email (or reply on behalf of group mailbox) with full attachment support
  async sendMessage(
    userId: string,
    data: {
      accountId: string;
      to: string[];
      cc?: string[];
      subject: string;
      bodyHtml: string;
      bodyText?: string;
      replyToMessageId?: string;
      attachments?: Array<{
        fileName: string;
        contentType: string;
        base64Data: string;
        fileSize?: number;
      }>;
    },
  ) {
    const { account } = await this.validateAccountAccess(userId, data.accountId);
    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    const cleanTo = data.to.filter((t) => t && t.includes('@'));
    if (cleanTo.length === 0) {
      throw new BadRequestException('At least one valid recipient is required');
    }

    let externalMessageId = `sent_${Math.random().toString(36).substring(2, 9)}`;

    let sentViaGmail = false;
    let gmailError: string | null = null;

    // If connected to Google with OAuth token, dispatch live email via Gmail API
    if (account.provider === EmailProvider.GOOGLE) {
      try {
        const validToken = await this.getValidGoogleAccessToken(account);
        if (validToken) {
          let rawEmail = '';
          const hasAtts = data.attachments && data.attachments.length > 0;

          if (hasAtts) {
            const boundary = `====boundary_${Date.now().toString(16)}====`;
            const lines: string[] = [
              `From: ${account.emailAddress}`,
              `To: ${cleanTo.join(', ')}`,
              data.cc?.length ? `Cc: ${data.cc.join(', ')}` : '',
              `Subject: =?utf-8?B?${Buffer.from(data.subject || '(no subject)').toString('base64')}?=`,
              'MIME-Version: 1.0',
              `Content-Type: multipart/mixed; boundary="${boundary}"`,
              '',
              `--${boundary}`,
              'Content-Type: text/html; charset=utf-8',
              'Content-Transfer-Encoding: 7bit',
              '',
              data.bodyHtml || data.bodyText || '',
            ];

            for (const att of data.attachments || []) {
              const cleanB64 = (att.base64Data || '')
                .replace(/^data:[^;]+;base64,/, '')
                .replace(/\s/g, '');
              lines.push(
                `--${boundary}`,
                `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.fileName}"`,
                `Content-Disposition: attachment; filename="${att.fileName}"`,
                'Content-Transfer-Encoding: base64',
                '',
                cleanB64,
              );
            }
            lines.push(`--${boundary}--`);
            rawEmail = lines.filter((l) => l !== '').join('\r\n');
          } else {
            rawEmail = [
              `From: ${account.emailAddress}`,
              `To: ${cleanTo.join(', ')}`,
              data.cc?.length ? `Cc: ${data.cc.join(', ')}` : '',
              `Subject: =?utf-8?B?${Buffer.from(data.subject || '(no subject)').toString('base64')}?=`,
              'MIME-Version: 1.0',
              'Content-Type: text/html; charset=utf-8',
              '',
              data.bodyHtml || data.bodyText || '',
            ]
              .filter((l) => l !== '')
              .join('\r\n');
          }

          const encodedRaw = Buffer.from(rawEmail)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

          const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${validToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw: encodedRaw }),
          });

          if (sendRes.ok) {
            const sendData = await sendRes.json();
            if (sendData.id) {
              externalMessageId = sendData.id;
              sentViaGmail = true;
            }
          } else {
            const errBody = await sendRes.text();
            console.warn('Gmail API send failed:', sendRes.status, errBody);
            gmailError = sendRes.status === 403 || sendRes.status === 401 ? 'REQUIRES_REAUTH' : 'SEND_FAILED';
          }
        } else {
          gmailError = 'NO_TOKEN';
        }
      } catch (err: any) {
        console.warn('Gmail API send fallback to local:', err);
        gmailError = err?.message || 'SEND_ERROR';
      }
    }

    let sentViaMicrosoft = false;
    let msError: string | null = null;

    // If connected to Microsoft with OAuth token, dispatch live email via Microsoft Graph API
    if (account.provider === EmailProvider.MICROSOFT) {
      try {
        const validToken = await this.getValidMicrosoftAccessToken(account);
        if (validToken) {
          const sendRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${validToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                subject: data.subject || '(no subject)',
                body: {
                  contentType: 'HTML',
                  content: data.bodyHtml || data.bodyText || '',
                },
                toRecipients: cleanTo.map((addr: string) => ({ emailAddress: { address: addr } })),
                ccRecipients: (data.cc || []).map((addr: string) => ({ emailAddress: { address: addr } })),
              },
              saveToSentItems: 'true',
            }),
          });

          if (sendRes.ok) {
            sentViaMicrosoft = true;
          } else {
            const errBody = await sendRes.text();
            console.warn('Microsoft Graph API send failed:', sendRes.status, errBody);
            msError = sendRes.status === 403 || sendRes.status === 401 ? 'REQUIRES_REAUTH' : 'SEND_FAILED';
          }
        } else {
          msError = 'NO_TOKEN';
        }
      } catch (err: any) {
        console.warn('Microsoft Graph API send error:', err);
        msError = err?.message || 'SEND_ERROR';
      }
    }

    // Save sent message in SENT folder with sender attribution (On Behalf Of)
    const sentMessage = await this.prisma.emailMessage.create({
      data: {
        accountId: account.id,
        externalMessageId,
        folder: EmailFolder.SENT,
        fromName: account.displayName || account.emailAddress.split('@')[0],
        fromAddress: account.emailAddress,
        toAddresses: cleanTo,
        ccAddresses: data.cc || [],
        subject: data.subject || '(no subject)',
        snippet: (data.bodyText || data.bodyHtml || '').replace(/<[^>]*>?/gm, '').slice(0, 120),
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText || data.bodyHtml.replace(/<[^>]*>?/gm, ''),
        isRead: true,
        isStarred: false,
        isHandled: true,
        sentById: userId,
        sentByName: sender?.name || 'Team Member',
        hasAttachments: Boolean(data.attachments && data.attachments.length > 0),
        attachmentsJson: data.attachments || null,
        receivedAt: new Date(),
      },
    });

    // If this was a reply to an incoming email, auto-mark it as HANDLED/DONE by this sender!
    if (data.replyToMessageId) {
      await this.prisma.emailMessage.update({
        where: { id: data.replyToMessageId },
        data: {
          isHandled: true,
          handledById: userId,
          handledByName: sender?.name || 'Team Member',
          handledAt: new Date(),
          isRead: true,
        },
      });

      if (this.messagesGateway?.server) {
        const payload = {
          messageId: data.replyToMessageId,
          accountId: account.id,
          isHandled: true,
          isRead: true,
          handledBy: { id: userId, name: sender?.name },
          handledAt: new Date(),
        };
        if (account.channelId) {
          this.messagesGateway.server.to(`channel:${account.channelId}`).emit('email_handled_updated', payload);
        }
        if (account.workspaceId) {
          this.messagesGateway.server.to(`workspace:${account.workspaceId}`).emit('email_handled_updated', payload);
        }
      }
    }

    // Broadcast new sent message to all group members across all devices
    if (this.messagesGateway?.server) {
      const sentPayload = {
        accountId: account.id,
        sentMessage,
      };
      if (account.channelId) {
        this.messagesGateway.server.to(`channel:${account.channelId}`).emit('email_sent_updated', sentPayload);
      }
      if (account.workspaceId) {
        this.messagesGateway.server.to(`workspace:${account.workspaceId}`).emit('email_sent_updated', sentPayload);
      }
    }

    // Instant Delivery to Recipient Inboxes:
    // If any recipient address belongs to a connected mailbox in Patterns, deliver directly into their INBOX!
    try {
      const recipientEmails = Array.from(
        new Set(
          [...cleanTo, ...(data.cc || [])]
            .map((e) => e.toLowerCase().trim())
            .filter(Boolean),
        ),
      );

      const recipientAccounts = await this.prisma.emailAccount.findMany({
        where: {
          emailAddress: { in: recipientEmails },
        },
      });

      for (const recAcc of recipientAccounts) {
        if (
          recAcc.id === account.id &&
          !cleanTo.map((e) => e.toLowerCase().trim()).includes(account.emailAddress.toLowerCase().trim())
        ) {
          continue;
        }

        const newRecvMsg = await this.prisma.emailMessage.create({
          data: {
            accountId: recAcc.id,
            externalMessageId: `recv_${Math.random().toString(36).substring(2, 9)}`,
            folder: EmailFolder.INBOX,
            fromName: account.displayName || account.emailAddress.split('@')[0],
            fromAddress: account.emailAddress,
            toAddresses: cleanTo,
            ccAddresses: data.cc || [],
            subject: data.subject || '(no subject)',
            snippet: (data.bodyText || data.bodyHtml || '').replace(/<[^>]*>?/gm, '').slice(0, 120),
            bodyHtml: data.bodyHtml,
            bodyText: data.bodyText || data.bodyHtml.replace(/<[^>]*>?/gm, ''),
            isRead: false,
            isStarred: false,
            hasAttachments: Boolean(data.attachments && data.attachments.length > 0),
            attachmentsJson: data.attachments || null,
            receivedAt: new Date(),
          },
        });

        // Broadcast real-time notifications to all group members across all their devices
        if (this.messagesGateway?.server) {
          const recAccWithChannel = await this.prisma.emailAccount.findUnique({
            where: { id: recAcc.id },
            include: { channel: { select: { id: true, name: true } } },
          });
          const newEmailPayload = {
            messageId: newRecvMsg.id,
            accountId: recAcc.id,
            channelId: recAccWithChannel?.channelId,
            channelName: recAccWithChannel?.channel?.name,
            subject: data.subject || '(no subject)',
            fromName: account.displayName || account.emailAddress.split('@')[0],
            fromAddress: account.emailAddress,
          };
          if (recAccWithChannel?.channelId) {
            this.messagesGateway.server.to(`channel:${recAccWithChannel.channelId}`).emit('new_group_email', newEmailPayload);
          }
          if (recAccWithChannel?.workspaceId) {
            this.messagesGateway.server.to(`workspace:${recAccWithChannel.workspaceId}`).emit('new_group_email', newEmailPayload);
          }
          this.messagesGateway.server.to(`user:${recAcc.userId}`).emit('new_group_email', newEmailPayload);
        }
      }
    } catch (deliverErr) {
      console.warn('Internal inbox delivery warning:', deliverErr);
    }

    return {
      ...sentMessage,
      sentViaGmail,
      gmailError,
    };
  }

  // Delete message (moves to TRASH)
  async deleteMessage(userId: string, messageId: string) {
    const message = await this.prisma.emailMessage.findUnique({
      where: { id: messageId },
      include: { account: true },
    });

    if (!message || message.account.userId !== userId) {
      throw new NotFoundException('Message not found');
    }

    if (message.folder === EmailFolder.TRASH) {
      await this.prisma.emailMessage.delete({ where: { id: messageId } });
      return { success: true, permanentlyDeleted: true };
    } else {
      await this.prisma.emailMessage.update({
        where: { id: messageId },
        data: { folder: EmailFolder.TRASH },
      });
      if (message.account?.provider === EmailProvider.GOOGLE && message.externalMessageId) {
        this.trashGmailMessage(message.account, message.externalMessageId).catch(() => {});
      }
      return { success: true, movedToTrash: true };
    }
  }

  // Forward / Share Email into a Channel or DM
  async shareToChannel(
    userId: string,
    messageId: string,
    channelId: string,
    userComment?: string,
  ) {
    const email = await this.getMessageById(userId, messageId);

    // Format rich markdown card for chat channel
    const text = [
      userComment ? `💬 **${userComment}**\n\n` : '',
      `📬 **Email Shared:** *${email.subject}*\n`,
      `**From:** ${email.fromName || email.fromAddress} <${email.fromAddress}>\n`,
      `**Date:** ${new Date(email.receivedAt).toLocaleString()}\n\n`,
      `> ${email.snippet || '(No snippet available)'}\n`,
    ].join('');

    const message = await this.prisma.message.create({
      data: {
        content: text,
        channelId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return message;
  }


  // Helper to sync label modifications (read/unread/star) to Gmail API
  private async syncLabelToGmail(account: any, externalMessageId: string, addLabels: string[], removeLabels: string[]) {
    try {
      const token = await this.getValidGoogleAccessToken(account);
      if (!token) return;
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${externalMessageId}/modify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addLabelIds: addLabels,
          removeLabelIds: removeLabels,
        }),
      });
    } catch (err) {
      // Modify will succeed when token has gmail.modify scope
    }
  }

  // Helper to move message to trash on Gmail API
  private async trashGmailMessage(account: any, externalMessageId: string) {
    try {
      const token = await this.getValidGoogleAccessToken(account);
      if (!token) return;
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${externalMessageId}/trash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {}
  }

  // Helper to ensure valid Google access token by refreshing if needed
  private async getValidGoogleAccessToken(account: { id: string; accessToken: string | null; refreshToken: string | null }): Promise<string | null> {
    if (!account.accessToken && !account.refreshToken) return null;
    let token = account.accessToken;

    if (token) {
      try {
        const testRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (testRes.ok) {
          return token;
        }
      } catch (e) {}
    }

    // Token expired or invalid, refresh using refreshToken if available
    if (account.refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      try {
        const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: account.refreshToken,
            grant_type: 'refresh_token',
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          token = refreshData.access_token;
          await this.prisma.emailAccount.update({
            where: { id: account.id },
            data: { accessToken: token },
          });
          return token;
        }
      } catch (err) {
        console.error('Failed to refresh Google access token:', err);
      }
    }

    return token;
  }

  // Extract HTML and Plain Text from nested Gmail payload parts
  private extractGmailBody(payload: any): { html?: string; text?: string } {
    let html: string | undefined;
    let text: string | undefined;

    const decodeBase64Url = (str: string): string => {
      try {
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(base64, 'base64').toString('utf-8');
      } catch {
        return '';
      }
    };

    const walk = (part: any) => {
      if (!part) return;
      if (part.mimeType === 'text/html' && part.body?.data && !html) {
        html = decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/plain' && part.body?.data && !text) {
        text = decodeBase64Url(part.body.data);
      }
      if (part.parts && Array.isArray(part.parts)) {
        for (const subPart of part.parts) {
          walk(subPart);
        }
      }
    };

    if (payload?.body?.data) {
      if (payload.mimeType === 'text/html') {
        html = decodeBase64Url(payload.body.data);
      } else {
        text = decodeBase64Url(payload.body.data);
      }
    }

    if (payload?.parts) {
      for (const part of payload.parts) {
        walk(part);
      }
    }

    return { html, text };
  }

  // Helper to recursively extract all attachments (documents, images, PDFs, etc.) from Gmail message payload
  private extractGmailAttachments(payload: any): Array<{
    attachmentId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    contentId?: string;
    isInline: boolean;
    base64Data?: string;
    fileUrl?: string;
  }> {
    const list: Array<any> = [];
    let counter = 1;

    const walk = (part: any) => {
      if (!part) return;

      const headers: Array<{ name: string; value: string }> = part.headers || [];
      const getHeader = (name: string): string => {
        const h = headers.find((item) => item.name.toLowerCase() === name.toLowerCase());
        return h ? h.value : '';
      };

      const disposition = getHeader('Content-Disposition') || '';
      const contentIdRaw = getHeader('Content-ID');
      const contentId = contentIdRaw ? contentIdRaw.replace(/[<>]/g, '').trim() : undefined;

      let filename = part.filename || '';
      if (!filename && disposition) {
        const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
        if (match) filename = match[1].trim();
      }

      const mimeType = part.mimeType || 'application/octet-stream';
      const hasAttachmentId = Boolean(part.body?.attachmentId);
      const isNamed = Boolean(filename && filename.trim().length > 0);
      const isAttachmentDisp = disposition.toLowerCase().includes('attachment');
      const isInlineDisp = disposition.toLowerCase().includes('inline') || Boolean(contentId);
      const isDocumentOrMedia =
        mimeType.startsWith('image/') ||
        mimeType.startsWith('video/') ||
        mimeType.startsWith('audio/') ||
        mimeType.includes('pdf') ||
        mimeType.includes('msword') ||
        mimeType.includes('spreadsheet') ||
        mimeType.includes('presentation') ||
        mimeType.includes('zip') ||
        mimeType.includes('tar') ||
        mimeType.includes('octet-stream');

      const isTextBody = (mimeType === 'text/html' || mimeType === 'text/plain') && !isNamed && !isAttachmentDisp;

      if ((hasAttachmentId || isNamed || isAttachmentDisp || (isInlineDisp && isDocumentOrMedia)) && !isTextBody) {
        const attachmentId = part.body?.attachmentId || (contentId ? `cid_${contentId}` : `inline_${counter++}`);
        const finalName = filename || (contentId ? `inline-${contentId}` : `attachment-${counter}`);
        const size = part.body?.size || 0;

        let base64Data: string | undefined;
        if (part.body?.data) {
          base64Data = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
        }

        list.push({
          attachmentId,
          fileName: finalName,
          contentType: mimeType,
          fileSize: size,
          contentId,
          isInline: isInlineDisp,
          base64Data,
        });
      }

      if (part.parts && Array.isArray(part.parts)) {
        for (const subPart of part.parts) {
          walk(subPart);
        }
      }
    };

    if (payload?.parts && Array.isArray(payload.parts)) {
      for (const p of payload.parts) {
        walk(p);
      }
    } else if (payload?.body?.attachmentId || (payload?.filename && payload.filename.length > 0)) {
      walk(payload);
    }

    return list;
  }

  // Fetch attachment binary stream / data for a message (supports Gmail OAuth, stored base64, and files)
  async getAttachment(userId: string, messageId: string, attachmentId: string) {
    const message = await this.prisma.emailMessage.findUnique({
      where: { id: messageId },
      include: { account: true },
    });
    if (!message) {
      throw new NotFoundException('Email message not found');
    }

    await this.validateAccountAccess(userId, message.accountId);

    const attachments = (message.attachmentsJson as any[]) || [];
    const meta = attachments.find(
      (a: any) =>
        a.attachmentId === attachmentId ||
        a.id === attachmentId ||
        a.fileName === attachmentId ||
        (a.contentId && a.contentId === attachmentId),
    );

    // 1. If live Gmail message and attachment is stored on Gmail server
    if (
      message.account.provider === EmailProvider.GOOGLE &&
      message.externalMessageId &&
      attachmentId &&
      !attachmentId.startsWith('inline_') &&
      !meta?.base64Data
    ) {
      const validToken = await this.getValidGoogleAccessToken(message.account);
      if (!validToken) {
        throw new BadRequestException('Google authentication expired, please reconnect your Gmail account');
      }

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.externalMessageId}/attachments/${attachmentId}`,
        {
          headers: { Authorization: `Bearer ${validToken}` },
        },
      );

      if (res.ok) {
        const data = await res.json();
        const base64Str = (data.data || '').replace(/-/g, '+').replace(/_/g, '/');
        const buffer = Buffer.from(base64Str, 'base64');
        return {
          buffer,
          contentType: meta?.contentType || 'application/octet-stream',
          fileName: meta?.fileName || 'attachment',
          size: data.size || buffer.length,
        };
      }
    }

    // 2. If attachment has stored base64Data
    if (meta?.base64Data) {
      const cleanBase64 = meta.base64Data.replace(/^data:[^;]+;base64,/, '').replace(/-/g, '+').replace(/_/g, '/');
      const buffer = Buffer.from(cleanBase64, 'base64');
      return {
        buffer,
        contentType: meta.contentType || 'application/octet-stream',
        fileName: meta.fileName || 'attachment',
        size: buffer.length,
      };
    }

    // 3. If external fileUrl (sample or static assets)
    if (meta?.fileUrl && meta.fileUrl.startsWith('http')) {
      try {
        const res = await fetch(meta.fileUrl);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const buffer = Buffer.from(ab);
          return {
            buffer,
            contentType: meta.contentType || 'application/octet-stream',
            fileName: meta.fileName || 'attachment',
            size: buffer.length,
          };
        }
      } catch (err) {
        console.warn('Failed to fetch remote attachment URL:', err);
      }
    }

    throw new NotFoundException('Attachment content could not be located');
  }

  // Live Sync emails from Gmail API into local database
  async syncGmailAccount(account: any): Promise<{ syncedCount: number; requiresReauth?: boolean; error?: string }> {
    const accessToken = await this.getValidGoogleAccessToken(account);
    if (!accessToken) {
      console.warn(`No valid access token available for ${account.emailAddress}`);
      return { syncedCount: 0, requiresReauth: true, error: 'NO_TOKEN' };
    }

    try {
      // Fetch latest 100 message IDs from Gmail so all emails are visible
      const listRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!listRes.ok) {
        const errText = await listRes.text();
        console.error(`Gmail API list messages failed (${listRes.status}):`, errText);
        const requiresReauth = listRes.status === 403 || listRes.status === 401;
        if (requiresReauth) {
          this.accountReauthNeeded.set(account.id, true);
        }
        return { syncedCount: 0, requiresReauth, error: errText };
      }

      this.accountReauthNeeded.delete(account.id);

      const listData = await listRes.json();
      const messageRefs: Array<{ id: string; threadId: string }> = listData.messages || [];

      if (messageRefs.length === 0) {
        return { syncedCount: 0 };
      }

      let syncedCount = 0;

      // Fetch message details in concurrent batches
      const batchSize = 6;
      for (let i = 0; i < messageRefs.length; i += batchSize) {
        const batch = messageRefs.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (msgRef) => {
            try {
              const msgRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}?format=full`,
                {
                  headers: { Authorization: `Bearer ${accessToken}` },
                },
              );
              if (!msgRes.ok) return;

              const msgData = await msgRes.json();
              const headers: Array<{ name: string; value: string }> = msgData.payload?.headers || [];

              const getHeader = (name: string): string => {
                const h = headers.find((item) => item.name.toLowerCase() === name.toLowerCase());
                return h ? h.value : '';
              };

              const subject = getHeader('Subject') || '(No Subject)';
              const fromHeader = getHeader('From') || account.emailAddress;
              const toHeader = getHeader('To') || account.emailAddress;
              const ccHeader = getHeader('Cc');
              const dateHeader = getHeader('Date');

              let fromName = '';
              let fromAddress = fromHeader;
              const fromMatch = fromHeader.match(/^(.*?)\s*<([^>]+)>/);
              if (fromMatch) {
                fromName = fromMatch[1].replace(/["']/g, '').trim();
                fromAddress = fromMatch[2].trim();
              } else {
                fromName = fromHeader.split('@')[0];
              }

              const toAddresses = toHeader
                .split(',')
                .map((t: string) => {
                  const m = t.match(/<([^>]+)>/);
                  return m ? m[1].trim() : t.trim();
                })
                .filter(Boolean);

              const ccAddresses = ccHeader
                ? ccHeader
                    .split(',')
                    .map((t: string) => {
                      const m = t.match(/<([^>]+)>/);
                      return m ? m[1].trim() : t.trim();
                    })
                    .filter(Boolean)
                : [];

              const receivedAt = msgData.internalDate
                ? new Date(parseInt(msgData.internalDate, 10))
                : dateHeader
                ? new Date(dateHeader)
                : new Date();

              const labels: string[] = msgData.labelIds || [];
              let folder: EmailFolder = EmailFolder.INBOX;
              if (labels.includes('SENT')) folder = EmailFolder.SENT;
              else if (labels.includes('DRAFT')) folder = EmailFolder.DRAFTS;
              else if (labels.includes('TRASH')) folder = EmailFolder.TRASH;
              else if (labels.includes('INBOX')) folder = EmailFolder.INBOX;

              const isStarred = labels.includes('STARRED');
              const isRead = !labels.includes('UNREAD');

              const { html, text } = this.extractGmailBody(msgData.payload);
              const snippet = msgData.snippet || text?.slice(0, 160) || '';

              // Extract all files, documents, and media attachments
              const rawAttachments = this.extractGmailAttachments(msgData.payload);
              const hasAttachments = rawAttachments.length > 0;

              const existing = await this.prisma.emailMessage.findFirst({
                where: {
                  accountId: account.id,
                  externalMessageId: msgData.id,
                },
              });

              if (existing) {
                // Preserve local read & starred status so background sync never reverts read emails!
                const finalIsRead = existing.isRead ? true : isRead;
                const finalIsStarred = existing.isStarred ? true : isStarred;

                const formattedAttachments = rawAttachments.map((att) => ({
                  ...att,
                  fileUrl: `/api/mail/messages/${existing.id}/attachments/${att.attachmentId}?filename=${encodeURIComponent(att.fileName)}`,
                }));

                let updatedHtml = html || existing.bodyHtml || (text ? `<pre style="white-space: pre-wrap; font-family: inherit;">${text}</pre>` : '');
                if (updatedHtml && rawAttachments.length > 0) {
                  for (const att of rawAttachments) {
                    if (att.contentId) {
                      const inlineUrl = `/api/mail/messages/${existing.id}/attachments/${att.attachmentId}?filename=${encodeURIComponent(att.fileName)}`;
                      updatedHtml = updatedHtml.replace(new RegExp(`cid:${att.contentId}`, 'gi'), inlineUrl);
                    }
                  }
                }

                await this.prisma.emailMessage.update({
                  where: { id: existing.id },
                  data: {
                    folder,
                    subject,
                    fromName,
                    fromAddress,
                    toAddresses,
                    ccAddresses,
                    snippet,
                    bodyHtml: updatedHtml,
                    bodyText: text || existing.bodyText || snippet,
                    isRead: finalIsRead,
                    isStarred: finalIsStarred,
                    hasAttachments,
                    attachmentsJson: formattedAttachments,
                    receivedAt,
                  },
                });
              } else {
                const created = await this.prisma.emailMessage.create({
                  data: {
                    accountId: account.id,
                    externalMessageId: msgData.id,
                    threadId: msgData.threadId,
                    folder,
                    subject,
                    fromName,
                    fromAddress,
                    toAddresses,
                    ccAddresses,
                    snippet,
                    bodyHtml: html || (text ? `<pre style="white-space: pre-wrap; font-family: inherit;">${text}</pre>` : ''),
                    bodyText: text || snippet,
                    isRead,
                    isStarred,
                    hasAttachments,
                    attachmentsJson: rawAttachments,
                    receivedAt,
                  },
                });

                if (hasAttachments) {
                  let updatedHtml = created.bodyHtml;
                  const formattedAttachments = rawAttachments.map((att) => {
                    const realUrl = `/api/mail/messages/${created.id}/attachments/${att.attachmentId}?filename=${encodeURIComponent(att.fileName)}`;
                    if (att.contentId && updatedHtml) {
                      updatedHtml = updatedHtml.replace(new RegExp(`cid:${att.contentId}`, 'gi'), realUrl);
                    }
                    return {
                      ...att,
                      fileUrl: realUrl,
                    };
                  });

                  await this.prisma.emailMessage.update({
                    where: { id: created.id },
                    data: {
                      attachmentsJson: formattedAttachments,
                      bodyHtml: updatedHtml,
                    },
                  });
                }
              }

              syncedCount++;
            } catch (err) {
              console.warn(`Error processing Gmail message ${msgRef.id}:`, err);
            }
          }),
        );
      }

      // If real live emails were successfully downloaded, clear out placeholder mock emails
      if (syncedCount > 0) {
        await this.prisma.emailMessage.deleteMany({
          where: {
            accountId: account.id,
            externalMessageId: { startsWith: 'msg_' },
          },
        });
      }

      await this.prisma.emailAccount.update({
        where: { id: account.id },
        data: { lastSyncedAt: new Date() },
      });

      return { syncedCount };
    } catch (e) {
      console.error(`Gmail live sync error for ${account.emailAddress}:`, e);
      return { syncedCount: 0 };
    }
  }

  // Helper to get or refresh valid Microsoft Graph access token
  async getValidMicrosoftAccessToken(account: any): Promise<string | null> {
    let token = account.accessToken;
    if (account.refreshToken && process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
      try {
        const refreshRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET,
            refresh_token: account.refreshToken,
            grant_type: 'refresh_token',
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          token = refreshData.access_token;
          await this.prisma.emailAccount.update({
            where: { id: account.id },
            data: { accessToken: token, refreshToken: refreshData.refresh_token || account.refreshToken },
          });
          return token;
        }
      } catch (err) {
        console.error('Failed to refresh Microsoft access token:', err);
      }
    }
    return token;
  }

  // Live Sync emails from Microsoft Graph API
  async syncMicrosoftAccount(account: any): Promise<{ syncedCount: number; requiresReauth?: boolean; error?: string }> {
    const accessToken = await this.getValidMicrosoftAccessToken(account);
    if (!accessToken) {
      return { syncedCount: 0, requiresReauth: true, error: 'NO_TOKEN' };
    }

    try {
      const listRes = await fetch(
        'https://graph.microsoft.com/v1.0/me/messages?$top=30&$orderby=receivedDateTime desc',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!listRes.ok) {
        const errText = await listRes.text();
        console.error(`Microsoft Graph API list failed (${listRes.status}):`, errText);
        return { syncedCount: 0, requiresReauth: listRes.status === 401 || listRes.status === 403, error: errText };
      }

      const listData = await listRes.json();
      const messages: any[] = listData.value || [];
      let syncedCount = 0;

      for (const msg of messages) {
        const existing = await this.prisma.emailMessage.findFirst({
          where: { accountId: account.id, externalMessageId: msg.id },
        });

        const fromAddress = msg.from?.emailAddress?.address || account.emailAddress;
        const fromName = msg.from?.emailAddress?.name || fromAddress.split('@')[0];
        const toAddresses = (msg.toRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean);
        const ccAddresses = (msg.ccRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean);
        const receivedAt = msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date();

        let folder: EmailFolder = EmailFolder.INBOX;
        if (msg.parentFolderId?.toLowerCase().includes('sent') || msg.isDraft) {
          folder = msg.isDraft ? EmailFolder.DRAFTS : EmailFolder.SENT;
        }

        const subject = msg.subject || '(no subject)';
        const snippet = msg.bodyPreview || '';
        const bodyHtml = msg.body?.content || snippet;
        const bodyText = snippet;

        if (existing) {
          await this.prisma.emailMessage.update({
            where: { id: existing.id },
            data: {
              subject,
              fromName,
              fromAddress,
              toAddresses,
              ccAddresses,
              snippet,
              bodyHtml,
              bodyText,
              isRead: !!msg.isRead,
              isStarred: !!msg.importance && msg.importance === 'high',
              receivedAt,
            },
          });
        } else {
          await this.prisma.emailMessage.create({
            data: {
              accountId: account.id,
              externalMessageId: msg.id,
              folder,
              subject,
              fromName,
              fromAddress,
              toAddresses,
              ccAddresses,
              snippet,
              bodyHtml,
              bodyText,
              isRead: !!msg.isRead,
              isStarred: !!msg.importance && msg.importance === 'high',
              receivedAt,
            },
          });
        }
        syncedCount++;
      }

      if (syncedCount > 0) {
        await this.prisma.emailMessage.deleteMany({
          where: {
            accountId: account.id,
            externalMessageId: { startsWith: 'msg_' },
          },
        });
      }

      await this.prisma.emailAccount.update({
        where: { id: account.id },
        data: { lastSyncedAt: new Date() },
      });

      return { syncedCount };
    } catch (e: any) {
      console.error('Microsoft sync error:', e);
      return { syncedCount: 0, error: e.message };
    }
  }

  // Sync / refresh emails for an account (supported for account owners and permitted group members)
  async syncAccount(userId: string, accountId: string) {
    const { account } = await this.validateAccountAccess(userId, accountId);

    if (account.provider === EmailProvider.GOOGLE && account.accessToken) {
      const syncResult = await this.syncGmailAccount(account);
      const updated = await this.prisma.emailAccount.findUnique({
        where: { id: accountId },
      });
      return {
        success: true,
        lastSyncedAt: updated?.lastSyncedAt,
        syncedCount: syncResult.syncedCount,
        requiresReauth: syncResult.requiresReauth,
        error: syncResult.error,
      };
    }

    if (account.provider === EmailProvider.MICROSOFT && account.accessToken) {
      const syncResult = await this.syncMicrosoftAccount(account);
      const updated = await this.prisma.emailAccount.findUnique({
        where: { id: accountId },
      });
      return {
        success: true,
        lastSyncedAt: updated?.lastSyncedAt,
        syncedCount: syncResult.syncedCount,
        requiresReauth: syncResult.requiresReauth,
        error: syncResult.error,
      };
    }

    const updated = await this.prisma.emailAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });

    return { success: true, lastSyncedAt: updated.lastSyncedAt, syncedCount: 0 };
  }

  // Connect via Google Identity Services / One Tap credential
  async handleGoogleOneTap(userId: string, credentialJwt: string) {
    try {
      const parts = credentialJwt.split('.');
      if (parts.length !== 3) {
        throw new BadRequestException('Invalid Google credential format');
      }
      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);

      const email = payload.email?.toLowerCase().trim();
      if (!email) {
        throw new BadRequestException('No email found in Google credential');
      }

      const displayName = payload.name || payload.given_name || email.split('@')[0];

      return this.upsertAccountAndSeed(userId, {
        emailAddress: email,
        provider: EmailProvider.GOOGLE,
        displayName,
        accessToken: credentialJwt,
      });
    } catch (e) {
      console.error('Google One Tap connect error:', e);
      throw new BadRequestException(e instanceof Error ? e.message : 'Failed to verify Google One Tap credential');
    }
  }
}

