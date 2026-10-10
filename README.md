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
npm run dev:media
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

## Тестовое развёртывание на сервере

Нужны Docker Engine с Compose v2 и открытый TCP-порт приложения.

1. Скопируйте репозиторий на сервер и создайте конфигурацию:

   ```bash
   cp .env.example .env
   ```

2. Для доступа по IP измените в `.env`:

   ```dotenv
   APP_BIND_ADDRESS=0.0.0.0
   LOCAL_APP_PORT=8080
   ```

   Не открывайте порт всему интернету без настроенного firewall. Для доступа только через
   локальный reverse proxy оставьте `APP_BIND_ADDRESS=127.0.0.1`.

3. Загрузите видео отдельно — каталог `media/` намеренно не хранится в Git:

   ```text
   media/
     map-puppy-fitness-house/
       video.mp4
   ```

4. Запустите стек:

   ```bash
   docker compose up -d --build
   docker compose ps
   ```

5. Выполните smoke-тест:

   ```bash
   npm run test:smoke -- http://127.0.0.1:8080
   ```

После этого приложение доступно по адресу `http://SERVER_IP:8080`. Для входа и просмотра видео
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

Traefik получает сертификат Let's Encrypt, направляет `/media/` непосредственно в Nginx, а
остальные запросы — в приложение. Локальный gateway остаётся доступен на адресе из
`APP_BIND_ADDRESS` и может использоваться для диагностики.

## Изолированный тестовый контур

Тестовый Compose-проект не использует продовые контейнеры, сеть или Traefik. Наружу
публикуется только gateway на порту `8000`, а всё приложение защищено Basic Auth.

```bash
cp .env.test.example .env.test
mkdir -p .test-secrets
docker run --rm --entrypoint htpasswd httpd:2.4-alpine -nbB miniapp-test 'unique-test-password' \
  > .test-secrets/.htpasswd
docker compose --env-file .env.test -f docker-compose.test.yml up -d --build
```

Для серверного запуска задайте в `.env.test` отдельные пути:

```dotenv
TEST_DATA_PATH=/opt/miniapp-test/data
TEST_MEDIA_PATH=/opt/miniapp/app/media
TEST_HTPASSWD_PATH=/opt/miniapp-test/secrets/.htpasswd
```

Медиатека подключается к отдельному test-media контейнеру только для чтения. Webhook в
тестовом Compose-проекте всегда выключен. Basic Auth поверх HTTP не шифрует credentials,
поэтому используйте только случайный временный пароль, который нигде больше не применяется.

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
`BOT_COMMAND_RATE_LIMIT_MAX` и `RATE_LIMIT_WINDOW_SECONDS`.

Статическая оболочка остаётся публичной, чтобы показать экран входа. Каталог
`/data/videos.json` и файлы `/media/` доступны только с действующей HttpOnly-сессией. Для медиа
Nginx выполняет внутреннюю проверку сессии перед выдачей HLS, MP4, постеров и Range-ответов.
Изменяемый `data/videos.json` не входит в `public/` и production bundle; dev-сервер блокирует
закодированные и mixed-case варианты приватных маршрутов до обработки статических файлов.

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
infra/
  local-gateway-nginx.conf  # HTTP gateway для локального и тестового запуска
  media-nginx.conf          # Защищённая раздача MP4/HLS с поддержкой Range
  test-media-nginx.conf     # Media-конфиг тестового контура за общей Basic Auth
scripts/
  app-server.mjs            # Фронтенд, auth API, healthcheck и Telegram webhook
  auth-database.mjs         # SQLite: пользователи, приглашения и сессии
  http-utils.mjs            # HTTP parsing, cookies, Origin и security headers
  protected-routes.mjs      # Единая граница динамических и статических маршрутов
  rate-limit.mjs            # Ограничение частоты auth и bot-запросов
  server-config.mjs         # Проверка и нормализация серверной конфигурации
  static-server.mjs         # Безопасная раздача production frontend
  telegram-auth.mjs         # Проверка Telegram initData
  telegram-bot.mjs          # Админское и пользовательское меню бота
  prepare-video.mjs         # Подготовка HLS/MP4/poster через FFmpeg
  smoke-test.mjs            # Проверка развёрнутого стека
src/
  app.ts                    # Экраны и разметка
  main.ts                   # Инициализация и маршрутизация
  video-player.ts           # Логика собственного плеера
media/
  <video-id>/               # Локальные видео; содержимое не коммитится
```
