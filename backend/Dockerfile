# ═══════════════════════════════════════════════════════════════
# STAGE 1: Dependency installer
# Separates production deps from dev deps.
# ═══════════════════════════════════════════════════════════════
FROM node:24-slim AS deps

WORKDIR /app
COPY package*.json ./

# Install ONLY production dependencies — no nodemon, jest, etc.
RUN npm ci --only=production

# ═══════════════════════════════════════════════════════════════
# STAGE 2: Production runtime
# ═══════════════════════════════════════════════════════════════
FROM node:24-slim AS production

# Set NODE_ENV — many libraries behave differently in production
ENV NODE_ENV=production

WORKDIR /app

# Copy only what's needed to run the server
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

# Don't run as root in production — security best practice
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 express
USER express

EXPOSE 5000

# Use node directly — not nodemon
CMD ["node", "src/server.js"]