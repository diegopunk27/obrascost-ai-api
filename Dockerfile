FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS dependencies
COPY package.json ./
RUN bun install --frozen-lockfile

# Production image
FROM base AS production
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1

# Run the application
CMD ["bun", "run", "src/index.ts"]