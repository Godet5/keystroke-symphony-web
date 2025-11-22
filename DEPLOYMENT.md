# 🎵 Keystroke Symphony - Cloudflare Pages Deployment Guide

Complete guide to deploying Keystroke Symphony on Cloudflare Pages with secure Gemini API integration.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Local Development Setup](#local-development-setup)
4. [Production Deployment](#production-deployment)
5. [Environment Variables](#environment-variables)
6. [Security Considerations](#security-considerations)
7. [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

- **Node.js** 18+ installed
- **npm** or **yarn** package manager
- **Cloudflare account** (free tier works)
- **Gemini API key** from [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Git** for version control
- **Wrangler CLI** (will be installed via npm)

---

## 🏗️ Architecture Overview

### Static Site + Serverless Functions

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌────────────────────────┐   │
│  │  Static Assets   │         │  Serverless Functions  │   │
│  │  (React App)     │────────▶│  (API Proxy)           │   │
│  │                  │         │                        │   │
│  │  - HTML/JS/CSS   │         │  /functions/api/       │   │
│  │  - Components    │         │    gemini.ts           │   │
│  │  - Audio Engine  │         │                        │   │
│  └──────────────────┘         └────────────────────────┘   │
│         │                              │                    │
│         │                              │ (Secure)           │
│         │                              ▼                    │
│         │                     ┌─────────────────┐           │
│         │                     │  Gemini API     │           │
│         │                     │  (Google)       │           │
│         │                     └─────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **React App** | User interface, typing engine, visualizer | `/src`, `/components` |
| **Vite Build** | Bundler, dev server, production build | `vite.config.ts` |
| **Cloudflare Function** | Secure API proxy (hides Gemini API key) | `/functions/api/gemini.ts` |
| **Gemini Service** | API client (dev vs prod versions) | `/services/geminiService*.ts` |

---

## 💻 Local Development Setup

### Step 1: Clone and Install

```bash
cd ~/keystroke-symphony-web
npm install
```

### Step 2: Configure Environment

```bash
# Copy example env file
cp .env.example .env.local

# Edit .env.local and add your Gemini API key
nano .env.local
```

**`.env.local` contents:**
```bash
GEMINI_API_KEY=your_actual_api_key_here
```

### Step 3: Run Development Server

```bash
npm run dev
```

Visit: `http://localhost:3000`

### Development Mode Notes

- Uses **direct Gemini API calls** (original `geminiService.ts`)
- API key loaded from `.env.local`
- Hot module replacement (HMR) enabled
- No Worker function needed locally (unless testing production mode)

---

## 🚀 Production Deployment

### Method 1: GitHub Integration (Recommended)

#### Step 1: Create GitHub Repository

```bash
cd ~/keystroke-symphony-web

# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: Keystroke Symphony web app"

# Create GitHub repo and push
gh repo create keystroke-symphony-web --public --source=. --remote=origin
git push -u origin main
```

#### Step 2: Connect to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Pages**
2. Click **"Create a project"** → **"Connect to Git"**
3. Select your **`keystroke-symphony-web`** repository
4. Configure build settings:

**Build Configuration:**
```
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: /
```

5. Click **"Save and Deploy"**

#### Step 3: Configure Environment Variables

1. In Cloudflare Pages dashboard → Your Project → **Settings** → **Environment Variables**
2. Add **Production** variable:

```
Variable name: GEMINI_API_KEY
Value: your_gemini_api_key_here
Encrypt: ✅ (checked)
```

3. Click **"Save"**

#### Step 4: Update Service for Production

You need to switch to the production Gemini service that uses the Worker endpoint:

```bash
# Rename current service (backup for dev)
mv services/geminiService.ts services/geminiService.dev.ts

# Use production service
mv services/geminiService.production.ts services/geminiService.ts

# Commit and push
git add .
git commit -m "Switch to production Gemini service with Worker proxy"
git push
```

Cloudflare Pages will automatically redeploy!

---

### Method 2: Wrangler CLI (Direct Deployment)

#### Step 1: Install Wrangler

```bash
npm install -D wrangler
npx wrangler login
```

#### Step 2: Build and Deploy

```bash
# Build for production
npm run build:production

# Deploy to Cloudflare Pages
npm run deploy

# Or deploy preview (no production environment variables)
npm run deploy:preview
```

#### Step 3: Set Environment Variables

```bash
# Set production secret
npx wrangler pages secret put GEMINI_API_KEY
# Paste your API key when prompted
```

---

## 🔐 Environment Variables

### Development (.env.local)

```bash
# Required for local development
GEMINI_API_KEY=your_dev_api_key

# Optional: Test against deployed Worker locally
# VITE_API_ENDPOINT=https://your-project.pages.dev/api/gemini
```

### Production (Cloudflare Pages Dashboard)

| Variable | Value | Encrypted | Environment |
|----------|-------|-----------|-------------|
| `GEMINI_API_KEY` | Your Gemini API key | ✅ Yes | Production |

**Important:**
- **DO NOT** commit `.env.local` to git (already in `.gitignore`)
- **DO NOT** expose API keys in client-side code
- Production uses **Cloudflare Worker** to proxy API calls securely

---

## 🔒 Security Considerations

### ✅ What We Do

1. **API Key Protection**
   - Gemini API key stored as encrypted environment variable in Cloudflare
   - Never exposed in client-side JavaScript bundle
   - Proxied through Cloudflare Function (`/functions/api/gemini.ts`)

2. **CORS Configuration**
   - Worker function handles CORS headers
   - Allows cross-origin requests (can be restricted per domain)

3. **Error Handling**
   - Graceful fallbacks if Gemini API fails
   - No sensitive error details exposed to client

### ⚠️ Optional Enhancements

1. **Rate Limiting**
   - Add Cloudflare Workers rate limiting to prevent abuse
   - Limit requests per IP/session

2. **Authentication**
   - Add user authentication (Supabase, Auth0, etc.)
   - Track usage per user

3. **Domain Restriction**
   - Update CORS headers in Worker to allow only your domain:
     ```typescript
     'Access-Control-Allow-Origin': 'https://your-domain.com'
     ```

---

## 🛠️ Troubleshooting

### Issue: "API key not configured" Error

**Cause:** Environment variable not set in Cloudflare Pages

**Solution:**
1. Go to Cloudflare Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add `GEMINI_API_KEY` with your actual key
3. Redeploy the project

---

### Issue: Worker Function Not Found (404)

**Cause:** Functions directory not deployed correctly

**Solution:**
1. Ensure `/functions/api/gemini.ts` exists in your repository
2. Cloudflare Pages automatically deploys files in `/functions` as serverless functions
3. Check build logs in Cloudflare Dashboard

---

### Issue: CORS Error in Browser

**Cause:** Worker CORS headers not configured

**Solution:**
1. Check `/functions/api/gemini.ts` has CORS headers:
   ```typescript
   'Access-Control-Allow-Origin': '*'
   ```
2. For production, restrict to your domain:
   ```typescript
   'Access-Control-Allow-Origin': 'https://keystroke-symphony.pages.dev'
   ```

---

### Issue: Build Fails on Cloudflare

**Common Causes:**
1. **Node version mismatch** → Set in Pages settings: Environment variables → `NODE_VERSION` = `18`
2. **Missing dependencies** → Verify `package.json` includes all deps
3. **TypeScript errors** → Run `npm run build` locally first to catch errors

---

### Issue: Gemini API Quota Exceeded

**Cause:** Free tier API limits reached

**Solution:**
1. Check usage in [Google AI Studio](https://aistudio.google.com/)
2. Implement client-side caching for repeated requests
3. Add rate limiting in Worker function
4. Upgrade to paid Gemini API tier

---

## 📊 Deployment Checklist

### Pre-Deployment

- [ ] Run `npm install` successfully
- [ ] Test locally with `npm run dev`
- [ ] Verify Gemini API key works
- [ ] Build completes without errors: `npm run build`
- [ ] Preview build works: `npm run preview`

### GitHub Integration

- [ ] Repository created on GitHub
- [ ] Code pushed to `main` branch
- [ ] Connected to Cloudflare Pages
- [ ] Build settings configured (Vite, `npm run build`, `dist`)
- [ ] Environment variable `GEMINI_API_KEY` added
- [ ] Production service switch committed

### Post-Deployment

- [ ] Deployment successful (check Cloudflare Dashboard)
- [ ] Visit deployed URL (e.g., `https://keystroke-symphony.pages.dev`)
- [ ] Test typing interface works
- [ ] Test Gemini AI features (theme generation, performance analysis)
- [ ] Verify audio playback
- [ ] Test on mobile devices
- [ ] Check browser console for errors

---

## 🔗 Useful Links

- **Cloudflare Pages Docs**: https://developers.cloudflare.com/pages/
- **Cloudflare Functions**: https://developers.cloudflare.com/pages/functions/
- **Gemini API Docs**: https://ai.google.dev/api/rest
- **Vite Build Docs**: https://vitejs.dev/guide/build.html

---

## 🎉 Success!

Once deployed, your Keystroke Symphony app will be live at:

```
https://<your-project-name>.pages.dev
```

Custom domain setup:
1. Cloudflare Pages → Your Project → **Custom domains**
2. Add your domain (must use Cloudflare DNS)
3. Follow verification steps

---

**Next Steps:**
- Integrate Supabase for user accounts and composition saving
- Add analytics (Cloudflare Web Analytics, Google Analytics)
- Implement user leaderboards and remix gallery
- Deploy to custom domain

**Need Help?**
- Check Cloudflare Pages build logs
- Review browser console errors
- Verify environment variables are set correctly
- Test Worker function endpoint: `https://your-project.pages.dev/api/gemini` (POST request)

---

🤖 *Deployment guide generated by Claude Code* | Version 1.0 | 2025-11-22
