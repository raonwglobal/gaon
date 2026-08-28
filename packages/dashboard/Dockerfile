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
COPY packages/dashboard/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENV ADMIN_TOKEN=""
ENV CONTROL_API_BASE=""
ENTRYPOINT ["/docker-entrypoint.sh"]
