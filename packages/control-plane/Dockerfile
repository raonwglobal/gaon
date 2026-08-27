# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

COPY packages/control-plane/package.json ./
COPY packages/control-plane/tsconfig.json ./
COPY packages/control-plane/src ./src

RUN npm install && npm run build
RUN rm -rf node_modules && npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV CONTROL_PORT=3001

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]
