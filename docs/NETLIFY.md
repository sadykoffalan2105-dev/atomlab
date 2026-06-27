# Деплой сайта

## Голос учителя (TTS) на GitHub Pages

Статический сайт **не может** синтезировать голос сам — нужен serverless-бэкенд или браузерный fallback.

### Как работает голос в браузере (после обновления)

При нажатии «Озвучить» клиент пробует **по порядку**:

1. **Edge Neural в браузере** — `ru-RU-DmitryNeural` (мужской Dmitry), без сервера
2. **Puter Polly Maxim** — мужской голос через `js.puter.com` (может показать popup входа Puter при первом разе)
3. **Serverless-бэкенд** — Netlify / Render / Vercel (`/api/learn/tts`)

Только если все три не сработали — системный робот Web Speech.

### Автодеплой TTS (Netlify CLI) — для serverless Dmitry

Без этого шага GitHub Pages полагается на браузерный Edge и Puter.

Workflow `.github/workflows/publish-site.yml` загружает функцию `netlify/functions/learn-tts` через Netlify CLI.

**Добавьте секреты** в GitHub → репозиторий **atomlab** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Секрет | Значение |
|--------|----------|
| `NETLIFY_AUTH_TOKEN` | [Netlify → User settings → Applications → Personal access tokens](https://app.netlify.com/user/applications#personal-access-tokens) → Generate |
| `NETLIFY_SITE_ID` | `86490664-0bd1-4761-a7fb-0bce1581eca3` |

### Запасной бэкенд (Vercel)

Workflow `.github/workflows/deploy-vercel-tts.yml` деплоит `api/learn/tts.ts` на Vercel.

Секреты GitHub Actions:

| Секрет | Значение |
|--------|----------|
| `VERCEL_TOKEN` | [Vercel → Account → Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | `vercel link` → `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `vercel link` → `.vercel/project.json` |
| `VERCEL_TTS_URL` | `https://<project>.vercel.app/api/learn/tts` (после первого деплоя) |

После деплоя добавьте `VERCEL_TTS_URL` — сборка GitHub Pages подставит его в `VITE_LEARN_TTS_URL`.

---

## Почему Netlify не обновлялся (найденная ошибка)

Сайт **https://atomlab-alan-sadykov.netlify.app** подключён к GitHub (`sadykoffalan2105-dev/atomlab`, ветка `main`), но **последняя успешная сборка — 6 июня 2026**.

Новые коммиты на GitHub **не попадали на сайт**, потому что Netlify отклоняет сборки:

> **Skipped due to account credit usage exceeded**

Исчерпан лимит минут сборки на бесплатном тарифе Netlify. Пока лимит не восстановится (или не будет апгрейд тарифа), автодеплой с GitHub **не работает**.

### Что делать с Netlify

1. [Netlify Dashboard](https://app.netlify.com/projects/atomlab-alan-sadykov) → **Billing** — проверить лимит.
2. Когда лимит восстановится: **Deploys** → **Trigger deploy** → **Clear cache and deploy site**.
3. Настройки сборки (уже в `netlify.toml`):
   - Build: `npm run build`
   - Publish: `dist`
   - `VITE_BASE` = `/`

---

## Рабочий деплой: GitHub Pages (рекомендуется)

**URL:** https://sadykoffalan2105-dev.github.io/atomlab/

### Один раз включить в GitHub

1. Репозиторий → **Settings** → **Pages**
2. **Build and deployment** → Source: **GitHub Actions**
3. Сохранить

### Автообновление

При каждом `git push` в `main` запускается workflow `.github/workflows/deploy-pages.yml`.

Проверка: **Actions** → **Deploy GitHub Pages** → зелёная галочка.

После деплоя откройте сайт с **Ctrl+Shift+R**.

### Как понять, что версия новая

В §1 «Химия и её задачи»:

- слева — **Список класса**
- по центру — **Каталог веществ**, вкладки **Обучение** / **Тест**
- **нет** карточек «Задача 1–6»

---

## GitHub Actions → Netlify (опционально)

Если снова появятся минуты Netlify, добавьте секреты в GitHub → **Settings** → **Secrets** → **Actions**:

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID` = `86490664-0bd1-4761-a7fb-0bce1581eca3`

Workflow: `.github/workflows/deploy-netlify.yml`
