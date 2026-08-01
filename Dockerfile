FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_MINI_APP_LINK
ARG VITE_TEST_RUTUBE_VIDEO_URL
ENV VITE_MINI_APP_LINK=$VITE_MINI_APP_LINK
ENV VITE_TEST_RUTUBE_VIDEO_URL=$VITE_TEST_RUTUBE_VIDEO_URL

RUN npm run build

FROM node:22-alpine AS app
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY scripts ./scripts
COPY --from=build /app/dist ./dist

RUN mkdir -p public/data

EXPOSE 8787
CMD ["node", "scripts/run-bot-server.mjs"]
