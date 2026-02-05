# ================================
# Multi-stage Dockerfile for DrawNGuess
# Builds client (Vite/React) and server (Node.js/TypeScript)
# ================================

# ================================
# Stage 1: Build Client (Frontend)
# ================================
FROM node:20-alpine AS client-builder

# Build argument for production URL
ARG VITE_API_URL

WORKDIR /app

# Copy root package files for client build
COPY package.json package-lock.json ./

# Copy config files needed for Vite build
COPY tsconfig*.json vite.config.ts index.html ./

# Copy source code and shared libraries
COPY src ./src
COPY shared ./shared
COPY public ./public

# Install dependencies and build client
RUN npm ci --prefer-offline --no-audit

# Set environment variable for Vite build
ENV VITE_API_URL=$VITE_API_URL

# Build client with production API URL
RUN npm run build

# ================================
# Stage 2: Build Server (Backend)
# ================================
FROM node:20-alpine AS server-builder

WORKDIR /app

# Copy root package.json to install shared dependencies (zod, etc.)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit

# Copy shared libraries (dependencies now available)
COPY shared ./shared

# Copy and install server dependencies
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --prefer-offline --no-audit

# Copy server source and config
COPY server/tsconfig.json ./
COPY server ./

# Build server TypeScript to JavaScript
# The shared folder can now resolve zod from parent node_modules
RUN npm run build

# ================================
# Stage 3: Production Runtime
# ================================
FROM node:20-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Install production dependencies for server
COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci --prefer-offline --no-audit --omit=dev

WORKDIR /app

# Copy built server from builder stage
# The TypeScript build outputs to server/dist with structure:
# dist/index.js (compiled server code)
# Note: shared imports are compiled into the output
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/package.json

# Copy built client (static files) from client-builder
COPY --from=client-builder /app/dist ./client/dist

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user for security
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Server start
# With rootDir="../", TypeScript outputs: dist/server/index.js and dist/shared/
WORKDIR /app/server
CMD ["node", "dist/server/index.js"]
