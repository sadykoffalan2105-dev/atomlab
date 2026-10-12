# Сервер мозга ИИ-учителя на ПК друга (RTX 5080) — инструкция владельца

Мозг (`brain/`) переезжает с ноутбука на ПК с видеокартой и становится доступен из интернета **без покупки домена**:
публичный адрес даёт **Tailscale Funnel** (бесплатно), вида `https://atomlab-brain.<ваш-tailnet>.ts.net`.
Funnel принимает HTTPS на 443 и проксирует на `127.0.0.1:8787` на ПК друга; SSE идёт потоком (прокси Tailscale
сбрасывает `text/event-stream` сразу, плюс мозг шлёт «сердцебиение» каждые 5 с). Самопроверка установщика это меряет:
«через интернет: первое слово N мс, кусков K».

## 1. Один раз: аккаунт Tailscale (5 минут)

1. https://login.tailscale.com/start → **Sign in with GitHub** (тот же GitHub, что у репозитория). Создастся tailnet.
2. **DNS** (https://login.tailscale.com/admin/dns): включить **MagicDNS** и ниже **HTTPS Certificates → Enable**.
3. **Funnel в политике**: Access controls (https://login.tailscale.com/admin/acls) — в политике по умолчанию Funnel
   выключен. Добавить в JSON (или кнопка «Add Funnel to policy»):
   ```json
   "nodeAttrs": [{ "target": ["autogroup:member"], "attr": ["funnel"] }]
   ```
   Если забыть — не страшно: установщик покажет другу ссылку `login.tailscale.com/…`, вы её открываете и жмёте Enable.
4. **Ключ**: Settings → Keys (https://login.tailscale.com/admin/settings/keys) → **Generate auth key**:
   Reusable — выкл., **Ephemeral — выкл.** (иначе узел исчезнет при выключении ПК), Pre-approved — вкл. (если включено
   одобрение устройств), Expiration — 7–30 дней (ключ нужен только на время установки). Без тегов (Funnel по умолчанию
   разрешён участникам, а не тегам).

## 2. Архив для друга

```powershell
cd C:\Users\Первый\Desktop\химия
npm run brain:package          # → dist-brain\ATOMLAB-brain.zip (код установщика + снимок базы знаний)
```

Снимок берётся из `atomlab-brain-data` **только для чтения**: `journal/kb-journal.jsonl` (без записей `dialog`/`feedback`
и их `dup`), `derived/bm25-journal.json`, `derived/embeddings/bge-m3/*` (векторы — только для оставшихся записей).
Не попадают: `journal/dialogs.jsonl`, `students/`, `logs/`, `start-brain.ps1`, `config.json`. Недостающие векторы
установщик досчитает на видеокарте (`scripts/brain/embed.mts`, минуты).

Ключ: положить в `ключ.txt` внутри архива (`npm run brain:package -- --key=tskey-…`) **или** отправить другу
отдельным сообщением (надёжнее: архив без ключа можно хранить где угодно).

## 3. У друга

Распаковать → `УСТАНОВИТЬ.bat` (подробно — `deploy/brain-pc/ИНСТРУКЦИЯ.txt`). Установщик (`install.ps1`):
проверки (x64, админ, ≥ 60 ГБ, `nvidia-smi`: драйвер ≥ 572.16 для RTX 50) → Git, Node LTS, Tailscale (winget; запасной
путь — официальные загрузки с проверкой подписи Authenticode) → Ollama (архив с GitHub в `C:\ATOMLAB\ollama`, SHA-256 +
подпись «Ollama Inc.»; без значка в трее) → клон репозитория (мелкий, частичный: `brain src scripts/brain deploy`) →
tsx (≈ 11 МБ вместо 1,1 ГБ полного `npm ci`; если мозгу понадобится пакет — сам переключится на `npm ci --ignore-scripts`)
→ снимок базы в `C:\ATOMLAB\atomlab-brain-data` (существующий журнал не трогается) → `config.json` (профиль gpu, модели
из `deploy/brain-pc/server-config.json`, `adminToken` в `C:\ATOMLAB\secrets\admin-token.txt`) → `ollama pull` →
векторы → **картинки** (ComfyUI + модель + классификатор, ~14 ГБ, раздел 6; сбой — только предупреждение) → задачи
планировщика (SYSTEM, при старте, с перезапуском) → питание (без сна от сети) → `tailscale up` +
`tailscale funnel --bg 8787` → SSH (только после вопроса, только из сети Tailscale) → самопроверка: `/health` локально
и через Funnel, 20 живых вопросов, GPU, p50/p95 первого слова, проверочная картинка → `отчёт.txt` на рабочем столе и крупный адрес.

## 4. Подключить сайт

Адрес из отчёта (`https://atomlab-brain.<tailnet>.ts.net`) → в `public/brain.json` сайта (поле адреса мозга) → push.
CORS мозга уже пускает `https://sadykoffalan2105-dev.github.io`.

После появления узла в https://login.tailscale.com/admin/machines: «…» → **Disable key expiry** у `atomlab-brain`
(иначе через 180 дней узел попросит вход заново и адрес перестанет отвечать).

## 5. Обслуживание

| что | как |
|---|---|
| обновить код мозга | просто push в `main`: задача **ATOMLAB Update** каждые 15 мин делает `git fetch`, при новых коммитах — код до `origin/main`, зависимости (если менялся `package-lock.json`), перезапуск мозга **когда нет открытых соединений** (≤ 10 мин ожидания; через 4 попытки — всё равно) |
| сменить модели | правка `deploy/brain-pc/server-config.json` → push: Update сам сделает `ollama pull` и перепишет модели в `config.json` |
| логи | `C:\ATOMLAB\logs` (brain-*.log, ollama-*.log, comfy-*.log, run-comfy.log, image-install.log, update.log, install-*.log); старше 14 дней удаляются |
| состояние | `C:\ATOMLAB\state.json` (модели, режим зависимостей, Funnel, ожидающий перезапуск, `imageKey`, `comfyTag`, `verified`) |
| сторож | Update заодно поднимает упавшие Ollama/мозг/ComfyUI и снова включает Funnel |
| удалённо | если друг разрешил SSH: `ssh <пользователь>@atomlab-brain` из своей сети Tailscale |
| удалить | `УДАЛИТЬ.bat` (задачи, Funnel, logout; модели Ollama, ComfyUI с моделями и `C:\ATOMLAB` — каждое после отдельного «да») |

Проверка установщика без установки: `powershell -ExecutionPolicy Bypass -File deploy\brain-pc\install.ps1 -DryRun`.
Проверка кода и данных на любом ПК (без админа, в свою папку и на свой порт):
`install.ps1 -Only code-data -Root $env:TEMP\atomlab-install-test -RepoSource <путь к репо> -Branch <ветка> -BrainPort 8792 -ChatModel qwen2.5:3b-instruct`.

## 6. Картинки

Учитель (и владелец) просит картинку — мозг рисует её на той же видеокарте через **ComfyUI** (`127.0.0.1:8188`, наружу
не открыт) и отдаёт только после проверки классификатором. Формулы и подписи модель не рисует: их накладывает сайт.
Файлы установщика — `deploy/brain-pc/comfy/` (схема и ручные проверки — `deploy/brain-pc/comfy/README.md`).

**Включить / выключить.** `deploy/brain-pc/server-config.json` → `"image": { "enabled": true | false }` → push. Update
за ≤ 15 мин перепишет `config.json` мозга и перезапустит его; при `false` задача ATOMLAB Comfy сама останавливает ComfyUI
(видеопамять целиком у Gemma), модели остаются на диске.

**Сменить движок / вариант** — одна строка и push:

| `engine` / `variant` | файлы | видеопамять в окне | заметки |
|---|---|---|---|
| `z-image-turbo` / `int8` (по умолчанию) | 6,2 + 5,6 + 0,3 ГБ | ~10,5 ГБ | 8 шагов, лучший баланс |
| `z-image-turbo` / `bf16` | 12,3 + 8,0 + 0,3 ГБ | ~13 ГБ | качество выше, медленнее, 20 ГБ на диске |
| `z-image-turbo` / `nvfp4` | 4,5 + 3,5 + 0,3 ГБ | ~8 ГБ | нужен свежий comfy-kitchen (Blackwell), опционально |
| `flux2-klein-4b` / `fp8` | 4,1 + 8,0 + 0,3 ГБ | ~10 ГБ | 4 шага, быстрее, мельче детали |

Update сам скачает недостающее (curl с докачкой, сверка SHA-256 из `comfy/manifest.json`; ≤ 45 мин за запуск, дальше —
в следующий), перезапустит ComfyUI, **когда его очередь пуста**, перепишет `config.json` и перезапустит мозг по обычным
правилам. Прежние файлы остаются на диске (откат — вернуть строку). Новый выпуск ComfyUI или новые файлы — правка
`comfy/manifest.json` (URL, размер, SHA-256) и `version + 1`.

**Ученики.** По умолчанию рисовать могут только владелец (заголовок `X-Brain-Admin`) и учитель (ключ учителя);
`"students": true` — **только по решению владельца** (закон РУз ЗРУ-444 о защите детей от вредной информации): ученики
получают лишь готовые темы своего класса ±1, порог классификатора строже.

**Ключи учителя** — `C:\ATOMLAB\secrets\teacher-tokens.txt` (по ключу на строку; права как у `admin-token.txt`).
Сколько держать — `"teacherKeys"`; недостающие догенерирует Update/установщик. Ключ отдаётся учителю, на сайте он
вводится один раз (в браузере хранится как `atomlab.brain.teacherKey`). Отозвать ключ (по SSH на сервере): удалить его
строку из файла, затем `powershell -ExecutionPolicy Bypass -File C:\ATOMLAB\bin\write-brain-config.ps1` (недостающий
ключ допишется новым) и `Set-Content C:\ATOMLAB\run\restart-brain 1` (мозг перечитает `config.json`).

**Владелец и учитель: как рисовать на сайте.**
1. Ключ: владелец — `C:\ATOMLAB\secrets\admin-token.txt`, учитель — одна строка из
   `C:\ATOMLAB\secrets\teacher-tokens.txt` (владелец пересылает учителю лично, не в общий чат). Прочитать по SSH:
   `ssh <пользователь>@atomlab-brain "type C:\ATOMLAB\secrets\teacher-tokens.txt"`.
2. Пока ученикам рисовать нельзя (`students: false`), кнопки «Нарисовать» у них нет. Чтобы ввести ключ, откройте
   чат ИИ-учителя с `?draw=key` в адресе: **https://sadykoffalan2105-dev.github.io/atomlab/#/learn/talk?draw=key**
   (`?draw=key` работает на любой странице с кнопкой «Нарисовать» — чат, лаборатория). Появится кнопка «Нарисовать» →
   вкладка «Свой запрос» → поле «Ключ учителя» → «Сохранить ключ»; для ключа владельца — ещё галочка «Это ключ
   владельца сервера». Сам ключ в адрес не пишется.
3. Ключ хранится только в этом браузере (`localStorage`: `atomlab.brain.teacherKey` / `atomlab.brain.adminKey`) — после
   этого кнопка «Нарисовать» видна на всех страницах без `?draw=key`. Чужой компьютер — «Забыть ключ» в том же окне.
4. Владелец (ключ `X-Brain-Admin`) и учитель рисуют и готовые темы, и свой запрос (он проходит фильтры и классификатор
   так же, как у всех); ученики — только готовые темы своего класса и только при `students: true`.
5. Кнопка видна, но неактивна — мозг ещё готовит ComfyUI (`/health` → `image.ready: false`; после первой установки —
   до 1–2 запусков Update, см. `C:\ATOMLAB\logs\update.log` и `image-install.log`).

**Проверить:**
```powershell
# с ПК владельца, через Funnel (токен — C:\ATOMLAB\secrets\admin-token.txt на сервере):
curl.exe -s -X POST https://atomlab-brain.<tailnet>.ts.net/admin/image/test -H "X-Brain-Admin: <токен>" -H "Content-Type: application/json" -d "{}" -o test.json
curl.exe -s https://atomlab-brain.<tailnet>.ts.net/health      # image.enabled / image.ready / image.queue
curl.exe -s https://atomlab-brain.<tailnet>.ts.net/admin/image/verify -H "X-Brain-Admin: <токен>"   # граф ↔ узлы живого ComfyUI
# на сервере (по SSH) — всё сразу: задачи, state.json, логи, ComfyUI, узел безопасности, /health, проверочная картинка:
powershell -NoProfile -ExecutionPolicy Bypass -File C:\ATOMLAB\bin\comfy\image-check.ps1 -Twice
```

**Место и видеопамять.** Диск: ComfyUI ~7 ГБ после распаковки (+2 ГБ архив, удаляется), модели варианта 8–20 ГБ,
классификатор 0,3 ГБ → установщик требует ≥ 60 ГБ свободных. Видеопамять 16 ГБ: Gemma 4 12b с кешем на 4 ученика
занимает ~10,5–11,5 ГБ, bge-m3 ~1,2 ГБ, Windows ~0,7 ГБ — модели картинок рядом не помещаются, поэтому мозг
**переключает видеокарту** (ниже). ComfyUI запускается с `--reserve-vram 1.5` (`reserveVramGB`). Готовые PNG мозг
забирает из `C:\ATOMLAB\comfy-out` сразу, но **не удаляет**: файлы старше часа (и в `comfy-tmp`) раз в 10 мин чистит задача
ATOMLAB Comfy, запасная уборка — в Update; журналы `comfy-*.log` старше 14 дней удаляет Update.

**Как делится видеокарта.** Запрос картинки встаёт в очередь; мозг ставит очередь текста на паузу (ученики видят «в
очереди», никто не получает «занят»), дожидается конца уже идущих ответов, выгружает Gemma (`keep_alive: 0`; bge-m3
остаётся — поиск работает), рисует 1–2 картинки окном ≤ 30 с, проверяет каждую узлом ATOMLABSafetyCheck, освобождает
память ComfyUI (`/free`), заново грузит Gemma и снимает паузу. Текст всегда в приоритете, но картинки не ждут дольше
60 с; между окнами при текстовой нагрузке — пауза.

Типичные времена на RTX 5080 (план; живые замеры — `image-check.ps1`, `npm run brain:image-live`): первая картинка окна
10–16 с (из них рисование 3–5 с), вторая в том же окне +4–6 с, p95 ≤ 30 с; задержка текста в худшем случае ~45 с.
Первый старт ComfyUI под SYSTEM собирает кеши CUDA (до 1–2 мин).
