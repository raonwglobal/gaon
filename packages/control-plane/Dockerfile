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

# git: required for POST /api/plugins/install (git clone)
# ca-certificates: HTTPS remotes
RUN apk add --no-cache git ca-certificates && update-ca-certificates

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p /plugins && chmod 777 /plugins

EXPOSE 3001
# Run as root so bind-mounted ./plugins is writable across host UIDs.
# For locked-down prod, mount a dedicated volume owned by node and switch USER.
CMD ["node", "dist/index.js"]
