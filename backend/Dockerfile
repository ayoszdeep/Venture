# syntax=docker/dockerfile:1

FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Copy manifests first so dependency layers stay cached across source changes.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# Run as the image's unprivileged user rather than root.
USER node

EXPOSE 4000

# Lightweight liveness probe against the existing health route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
