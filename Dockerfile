# A container image of the whole app. Stage 1 builds the React website; stage 2 runs the server.

# ---- Stage 1: build the website ----
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Stage 2: the running server ----
FROM node:22-alpine
ENV NODE_ENV=production PORT=5000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY --from=client /app/client/dist ./client/dist
# Run as the built-in non-root user, which is safer.
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://localhost:5000/api/health || exit 1
CMD ["node", "server/index.js"]
