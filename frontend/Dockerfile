# ═══════════════════════════════════════════════════════════════
# STAGE 1: Builder
# Full Node.js environment — installs deps and builds the app.
# This image is large but NEVER reaches production.
# ═══════════════════════════════════════════════════════════════
FROM node:24-slim AS builder

WORKDIR /app

# Copy package files first — Docker caches this layer if they haven't changed
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Build the React app — outputs to /app/dist/
# Vite reads .env.production at build time (VITE_API_URL)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ═══════════════════════════════════════════════════════════════
# STAGE 2: Production Server
# Tiny nginx image — copies ONLY the built /dist/ folder.
# Node.js, npm, source code, devDependencies — NONE of it makes it here.
# ═══════════════════════════════════════════════════════════════
FROM nginx:1.27-alpine AS production

# Copy the built app from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom nginx config (see below)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx runs on port 80
EXPOSE 80

# Start nginx in the foreground (Docker needs the process to stay alive)
CMD ["nginx", "-g", "daemon off;"]