FROM node:20-alpine AS builder
WORKDIR /app
COPY packages/control-plane/package.json ./
RUN npm install
COPY packages/control-plane .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
