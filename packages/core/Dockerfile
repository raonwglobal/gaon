# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

# Self-contained package build (no monorepo workspace required at image build time)
COPY packages/core/package.json ./
COPY packages/core/tsconfig.json ./
COPY packages/core/src ./src

RUN npm install && npm run build

# Production deps only
RUN rm -rf node_modules && npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV PLUGINS_DIR=/app/plugins

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY plugins ./plugins

EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
