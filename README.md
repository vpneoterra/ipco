# Patentify — IP Whitespace Strategy Platform

A static-first web platform for patent portfolio strategy, whitespace analysis, CII scoring, and AI-powered IP workflows. Built as a single-page application with iframe-based module architecture.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Deploy](https://img.shields.io/badge/deploy-GitHub%20Pages-brightgreen)

---

## Table of Contents

- [Quick Start](#quick-start)
- [Claude API Setup](#claude-api-setup)
- [GitHub Pages Deployment](#github-pages-deployment)
- [Project Structure](#project-structure)
- [Module Overview](#module-overview)
- [Environment Configuration](#environment-configuration)
- [Security Notes](#security-notes)

---

## Quick Start

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/patentify-platform.git
cd patentify-platform

# 2. Create your local environment config
cp env.local.example.js env.local.js

# 3. Add your Claude API key to env.local.js
#    Open env.local.js and set ANTHROPIC_API_KEY: 'sk-ant-...'

# 4. Serve locally (any static server works)
npx serve .
# or
python -m http.server 8080
# or
php -S localhost:8080
```

Open `http://localhost:8080` in your browser. Access code: `aimakesip`

---

## Claude API Setup

The platform uses the **Anthropic Claude API** for AI features including:
- Workflow generation from documents (Command Center)
- Whitespace discovery and ranking (WhiteSpaces → Lab)
- CII Score calculation pipelines (Analysis)
- Filing strategy generation

### Step 1: Get an API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **Settings → API Keys** ([direct link](https://console.anthropic.com/settings/keys))
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-...`)

### Step 2: Configure the Key

You have **three options** (pick one):

#### Option A: Via the UI (simplest)

1. Open Patentify in your browser
2. Go to **Command Center** → **Agent Settings** tab
3. Paste your API key in the **Claude API Key** field
4. Click **Save Key**

The key is stored in your browser's `localStorage`. It persists across sessions but is only on your machine.

#### Option B: Via `env.local.js` (recommended for development)

```bash
cp env.local.example.js env.local.js
```

Edit `env.local.js`:

```javascript
window.PATENTIFY_CONFIG = {
  ANTHROPIC_API_KEY: 'sk-ant-api03-YOUR-KEY-HERE',
  API_BASE: '',
  DEFAULT_MODEL: 'claude-sonnet-4-20250514',
};
```

> `env.local.js` is `.gitignore`d — it will never be committed.

#### Option C: Via GitHub Secret (for GitHub Pages deployment)

1. Go to your repo on GitHub
2. **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `ANTHROPIC_API_KEY`
5. Value: `sk-ant-api03-YOUR-KEY-HERE`
6. Click **Add secret**

The GitHub Actions workflow injects this secret into `env.local.js` at deploy time.

> **Warning:** This embeds the key in the deployed static site (visible in browser DevTools). Only use this for **private repos** or internal deployments. For public-facing sites, let users enter their own key via Option A.

### Step 3: Verify

1. Open Patentify
2. Go to **Command Center → Agent Settings**
3. The status should show ✓ API key is configured
4. Try an AI feature (e.g., WhiteSpaces → Lab → Generate)

### API Key Permissions

The platform uses these Anthropic API endpoints:
- `POST https://api.anthropic.com/v1/messages` (chat completions)

Required headers (handled automatically by `env.js`):
- `x-api-key` — your API key
- `anthropic-version: 2023-06-01`
- `anthropic-dangerous-direct-browser-access: true` (required for browser-side calls)

### Models Used

| Feature | Model | Purpose |
|---------|-------|---------|
| Workflow generation | `claude-sonnet-4-20250514` | Parse documents into workflow steps |
| Whitespace discovery | `claude-sonnet-4-20250514` | Generate and rank IP whitespaces |
| CII Score computation | `claude-sonnet-4-5-20250929` / `claude-opus-4-6` | Multi-pillar patent scoring |
| Filing strategy | `claude-sonnet-4-20250514` | IP filing recommendations |

---

## GitHub Pages Deployment

### Automatic (Recommended)

1. Push to `main` branch
2. Go to **Settings → Pages → Source**: select **GitHub Actions**
3. Add the `ANTHROPIC_API_KEY` secret (see [Option C above](#option-c-via-github-secret-for-github-pages-deployment))
4. The workflow at `.github/workflows/deploy.yml` deploys automatically on push

Your site will be live at: `https://YOUR_USERNAME.github.io/patentify-platform/`

### Manual

1. Go to **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, folder: `/ (root)`
4. Click **Save**

> With manual deployment, users must enter their API key via the UI (Option A) since there's no build step to inject the secret.

---

## Project Structure

```
patentify-platform/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions → Pages deployment
├── admin/
│   └── index.html              # Command Center (workflows, settings, AI agents)
├── ciis/
│   └── index.html              # CII Score Analysis (rankings, training)
├── dashboard/
│   └── index.html              # Strategy (D3 visualizations, 6 layers)
├── data/
│   └── *.json                  # Sample patent & whitespace data
├── investor/
│   ├── index.html              # Business Plan (React-based pitch deck)
│   └── assets/                 # Compiled React bundle
├── patent-lab/
│   └── index.html              # Patent Lab (pipeline, prior art, sunburst)
├── whitespaces/
│   └── index.html              # WhiteSpaces (explorer, lab, competitive)
├── workflow-config/
│   └── *.json                  # Workflow pipeline definitions
├── index.html                  # Main shell (auth gate + iframe orchestrator)
├── env.js                      # Environment config loader (committed)
├── env.local.example.js        # Template for local secrets (committed)
├── env.local.js                # Your actual secrets (git-ignored)
├── design-tokens.css           # Shared CSS variables
├── chat-widget.js              # Chat widget component
├── cpc-taxonomy.js             # CPC classification data
├── utils.js                    # Shared utilities
├── .gitignore
├── LICENSE
└── README.md
```

---

## Module Overview

| Pill | Module | Key Features |
|------|--------|-------------|
| **Business Plan** | `investor/` | React pitch deck — thesis, market, financials, roadmap, risk, 10-section business plan |
| **Strategy** | `dashboard/` | D3.js interactive layers — convergence graph, heatmap, driver web, competitive radar, filing timeline |
| **WhiteSpaces** | `whitespaces/` | Explorer with 20 whitespace cards, D3 visualizer, AI-powered Lab, competitive landscape, filing strategy |
| **Patent Lab** | `patent-lab/` | Patent pipeline table, CII Score column, sunburst chart, prior art, workflow editor |
| **Command Center** | `admin/` | 4 AI workflows, visual + JSON editors, agent settings, model registry, memory/KB |
| **Analysis** | `ciis/` | CII rankings, whitespace analysis, WF3 CII scoring editor, WF4 training editor |

---

## Environment Configuration

The `env.js` system resolves configuration in priority order:

1. **`env.local.js`** — Local file with your secrets (highest priority, git-ignored)
2. **UI Settings** — Key saved to `localStorage` via Command Center → Settings
3. **Fallback** — No key → AI features show setup prompt

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | `''` | Your Claude API key |
| `API_BASE` | `''` | Backend proxy URL (empty = direct Anthropic calls) |
| `DEFAULT_MODEL` | `claude-sonnet-4-20250514` | Default model for AI features |

---

## Security Notes

- **API keys in static sites are visible** in browser DevTools (Network tab, Sources tab). This is inherent to client-side JavaScript. For public-facing production deployments, consider:
  - A server-side proxy that holds the key and forwards requests
  - Having each user enter their own key via the UI
  - Using Anthropic's [OAuth/SSO](https://docs.anthropic.com/) when available

- The `env.local.js` file is `.gitignore`d to prevent accidental key commits. Never commit API keys directly.

- The `anthropic-dangerous-direct-browser-access: true` header is required by Anthropic for browser-to-API calls. This is by design — it signals to Anthropic that you understand the key is exposed client-side.

- Platform access code: configurable in `index.html` (SHA-256 hashed).

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -m 'Add my feature'`)
4. Push to branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE)
