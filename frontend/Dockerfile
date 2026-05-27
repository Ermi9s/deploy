FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm config set fetch-retries 5 && pnpm install

COPY . .

# These are the Docker-internal URLs used by Next.js rewrites.
# They are baked into the build so the production server proxies correctly.
ARG MANAGEMENT_API=http://management:8000
ARG INGESTION_API=http://ingestion:8000
ARG RAG_API=http://rag:8000
ARG NOTIFICATION_API=http://notification:8000
ENV MANAGEMENT_API=$MANAGEMENT_API
ENV INGESTION_API=$INGESTION_API
ENV RAG_API=$RAG_API
ENV NOTIFICATION_API=$NOTIFICATION_API

RUN pnpm build

FROM node:20-alpine AS runner

WORKDIR /app

# Carry forward the internal service URLs into the runtime container
ENV MANAGEMENT_API=http://management:8000
ENV INGESTION_API=http://ingestion:8000
ENV RAG_API=http://rag:8000
ENV NOTIFICATION_API=http://notification:8000

COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
