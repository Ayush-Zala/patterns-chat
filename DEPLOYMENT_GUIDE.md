# TeamFlow Production Hosting Guide (Render + Vercel)

This guide walks you through deploying **TeamFlow** to production in ~10 minutes using:
- **Render / Railway**: Hosts the PostgreSQL database, NestJS REST API, and Socket.IO WebSockets / WebRTC signaling.
- **Vercel**: Hosts the Next.js Frontend with high-speed global edge CDN.

---

## Architecture Overview

```
                      ┌───────────────────────────────────────┐
                      │            Vercel (Frontend)          │
                      │         https://teamflow.vercel.app   │
                      └──────────────────┬────────────────────┘
                                         │
                   HTTPS API & WSS WebSockets / WebRTC Signaling
                                         │
                      ┌──────────────────▼────────────────────┐
                      │       Render / Railway (Backend)      │
                      │  https://teamflow-backend.onrender.com│
                      └──────────────────┬────────────────────┘
                                         │
                                         ▼
                      ┌───────────────────────────────────────┐
                      │          Managed PostgreSQL           │
                      └───────────────────────────────────────┘
```

---

## Step 1: Push Code to GitHub

If you haven't initialized Git or pushed your project to GitHub yet, run the following in your project root terminal:

```bash
git init
git add .
git commit -m "feat: complete TeamFlow Slack app with WebRTC calling and file sharing"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

---

## Step 2: Deploy Database & Backend on Render

### Option A: 1-Click Render Blueprint (Recommended)
Because this repository includes a [`render.yaml`](file:///c:/patterns-slack/render.yaml), Render can automatically configure the database and backend together:

1. Sign in to [Render.com](https://render.com).
2. Click **New +** in the top navigation and select **Blueprint**.
3. Connect your GitHub repository.
4. Render will read `render.yaml` and show:
   - **Database**: `teamflow-db` (PostgreSQL)
   - **Web Service**: `teamflow-backend` (Node / NestJS)
5. Click **Apply**.
6. Once deployed, copy your backend URL (e.g. `https://teamflow-backend.onrender.com`).

---

### Option B: Manual Setup on Render
If you prefer creating them manually:

#### 1. Create PostgreSQL Database:
1. Click **New +** $\rightarrow$ **PostgreSQL Database**.
2. Name: `teamflow-db`
3. Database: `teamflow`
4. Plan: **Free**
5. Click **Create Database** and copy the **Internal Database URL** (or External Database URL).

#### 2. Create Web Service for Backend:
1. Click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `teamflow-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run db:push && npm run start:prod`
4. Add **Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `DATABASE_URL`: *(Paste your PostgreSQL Connection String)*
   - `JWT_SECRET`: *(Any random 32+ character string, e.g. `secret_teamflow_production_jwt_token_key_123`)*
   - `JWT_EXPIRES_IN`: `7d`
   - `FRONTEND_URL`: `*` *(or your Vercel URL once created)*
5. Click **Create Web Service**.
6. Note down your backend URL (e.g. `https://teamflow-backend.onrender.com`).

---

## Step 3: Deploy Frontend on Vercel

1. Go to [Vercel.com](https://vercel.com) and log in.
2. Click **Add New...** $\rightarrow$ **Project**.
3. Import your GitHub repository.
4. In the Project Configuration:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit** and choose `frontend`.
5. Expand **Environment Variables** and add:

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://teamflow-backend.onrender.com/api` | Your Render Backend URL + `/api` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://teamflow-backend.onrender.com` | Your Render Backend URL (without `/api`) |

6. Click **Deploy**.
7. Vercel will build and launch your application at a domain like:
   `https://your-teamflow.vercel.app`

---

## Step 4: Verification

1. Open your live Vercel URL in your browser.
2. Register a new user or log in.
3. Create a workspace or join one.
4. Test real-time messaging, file uploads, reactions, and WebRTC audio/video calls between teammates!
