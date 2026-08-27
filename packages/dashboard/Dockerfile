# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

COPY packages/dashboard/package.json ./
COPY packages/dashboard/tsconfig.json ./
COPY packages/dashboard/vite.config.ts ./
COPY packages/dashboard/index.html ./
COPY packages/dashboard/src ./src

RUN npm install && npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY packages/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
