FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY index.html tsconfig.json vite.config.ts ./
COPY scripts/check-private-bundle.mjs scripts/protected-routes.mjs ./scripts/
COPY public ./public
COPY src ./src

RUN npm run build

FROM node:22-alpine AS app
WORKDIR /app
ENV NODE_ENV=production \
    APP_SERVER_PORT=8787

COPY --chown=node:node scripts/app-server.mjs scripts/auth-database.mjs scripts/env.mjs scripts/http-utils.mjs scripts/protected-routes.mjs scripts/rate-limit.mjs scripts/server-config.mjs scripts/static-server.mjs scripts/telegram-api.mjs scripts/telegram-auth.mjs scripts/telegram-bot.mjs scripts/video-catalog.mjs ./scripts/
COPY --from=build --chown=node:node /app/dist ./dist

RUN mkdir -p data && chown -R node:node data

EXPOSE 8787
USER node
CMD ["node", "scripts/app-server.mjs"]
