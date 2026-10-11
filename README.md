# MiniAppPuppys

Веб-приложение школы собак с поддержкой Telegram Mini Apps и обычного браузера. Уроки
воспроизводятся собственным плеером с локального сервера; Rutube и YouTube не используются.

## Стек

- Vite + TypeScript
- Собственный HTML5-плеер, HLS.js и MP4 fallback
- Nginx для быстрой раздачи видео и Range-запросов
- Node.js HTTP-сервер для фронтенда, healthcheck и опционального Telegram webhook
- Docker Compose; локальный HTTP gateway или Traefik с HTTPS

## Локальная разработка

```bash
npm ci
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build app media
npm run dev
```

Vite доступен на `http://localhost:3000`. Запросы `/media/` проксируются на media-контейнер
через порт `8081`, а `/api/`, `/auth/` и `/data/` — в единый app-контейнер через локальный порт
`8787`. Для входа нужны Telegram-настройки из `.env` и активный доступ в боте. Не запускайте
параллельно `npm start`: backend и media должны читать одну SQLite-базу внутри Docker. Полный
Docker-стек доступен на `http://localhost:8080` после
`docker compose up -d --build`.

Проверки без Docker:

```bash
npm run typecheck
npm run build
npm run test:auth
npm run verify
```

`npm run verify` выполняет production-сборку и проверяет, что MP4 подготовлены с fast start.

## Локальный Docker-стек

Нужен Docker Engine с Compose v2.

1. Скопируйте репозиторий на сервер и создайте конфигурацию:

   ```bash
   cp .env.example .env
   ```

2. Загрузите видео отдельно — каталог `media/` намеренно не хранится в Git:

   ```text
   media/
     map-puppy-fitness-house/
       video.mp4
   ```

3. Запустите стек:

   ```bash
   docker compose up -d --build
   docker compose ps
   ```

4. Выполните smoke-тест:

   ```bash
   npm run test:smoke -- http://127.0.0.1:8080
   ```

После этого приложение доступно локально по адресу `http://127.0.0.1:8080`. Для входа и просмотра видео
нужны настроенный `BOT_TOKEN`, webhook и активный доступ пользователя. Если
`TELEGRAM_WEBHOOK_SECRET` пуст, webhook отключён.

Полезные команды:

```bash
docker compose logs -f --tail=100 app media gateway
docker compose restart app media gateway
docker compose down
```

## HTTPS с доменом

Укажите реальные `DOMAIN` и `ACME_EMAIL` в `.env`, направьте DNS A/AAAA-запись на сервер и
откройте порты 80/443. Затем запустите профиль Traefik:

```bash
mkdir -p letsencrypt
docker compose --profile production up -d --build
```

Traefik получает сертификат Let's Encrypt и направляет весь трафик в gateway. Gateway проксирует
обычные запросы в app, а `/media/` — в media. App и media находятся во внутренней сети, а app
использует отдельную исходящую сеть для Telegram API. Локальный gateway остаётся доступен на
адресе из `APP_BIND_ADDRESS` для диагностики.

## Locked test-prod на существующем Traefik

Test-prod запускается отдельным Compose-проектом и использует собственные app, media-контейнер
и SQLite-БД. С продом общими остаются только read-only медиатека и proxy-сеть Traefik. Внешний
доступ разрешён только по HTTPS-домену; диагностический порт `8000` слушает loopback.

Перед обновлением сохраните текущую release-копию и test data в `/opt/miniapp-test/backups/`.
Не используйте `docker compose down -v`: persistent data подключаются bind mount-ами и должны
оставаться вне release-каталога.

```bash
cp .env.test-prod.example .env.test-prod
# Заполните BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET, не добавляя файл в Git.
docker compose --env-file .env.test-prod -p miniapp-puppys-test config --quiet
docker compose --env-file .env.test-prod -p miniapp-puppys-test \
  up -d --build --remove-orphans app media gateway
```

После получения сертификата:

```bash
curl -fsS https://dev-82-146-52-99.sslip.io/health
docker compose --env-file .env.test-prod -p miniapp-puppys-test \
  run --rm app node scripts/set-webhook.mjs
npm run test:smoke -- https://dev-82-146-52-99.sslip.io
```

