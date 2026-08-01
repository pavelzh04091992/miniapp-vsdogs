# MiniAppPuppys

Telegram Mini App for a dog school with a Vite frontend, Telegram WebApp integration, and a lightweight bot webhook that collects channel videos into Mini App cards.

## Stack

- Vite
- TypeScript
- Telegram WebApp SDK
- Node.js built-in HTTP server for bot webhook handling

## Quick start

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Container deploy without a domain

This branch includes a minimal Traefik setup for a clean test server without a domain.
Traefik listens on port `80` and routes all HTTP traffic to one app container.
The app container serves the built Mini App from `dist/` and handles `/health` plus the Telegram webhook.

```bash
cp .env.example .env
# fill BOT_TOKEN and Mini App values in .env
docker compose up -d --build
curl http://SERVER_IP/health
```

Runtime video catalog data is stored in the local `./data` directory and mounted into the app container.

Telegram Mini Apps and Telegram webhooks require a trusted HTTPS public URL for real Telegram usage.
Without a domain, use this setup for server smoke-testing, or put a temporary HTTPS tunnel in front of the server.

## Channel entry message

Create `.env` from `.env.example`, fill in the bot and Mini App values, then send the pinned channel message:

```bash
npm run send:channel-message
```

Requirements:

- The bot must be an admin in the channel
- The bot needs permission to pin messages if you want auto-pin
- The Mini App must be configured in BotFather
- `MINI_APP_LINK` should be a Telegram Mini App deep link such as `https://t.me/botusername/appname`

## Auto-create video cards from channel posts

The project now supports this flow:

1. You publish a channel post with a video
2. Telegram sends a `channel_post` update to your webhook
3. The webhook stores the post in `public/data/videos.json`
4. The Mini App loads this catalog and shows a new video card
5. Clicking the card opens the original Telegram post

### Post format

Use a hashtag in the post caption to map the video to a Mini App section:

```text
Как приучить щенка к туалету дома

Разбираем первые шаги без наказаний
#puppy-toilet-home
```

Right now the app uses `#puppy-toilet-home`.

### Run the bot webhook server

```bash
npm run bot:server
```

By default it listens on `http://0.0.0.0:8787/telegram/webhook`.

### Register the Telegram webhook

Expose the bot server with your domain or tunnel, set `PUBLIC_BASE_URL` in `.env`, then run:

```bash
npm run bot:set-webhook
```

Recommended `.env` fields for this flow:

- `PUBLIC_BASE_URL=https://your-domain-or-ngrok`
- `TELEGRAM_WEBHOOK_SECRET=some-random-secret`
- `PUBLIC_CHANNEL_USERNAME=your_public_channel_username`
- `KNOWN_VIDEO_SITUATION_SLUGS=puppy-toilet-home`
- `DEFAULT_VIDEO_SITUATION_SLUG=puppy-toilet-home`

## Project structure

```text
public/
  data/videos.json           # Stored catalog for Mini App video cards
scripts/
  run-bot-server.mjs         # Receives Telegram webhook updates
  send-channel-message.mjs   # Sends channel post with Mini App button
  set-webhook.mjs            # Registers Telegram webhook
  video-catalog.mjs          # Shared catalog storage helpers
src/
  app.ts                     # Screen markup
  main.ts                    # App bootstrap and routing
  styles.css                 # UI styling
  lib/
    telegram.ts              # Telegram WebApp integration
    videos.ts                # Frontend video catalog loader
```

## Notes

- If the video catalog is empty, the Mini App shows the existing empty state
- The webhook currently stores a placeholder thumbnail for Telegram videos
- Opening Telegram post links inside the Mini App uses `openTelegramLink` when available
