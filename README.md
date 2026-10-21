# TeamFlow — Slack-Type Web Application

A modern, white-label Slack-type team communication web application engineered with a clean, decoupled architecture.

---

## 📁 Project Architecture & Structure

```text
patterns-slack/
├── frontend/                 # Next.js 16 (App Router), React 19, Tailwind CSS, Socket.IO Client
│   ├── public/               # Static assets & icons
│   ├── src/
│   │   ├── app/              # App Router pages & layouts
│   │   │   ├── login/        # Slack-style sign-in page (with 1-click demo)
│   │   │   ├── register/     # Account registration page
│   │   │   ├── workspaces/   # Workspace selector, creator, & join modal
│   │   │   ├── workspace/[id]# Slack application shell (sidebar, thread drawer, live chat)
│   │   │   ├── layout.tsx    # Root layout with AuthProvider & fonts
│   │   │   └── page.tsx      # Landing page with live status & feature pillars
│   │   ├── components/       # UI components (Navbar, Hero, Features, Footer)
│   │   ├── hooks/            # Custom hooks (useHealth)
│   │   ├── lib/              # Auth context, socket.io client singleton, & utilities
│   │   └── types/            # TypeScript interfaces (User, Workspace, Channel, Message, Thread, Reaction)
│   ├── .env.example          # Safe frontend environment template
│   ├── .env.local            # Local environment configuration
│   └── package.json
│
├── backend/                  # NestJS 12 REST API, WebSockets (Socket.IO), Prisma ORM
│   ├── prisma/
│   │   └── schema.prisma     # Models: User, Workspace, Member, Channel, Message, Reaction
│   ├── src/
│   │   ├── auth/             # JWT Strategy, AuthService, AuthController, Guards
│   │   ├── workspaces/       # Workspace creation, joining, & member management
│   │   ├── channels/         # Channel CRUD (public/private channels, auto-seeding)
│   │   ├── messages/         # Real-time Socket.IO gateway, threads & reactions
│   │   │   ├── dto/          # CreateMessageDto
│   │   │   ├── messages.gateway.ts    # Socket.IO room handling, threads & reactions
│   │   │   ├── messages.service.ts    # Database persistence, thread loading, reaction toggles
│   │   │   └── messages.controller.ts # REST endpoints for messages, threads, & reactions
│   │   ├── common/           # PrismaService and shared utilities
│   │   ├── config/           # Environment configuration loader
│   │   ├── app.controller.ts # Health check: GET /api/health
│   │   ├── app.module.ts     # Root module with Auth, Workspaces, Channels, Messages
│   │   └── main.ts           # Bootstrap, CORS, validation, /api prefix
│   ├── .env.example          # Safe backend environment template
│   ├── .env                  # Local backend configuration (DB, JWT, Port)
│   └── package.json
│
├── .gitignore                # Global git ignore rules
└── README.md                 # Complete project documentation
```

---

## 🛠️ Implemented Modules

### ✅ Module 1: Project Setup & Baseline
- Clean decoupled folders (`frontend/` and `backend/`).
- PostgreSQL database (`teamflow_dev`) and Prisma configuration.
- Global NestJS setup: `/api` prefix, CORS for `http://localhost:3000`, `ValidationPipe`.
- Health check: `GET /api/health`.

### ✅ Module 2: Authentication & Multi-Tenant Workspaces
- User Authentication with JWT and password hashing (`bcryptjs`).
- Multi-tenant `Workspace` model with unique slugs and 8-character invite codes (`TF-XXXXXX`).
- `WorkspaceMember` model with role-based access (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`).
- Slack layout with leftmost workspace switcher rail and invite code copying.

### ✅ Module 3: Dynamic Channels & Real-Time Messaging (Socket.IO)
- Channels CRUD with public/private support and auto-seeding (`#general`, `#random`).
- Real-time Socket.IO WebSocket gateway with dynamic channel rooms.
- Instant sub-millisecond message broadcasting.
- Consecutive message grouping and live typing indicators.

### ✅ Module 4: Threaded Conversations (Replies) & Real-Time Reactions
- **Thread Side-Panel Drawer:**
  - Click **"Reply in thread"** or any thread preview pill to open the contextual thread panel on the right.
  - Displays the parent message at top, reply count divider, full replies timeline, and dedicated thread composer.
  - Thread replies update in real-time across both windows with zero page reloads!
  - Main channel feed parent message displays Slack's iconic thread preview pill: `💬 X replies  View thread` with participant avatar bubbles.
- **Interactive Emoji Reactions:**
  - Real-time emoji reaction pills under messages (`👍`, `❤️`, `🎉`, `🚀`, `🔥`, `👀`).
  - Click any emoji to toggle your reaction.
  - Hover over reaction pills to see tooltips of who reacted.
  - Broadcasts instantaneously over WebSockets (`reaction_updated`) to all channel members.

---

## 🚀 How to Run the Project

Open **two separate PowerShell terminals** in VS Code:

### Terminal 1: Backend (NestJS API & Socket.IO Gateway)
```powershell
cd backend
npm run start:dev
```
* **API Root:** [http://localhost:3001/api](http://localhost:3001/api)
* **Health Check:** [http://localhost:3001/api/health](http://localhost:3001/api/health)

### Terminal 2: Frontend (Next.js App)
```powershell
cd frontend
npm run dev
```
* **Landing Page:** [http://localhost:3000](http://localhost:3000)
* **Sign In:** [http://localhost:3000/login](http://localhost:3000/login)
* **Workspaces:** [http://localhost:3000/workspaces](http://localhost:3000/workspaces)

---

## ⚡ How to Test Threaded Conversations & Reactions

1. Open your browser to your active workspace:
   **[http://localhost:3000/workspace/9e96f43a-1681-4714-bf64-3330b43f9ddd](http://localhost:3000/workspace/9e96f43a-1681-4714-bf64-3330b43f9ddd)**
2. Hover over any message in the channel:
   - Notice the **floating Slack action bar** appearing on the right.
   - Click `👍` or `❤️` — watch the reaction badge appear beneath the message!
   - Click the **Reply** icon (`💬`) — watch the **Thread Side-Panel Drawer** slide in from the right!
3. Type a reply in the thread drawer and press **Enter**:
   - The reply appears instantly in the thread.
   - Look at the parent message in the main feed: it now displays the Slack thread pill:
     **`💬 1 reply  View thread`** with the participant's avatar!
