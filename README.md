# 🍽️ KitchenCopilot — Autonomous Kitchen AI

> Built on **ElizaOS Core Agent** • Powered by autonomous reasoning • Deploys to Sevarica VPS + Nosana GPU

---

## Architecture

```
ElizaOS AgentRuntime   ←─── plugin-kitchen (Actions / Providers / Evaluators / Services)
       │
       ├── ModelType.IMAGE_ANALYSIS  → Vision ingredient detection
       ├── ModelType.TEXT_LARGE      → Meal planning & recipe matching
       ├── ModelType.TEXT_SMALL      → Voice commands, expiry advice, budget
       └── MemoryManager             → Per-user inventory persistence
       │
Express REST API        ←─── JWT auth, image upload, plan generation
       │
React + Vite Frontend   ←─── Dashboard, Inventory, MealPlan, ShoppingList
       │
Web Speech API          ←─── Push-to-talk voice in browser
```

---

## Quick Start (Local)

### 1. Prerequisites
```bash
node --version   # v22+
bun --version    # v1.1+
```

### 2. Configure environment
```bash
cd /path/to/kitchen-copilot
cp .env.example .env
nano .env   # Add your model provider key (see options below)
```

### 3. Install dependencies
```bash
# Backend
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 4. Start
```bash
# Terminal 1 — Backend (ElizaOS Agent)
npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:5173** in Chrome (recommended for Web Speech API).

---

## Mobile App (PWA) & Camera Scanning

KitchenCopilot is optimized as a Progressive Web App (PWA) targeting mobile devices and allowing instant ingredient scanning:
1. **Accessing remotely on a VPS**: The application frontend is configured with `@vitejs/plugin-basic-ssl`. To use the camera remotely, access the app securely via `https://YOUR_VPS_IP:5173` (you may need to bypass the self-signed certificate warning locally).
2. **Install to Home Screen**: When opening the app on iOS or Android, use your browser's "Add to Home Screen" or "Install App" function to save it alongside your native apps with offline caching.
3. **Camera Features**: Navigate to the **Inventory** page and tap "**📷 Take Photo**" to snap shots of your fridge or pantry instantly, instead of browsing files.

---

## Model Provider Options

Configure exactly ONE in `.env`:

### Option A — OpenAI (cloud, recommended for best vision quality)
```env
OPENAI_API_KEY=sk-...
```

### Option B — Ollama (local / free)
```bash
# Install Ollama: https://ollama.com
ollama pull llama3.2-vision:latest
```
```env
OLLAMA_SERVER_URL=http://localhost:11434
```

### Option C — Nosana GPU (decentralized GPU credits)
```env
# Once your Nosana job is running, set the Ollama-compatible endpoint:
OLLAMA_SERVER_URL=https://YOUR_JOB_ID.anon.nosana.io
```
> **Adding Nosana GPU Credits**: Go to [app.nosana.io](https://app.nosana.io), fund your wallet with NOS tokens, and deploy an Ollama-compatible GPU job. Copy the endpoint URL into `OLLAMA_SERVER_URL`.

---

## Deploying to Sevarica VPS (24/7)

### 1. SSH into your Sevarica VPS
```bash
ssh root@your-vps-ip
```

### 2. Install Docker
```bash
curl -fsSL https://get.docker.com | bash
systemctl enable docker && systemctl start docker
```

### 3. Clone and configure
```bash
git clone https://github.com/your-username/kitchen-copilot.git
cd kitchen-copilot
cp .env.example .env
nano .env   # Set JWT_SECRET, model provider key, FRONTEND_URL
```

### 4. Build and launch
```bash
docker compose up -d --build
```

### 5. Verify
```bash
docker ps
curl http://localhost:3000/api/health
```

### 6. (Optional) Enable GPU passthrough on Sevarica
```bash
# Install NVIDIA container toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | apt-key add -
# Then uncomment the 'deploy: resources' block in docker-compose.yml
```

### 7. Domain + SSL (recommended)
```bash
apt install nginx certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
# Then update FRONTEND_URL and CORS in .env accordingly
```

---

## ElizaOS Plugin Architecture

```
packages/plugin-kitchen/
├── actions/
│   ├── visionProcessing.ts    → IMAGE_ANALYSIS model
│   ├── inventoryManagement.ts → Eliza MemoryManager
│   ├── recipeMatching.ts      → TEXT_LARGE model
│   ├── mealPlanning.ts        → TEXT_LARGE model
│   ├── shoppingList.ts        → TEXT_SMALL model
│   ├── expirationAnalysis.ts  → Heuristic + TEXT_SMALL
│   ├── budgetPlanning.ts      → TEXT_SMALL model
│   └── voiceInput.ts          → TEXT_SMALL intent routing
├── providers/
│   ├── inventoryProvider.ts   → Injects inventory into every context
│   └── userContextProvider.ts → Injects user profile into every context
├── evaluators/
│   └── inventoryEvaluator.ts  → Post-turn: logs ingredient usage
└── services/
    └── replanningScheduler.ts → 24h autonomous replanning loop
```

---

## Voice Commands (Web Speech API)

Click the 🎤 button (bottom-right) in Chrome and speak:

- *"What can I cook today?"*
- *"I used the eggs"*
- *"Add milk to my shopping list"*
- *"Plan meals for this week"*
- *"Set my budget to $75"*
- *"What's about to expire?"*

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Ingredient detection accuracy | 90%+ of visible items |
| Inventory utilization | ≥85% before suggesting grocery run |
| Autonomous loop | Continuous 24h replanning |
| Data isolation | Per-user, no overlap |

---

## When to Add Nosana GPU Credits

**Build phase**: ✅ Not needed (code runs locally/without GPU)

**Deployment**: Add Nosana credits when you want to:
1. Run a local Ollama vision model (instead of cloud API) on GPU
2. Scale inference with decentralized compute
3. Keep costs at $0 for LLM inference (NOS tokens instead of API credits)

Steps: [app.nosana.io](https://app.nosana.io) → Fund wallet → Deploy GPU job → Use endpoint as `OLLAMA_SERVER_URL`
