FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm config set fetch-retries 5 && pnpm install

COPY . .

# Declare build-time arguments to bake into static Next.js production build
ARG NEXT_PUBLIC_MANAGEMENT_API
ARG NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_MANAGEMENT_API=$NEXT_PUBLIC_MANAGEMENT_API
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL

RUN pnpm build

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
