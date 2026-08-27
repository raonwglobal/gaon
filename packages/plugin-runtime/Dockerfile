FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev 2>/dev/null || true
COPY src ./src
RUN npm install typescript tsx --no-save && npx tsc --outDir dist --module NodeNext --moduleResolution NodeNext --target ES2022 --esModuleInterop src/server.ts || cp -r src dist
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server.js"]
