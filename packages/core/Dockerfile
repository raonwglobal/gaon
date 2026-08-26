FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/core/package.json ./packages/core/
RUN npm install --workspace=@mcp-sse/core --if-present || npm install
COPY packages/core ./packages/core
WORKDIR /app/packages/core
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/core/package.json ./
COPY --from=builder /app/packages/core/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
