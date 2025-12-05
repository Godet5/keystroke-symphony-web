# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Development Commands

### Local Development
```bash
npm install                    # Install dependencies
npm run dev                   # Start Vite dev server (http://localhost:5173)
npm run build                 # Production build → dist/
npm run build:production      # Explicit production mode build
npm run preview               # Preview production build locally
```

### Deployment
```bash
npm run deploy                # Build + deploy to Cloudflare Pages via Wrangler
npm run deploy:preview        # Deploy preview without production env vars
```

**Automated Deployment**: Pushing to `main` branch triggers GitHub Actions workflow that builds and deploys to Cloudflare Pages automatically.

---

## Architecture Overview

### Application Flow (State Machine)

The app is a **finite state machine** with React state management:

```
LANDING → GENERATING → PLAYING → RESULTS
   ↑          ↓           ↓          ↓
   └──────────┴───────────┴──────────┘
              handleRestart()
```

**States** (see `types.ts`):
- `LANDING`: User selects theme and mode (Challenge/Free Play)
- `GENERATING`: Waiting for Gemini AI to generate song config
- `PLAYING`: User types; audio + visualizer active
- `RESULTS`: Performance stats + AI critique displayed

**Data Flow**:
1. User enters theme → `generateSongConfig()` (Gemini AI) → `SongConfig`
2. `SongConfig` → `TypingInterface` → User types → `TypingStats`
3. `TypingStats` + `SongConfig` → `analyzePerformance()` (Gemini AI) → `AnalysisResult`

---

### Key Architectural Components

#### 1. **Gemini API Integration** (Dual-Mode)

**Production** (`services/geminiService.ts`):
- Calls `/api/gemini` (Cloudflare Pages Function)
- API key secured server-side in Worker
- Used when deployed to Cloudflare

**Development** (`services/geminiService.dev.ts`):
- Direct calls to Google Gemini API
- Requires `GEMINI_API_KEY` in `.env.local`
- Used for local testing

**Switch between modes**: Rename files or use environment-based imports.

#### 2. **Cloudflare Pages Function** (`/functions/api/gemini.ts`)

Serverless API proxy that:
- Accepts `POST /api/gemini` with `{ action: 'generate' | 'analyze', payload: {...} }`
- Reads `GEMINI_API_KEY` from Cloudflare environment variables (encrypted)
- Proxies requests to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`
- Returns structured JSON responses
- Handles CORS for cross-origin requests

**Security**: API key never exposed to client; Worker handles all external API calls.

#### 3. **Audio Engine** (`utils/audioEngine.ts`)

Web Audio API-based synthesizer:
- **ADSR envelope** (Attack, Decay, Sustain, Release) per `SoundProfile`
- **Oscillator types**: sine, square, sawtooth, triangle
- **Effects chain**: BiquadFilter → WaveShaperNode (distortion) → ConvolverNode (reverb)
- **Frequency mapping**: Maps keyboard keys to musical notes (pentatonic/major/minor/blues/chromatic scales)

**Key method**: `playNote(frequency, soundProfile)` - Triggers note with custom timbre.

#### 4. **Visualizer** (`components/Visualizer.tsx`)

Canvas-based particle system:
- Spawns particles on keystroke (color mapped to key)
- Physics simulation (velocity, gravity, decay)
- Renders at 60fps via `requestAnimationFrame`

---

## Component Responsibilities

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `Landing` | Mode selection, theme input, preset loading | `onStart`, `onLoadPreset`, `isLoading` |
| `TypingInterface` | Core typing game logic, audio playback, visual feedback | `config`, `mode`, `onComplete`, `onRestart` |
| `Results` | Performance display, AI critique, restart option | `stats`, `config`, `onRestart` |
| `SynthControls` | Real-time audio parameter tweaking (optional) | `soundProfile`, `onChange` |
| `Visualizer` | Canvas particle effects synced to typing | `particles` |

---

## Environment Variables

### Local Development (`.env.local`)
```bash
GEMINI_API_KEY=AIza...your-key...   # Required for local dev (direct API calls)
```

### Production (Cloudflare Pages Dashboard)
```bash
GEMINI_API_KEY=AIza...your-key...   # Encrypted, accessible only to Worker
```

**Important**: `.env.local` is gitignored; never commit API keys.

---

## Deployment Architecture

**Live Production URLs**:
- Primary: https://keystroke-symphony-web.pages.dev
- Project ID: `61ac69f5-eb5d-4d07-b77c-654169f7b6cf`
- Account: DGF Creations Cloudflare

```
User Browser
    ↓
