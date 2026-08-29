# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install && npm run build
RUN rm -rf node_modules && npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV INSTALL_WORKER_PORT=3002
RUN apk add --no-cache git ca-certificates && update-ca-certificates
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
RUN mkdir -p /plugins && chmod 777 /plugins
EXPOSE 3002
CMD ["node", "dist/index.js"]
