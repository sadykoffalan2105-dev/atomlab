# Деплой сайта на Netlify

Сайт: **https://atomlab-alan-sadykov.netlify.app**

## Почему сайт мог не обновляться

1. **Netlify не подключён к GitHub** — старая сборка остаётся «Published».
2. **Неверные настройки сборки** — нужны `npm run build`, папка `dist`, `VITE_BASE=/`.
3. **Кэш браузера** — после деплоя нажмите **Ctrl+Shift+R**.

В репозитории есть `netlify.toml` и workflow `.github/workflows/deploy-netlify.yml`.

## Вариант A — GitHub Actions (рекомендуется)

1. Netlify → **User settings** → **Applications** → создайте **Personal access token**.
2. Netlify → ваш сайт → **Site configuration** → **General** → скопируйте **Site ID**.
3. GitHub → репозиторий `atomlab` → **Settings** → **Secrets and variables** → **Actions**:
   - `NETLIFY_AUTH_TOKEN` — токен из шага 1
   - `NETLIFY_SITE_ID` — ID из шага 2
4. Сделайте `git push origin main` или в GitHub → **Actions** → **Deploy Netlify** → **Run workflow**.

## Вариант B — Netlify «Deploy from Git»

1. Netlify → **Add new site** → **Import an existing project** → GitHub → `atomlab`.
2. Branch: **main**
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Environment variable: `VITE_BASE` = `/`
6. **Save** → **Trigger deploy** → **Clear cache and deploy site**

## Вариант C — вручную с компьютера

```bash
npm install
npm run build
npx netlify-cli login
npx netlify-cli deploy --prod --dir=dist
```

## Как проверить, что версия новая

В §1 «Химия и её задачи» должно быть:

- слева — **Список класса** (не «Слайды 1/10»);
- по центру — **Каталог веществ** с кнопками **Обучение** / **Тест**;
- **нет** карточек «Задача 1–6» с заголовком «ХИМИЯ: НАУКА И ЕЁ ЗАДАЧИ».