`LOCKED_MODE=true` запрещает запуск с неполным Telegram/HTTPS-конфигом. Test-prod использует
отдельного бота: Telegram поддерживает только один webhook на bot token.

Для rollback верните сохранённую release-копию, оставьте `/opt/miniapp-test/data` на месте и
повторно выполните Compose-команду из восстановленного каталога. Продовый проект
`miniapp-puppys` при обновлении или rollback теста не перезапускается.

### Временный Telegram egress через SSH

Если deployment-host не может подключиться к `api.telegram.org:443`, опциональный override
`docker-compose.telegram-egress.yml` прокидывает только это TLS-соединение через доверенный
SSH-сервер. Используйте отдельный ключ и закреплённый `known_hosts`; SSH-пароль нельзя хранить
в Compose или `.env`.

```bash
docker compose -p miniapp-puppys-test \
  --env-file .env.test-prod \
  -f docker-compose.yml \
  -f docker-compose.telegram-egress.yml \
  up -d --build telegram-egress
```

Sidecar подключается только к исходящей сети app под alias `api.telegram.org`. TLS завершается
на стороне Telegram: SSH-сервер видит только зашифрованный TCP-трафик. Когда прямой маршрут
восстановится, sidecar нужно остановить и запускать базовый Compose без override.

## Подготовка видео

Для обычного MP4 достаточно положить файл по адресу:

```text
media/<video-id>/video.mp4
```

MP4 должен быть подготовлен с fast start (`moov` в начале файла). Для адаптивного HLS установите
FFmpeg и выполните:

```bash
npm run video:prepare -- /path/to/source.mp4 <video-id>
```

Проверить все MP4 в каталоге `media/`:

```bash
npm run media:check
```

Скрипт создаёт:

```text
media/<video-id>/
  master.m3u8
  poster.webp
  video.mp4
  360p/
    index.m3u8
    init.mp4
    segment_00000.m4s
  720p/
  1080p/
```

Для HLS у урока должен быть `sourceType: 'hls'`; для одного MP4 — `sourceType: 'mp4'`.

## Telegram webhook

Один webhook обслуживает публикации канала, личные сообщения бота и callback-кнопки.
Бот хранит пользователей и выданные доступы в `data/auth.sqlite`.

Для его включения задайте как минимум:

```dotenv
TELEGRAM_WEBHOOK_SECRET=long-random-secret
PUBLIC_BASE_URL=https://example.com
BOT_TOKEN=telegram-bot-token
BOT_USERNAME=your_bot_username
ADMIN_TELEGRAM_ID=123456789
MINI_APP_URL=https://example.com
MAGIC_LINK_TTL_SECONDS=600
PUBLIC_CHANNEL_ID=-1001234567890
PUBLIC_CHANNEL_USERNAME=your_channel_username
```

`PUBLIC_CHANNEL_ID` — предпочтительный allowlist для публикаций канала. Если ID не задан,
используется точное сравнение `PUBLIC_CHANNEL_USERNAME`; без обоих значений webhook не изменяет
видеокаталог.

Затем зарегистрируйте webhook:

```bash
npm run bot:set-webhook
```

После `/start` администратор получает меню выдачи и отзыва доступа. Если указанный пользователь
уже запускал бота, он сразу получит уведомление и кнопку Mini App. Иначе администратор получит
персональную deep link, которую нужно передать пользователю. При переходе бот проверяет, что
приглашение открыто тем Telegram ID, которому оно выдано.

Сервер предоставляет API для следующего этапа интеграции фронтенда:

- `POST /api/auth/telegram` — принимает `{ "initData": "..." }`, проверяет подпись Telegram,
  срок `auth_date` и наличие активного доступа, затем создаёт HttpOnly-сессию;
- `GET /api/auth/config` — возвращает публичную ссылку на бота для экрана входа;
- `GET /api/me` — возвращает пользователя текущей сессии;
- `POST /api/logout` — отзывает текущую сессию.

