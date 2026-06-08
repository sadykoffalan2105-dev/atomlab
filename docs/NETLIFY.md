# Деплой сайта

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
