# syntax=docker/dockerfile:1.7
FROM node:22-slim AS app

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json .npmrc ./
# npm ci runs the terminology postinstall hook, so the hook must exist before
# the rest of the application source is copied into the image.
COPY scripts/patch-core-terminology.mjs ./scripts/patch-core-terminology.mjs
RUN --mount=type=secret,id=npm_token \
    NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token 2>/dev/null || true)" npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8080

EXPOSE 8080
CMD ["npm", "run", "start"]
