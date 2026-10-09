FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM node:22-alpine AS app
WORKDIR /app
ENV NODE_ENV=production \
    APP_SERVER_PORT=8787

COPY --chown=node:node scripts/app-server.mjs scripts/auth-database.mjs scripts/rate-limit.mjs scripts/telegram-auth.mjs scripts/telegram-bot.mjs scripts/video-catalog.mjs ./scripts/
COPY --from=build --chown=node:node /app/dist ./dist

RUN mkdir -p data public/data && chown -R node:node data public

EXPOSE 8787
USER node
CMD ["node", "scripts/app-server.mjs"]
