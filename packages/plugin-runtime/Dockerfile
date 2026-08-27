# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npm install && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist

# runtime has no production deps required beyond Node stdlib; keep package.json for metadata
EXPOSE 8080
USER node
CMD ["node", "dist/server.js"]
