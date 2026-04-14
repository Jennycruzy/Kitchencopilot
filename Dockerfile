# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ── Stage 2: Build backend ────────────────────────────────────────────────────
FROM node:22-alpine AS backend-builder

WORKDIR /app
RUN apk add --no-cache curl bash python3 make g++
# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

COPY package.json ./
COPY packages ./packages
# Do NOT copy bun.lockb — let bun resolve the latest satisfying versions from package.json
RUN bun install
COPY . .
# Remove frontend from backend build
RUN rm -rf frontend
RUN npx tsc

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache bash sqlite

# Install bun in production
RUN curl -fsSL https://bun.sh/install | bash 2>/dev/null
ENV PATH="/root/.bun/bin:$PATH"

# Copy backend
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/packages ./packages
COPY characters/ ./dist/characters/
COPY package.json ./

# Copy built frontend (served as static files from backend or nginx)
COPY --from=frontend-builder /app/frontend/dist ./public

RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -q -O- http://localhost:3000/api/health || exit 1

CMD ["node", "--experimental-specifier-resolution=node", "dist/src/index.js"]