Mini App обменивает проверенный `initData` на серверную сессию. В обычном браузере пользователь
нажимает в боте «Войти в браузере», получает одноразовую ссылку и после перехода также получает
HttpOnly-сессию. До успешной проверки frontend показывает только экран входа или отказа в доступе.
POST-запросы, меняющие авторизацию, принимаются только с Origin из `PUBLIC_BASE_URL`,
`MINI_APP_URL` или `ALLOWED_ORIGINS`. Подтверждение magic link дополнительно привязано к браузеру
короткоживущей HttpOnly-cookie, поэтому ссылку нельзя незаметно навязать чужому браузеру.
Production-сессия по умолчанию использует cookie с префиксом `__Host-`; после перехода со старого
имени cookie пользователю потребуется один раз войти заново. Для работы Mini App во фрейме
Telegram production-cookie использует `SameSite=None; Secure`; локальный HTTP compose override
явно переключает её на `SameSite=Lax`.
Запросы Telegram-auth, magic link и приватные команды бота ограничены по частоте; лимиты и общее
окно настраиваются переменными `AUTH_RATE_LIMIT_MAX`, `MAGIC_LINK_RATE_LIMIT_MAX`,
`BOT_COMMAND_RATE_LIMIT_MAX` и `RATE_LIMIT_WINDOW_SECONDS`. Заголовки
`X-Forwarded-For`/`X-Real-IP` используются для лимитов только при
`TRUST_PROXY_HEADERS=true`; включайте этот параметр лишь когда app-контейнер недоступен напрямую
из интернета и запросы всегда проходят через доверенный reverse proxy.

Публичными остаются только `index.html` и минимальный auth-bootstrap для показа экрана входа.
Основной JS/CSS находится в `/private/`, изображения — в `/assets/`; оба префикса, каталог
`/data/videos.json` и файлы `/media/` доступны только с действующей HttpOnly-сессией. Для медиа
Nginx выполняет внутреннюю проверку сессии перед выдачей HLS, MP4, постеров и Range-ответов.
Изменяемый `data/videos.json` не входит в `public/` и production bundle; dev-сервер блокирует
закодированные и mixed-case варианты приватных маршрутов и проверяет сессию перед выдачей
приватных исходников и ассетов.

## Хранение данных и резервные копии

- `media/` — видеофайлы; монтируется в media-контейнер только для чтения.
- `data/` — изменяемый каталог Telegram-видео и SQLite-база `auth.sqlite`; монтируется в
  app-контейнер для записи.
- `letsencrypt/` — сертификаты Traefik.

Перед обновлением сервера сохраняйте эти три каталога. На Linux пользователь контейнера
приложения имеет UID `1000`; каталог `data/` должен быть доступен ему на запись.

## Ограничение доступа к видео

Без действующей сессии каталог и прямые ссылки `/media/` возвращают `401`. Сессия проверяется
на каждый запрос плейлиста, сегмента, MP4 или постера; поддержка `Range` после проверки
сохраняется. Это закрывает доступ по одной только прямой ссылке, хотя авторизованный пользователь
по-прежнему технически может сохранить уже доступный ему контент.

## Структура

```text
docker-compose.yml          # Единый locked-стек для prod и test-prod
docker-compose.dev.yml      # Loopback-порты app/media для локального Vite
infra/
  local-gateway-nginx.conf  # HTTP gateway для локального и тестового запуска
  media-nginx.conf          # Защищённая раздача MP4/HLS с поддержкой Range
scripts/
  app-server.mjs            # Фронтенд, auth API, healthcheck и Telegram webhook
  auth-database.mjs         # SQLite: пользователи, приглашения и сессии
  env.mjs                   # Единая загрузка и проверка переменных из .env
  http-utils.mjs            # HTTP parsing, cookies, Origin и security headers
  protected-routes.mjs      # Единая граница динамических и статических маршрутов
  rate-limit.mjs            # Ограничение частоты auth и bot-запросов
  server-config.mjs         # Проверка и нормализация серверной конфигурации
  static-server.mjs         # Безопасная раздача production frontend
  telegram-auth.mjs         # Проверка Telegram initData
  telegram-api.mjs          # Безопасный клиент Telegram Bot API с timeout
  telegram-bot.mjs          # Админское и пользовательское меню бота
  prepare-video.mjs         # Подготовка HLS/MP4/poster через FFmpeg
  smoke-test.mjs            # Проверка развёрнутого стека
src/
  bootstrap.ts              # Публичный auth gate и загрузка приватного приложения
  app.ts                    # Экраны и разметка
  main.ts                   # Инициализация и маршрутизация
  video-player.ts           # Логика собственного плеера
media/
  <video-id>/               # Локальные видео; содержимое не коммитится
```
