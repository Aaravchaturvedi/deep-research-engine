# ---- build stage ----
# NOTE: Debian (glibc) NOT alpine (musl). @xenova/transformers pulls
# onnxruntime-node which needs ld-linux-x86-64.so.2 — missing on alpine,
# so embedding crashes with "Error loading shared library ld-linux-x86-64.so.2".
FROM node:22-bookworm-slim AS build
# OpenSSL must exist BEFORE `prisma generate` so Prisma detects the
# openssl-3.x engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage ----
FROM node:22-bookworm-slim
# Provides libssl.so.3 for the Prisma query + schema engines, plus glibc
# loader for onnxruntime-node (local embeddings).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Prisma client engine + compiled output + schema (for migrate deploy)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 5000
CMD ["./docker-entrypoint.sh"]