https://keystroke-symphony-web.pages.dev (Cloudflare Pages)
    ├── Static Assets (HTML/JS/CSS from /dist)
    └── Serverless Function (/api/gemini)
            ↓
        Cloudflare Worker (functions/api/gemini.ts)
            ↓
        Google Gemini API (with KEYSTROKE_SYMPHONY_API_KEY)
```

**GitHub Actions Workflow** (`.github/workflows/deploy.yml`):
- Triggers on push to `main` or manual dispatch
- Builds app (`npm run build` with `--legacy-peer-deps`)
- Deploys to Cloudflare Pages via `cloudflare/pages-action@v1`
- Requires GitHub Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Build time: ~43s | Status: Operational

**Cloudflare Pages Configuration**:
- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `GEMINI_API_KEY` (Keystroke Symphony specific key)

---

## Type System (TypeScript)

**Core Types** (`types.ts`):
- `AppState`: Enum for state machine states
- `AppMode`: `CHALLENGE` (type provided text) vs `FREE_PLAY` (no text, pure sound)
- `SongConfig`: Generated by Gemini AI (theme, text, mood, tempo, soundProfile)
- `SoundProfile`: ADSR envelope + oscillator type + effects parameters
- `TypingStats`: WPM, accuracy, duration, mistakes, totalChars
- `AnalysisResult`: AI-generated performance critique (title, critique, score)

---

## Gemini AI Prompts

The Worker function uses different prompts based on `action`:

### `action: 'generate'` (Song Config)
**Challenge Mode**: Generates rhythmic, typeable text (40-60 words) + matching sound profile
**Free Play Mode**: Generates only sound profile (no text)

**Response Schema**:
```typescript
{
  text: string,
  mood: string,
  tempo: number (60-140),
  soundProfile: {
    oscillatorType: 'sine' | 'square' | 'sawtooth' | 'triangle',
    attack: number,
    decay: number,
    sustain: number,
    release: number,
    filterFreq: number,
    filterQ: number,
    distortion: number (0-1),
    reverbMix: number (0-1)
  }
}
```

### `action: 'analyze'` (Performance Critique)
Takes `TypingStats` + `SongConfig`, returns AI-generated performance review.

**Response Schema**:
```typescript
{
  title: string,       // Creative performance title
  critique: string,    // 2-sentence witty critique
  score: number        // 0-100
}
```

---

## Build Output

**Vite** bundles to `/dist`:
- `dist/index.html` - Entry point
- `dist/assets/` - Hashed JS/CSS bundles
- Worker function auto-deploys from `/functions/api/gemini.ts` (Cloudflare Pages picks this up)

**Note**: Wrangler deployment (`npm run deploy`) requires authenticated Wrangler CLI. GitHub Actions handles this automatically in CI.

---

## Common Development Scenarios

### Adding a New App Mode
1. Update `AppMode` enum in `types.ts`
2. Modify `generateSongConfig()` prompt logic in Worker (`functions/api/gemini.ts`)
3. Add UI selection in `Landing.tsx`
4. Handle mode-specific rendering in `TypingInterface.tsx`

### Modifying Sound Synthesis
- Edit `audioEngine.ts` → Update `playNote()` logic
- Change ADSR envelope, filter curves, or add new effects
- Adjust `SoundProfile` type if adding new parameters

### Changing Gemini Model
- Update `geminiEndpoint` in `functions/api/gemini.ts` (currently: `gemini-2.0-flash-exp`)
- Adjust prompt if new model has different capabilities

### Testing Worker Function Locally
- Cannot test Cloudflare Workers on Android/Termux (unsupported platform)
- Use `geminiService.dev.ts` (direct API calls) for local dev
- Deploy to Cloudflare for Worker testing

---

## Security Notes

- **API Key Protection**: Never commit `.env.local`; always use Cloudflare environment variables in production
- **CORS**: Worker function allows `Access-Control-Allow-Origin: *` (can restrict to specific domain post-launch)
- **Error Handling**: Worker sanitizes errors to prevent API key leakage in responses

---

## Related Documentation

- `DEPLOYMENT.md` - Comprehensive Cloudflare Pages deployment guide
- `README.md` - Quick start for local development
- `CLOUDFLARE_SETUP_STEPS.md` - Manual Cloudflare setup instructions
