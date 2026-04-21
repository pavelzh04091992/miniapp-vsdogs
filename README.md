# MiniAppPuppys

Minimal Telegram Mini App starter with one test button and a clean structure for дальнейшей разработки.

## Stack

- Vite
- TypeScript
- Telegram WebApp SDK

## Quick start

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Send channel message

Create `.env` from `.env.example`, fill in your bot token, channel id, and Telegram direct Mini App link. Use the same Telegram link in `VITE_MINI_APP_LINK` for the fallback page button.

```bash
npm run send:channel-message
```

Required bot/channel setup:

- The bot must be added to the channel as an administrator.
- To pin the message automatically, the bot needs permission to pin messages.
- Configure the bot's Main Mini App in BotFather before using the channel button.
- Use a Telegram direct Mini App link, for example `https://t.me/botusername/appname` or `https://t.me/botusername?startapp`.
- For channel posts, the script uses an inline URL button that points to Telegram's Mini App deep link. This opens the Mini App in Telegram instead of a regular browser link.

## Project structure

```text
scripts/
  send-channel-message.mjs # Sends channel post with inline Mini App button
src/
  app.ts            # Markup for the initial screen
  main.ts           # Application bootstrap
  styles.css        # Base styling
  lib/
    telegram.ts     # Telegram WebApp integration and theme sync
```

## Notes

- The project works both in a regular browser and inside Telegram.
- Inside Telegram, the app calls `WebApp.ready()` and attempts to expand the viewport.
- The only action for now is a single test button, which updates status text and shows a Telegram alert.

## Next steps

- Add router/state management only when real flows appear
- Connect backend API and auth/session validation
- Add analytics, error reporting, and feature flags
