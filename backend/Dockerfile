# ─────────────────────────────────────────────
# Stage 1: Install production dependencies
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# ─────────────────────────────────────────────
# Stage 2: Lean runtime image
# ─────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Add postgresql-client (for the seed script) and non-root user for security
RUN apk add --no-cache postgresql-client && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Ensure the app runs as non-root
USER appuser

EXPOSE 8080

CMD ["sh", "-c", "npm run migrate:up && node src/server.js"]
