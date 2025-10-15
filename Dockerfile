# Production Dockerfile for the API server
FROM node:18-alpine AS base
WORKDIR /app

# Install only production deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm ci --omit=dev

# Copy source
COPY . .

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server.js"]

