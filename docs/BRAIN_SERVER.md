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
**Любая правка `deploy/brain-pc/**` — перед push:** `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\brain\deploy-check.ps1`
(разбор всех .ps1 парсером PowerShell 5.1 и BOM, `manifest.json`, `update.ps1 -DryRun` на временном корне — в том числе с поломками в шаге
картинок: мозг всё равно обновляется, — `install.ps1`/`uninstall.ps1 -DryRun`; ~3 мин, без админа, порт 8787 не трогает).
Сломанный `update.ps1` на ПК друга больше не обновится сам — удалённо его не починить. Новый необязательный шаг в
`update.ps1` (ComfyUI, STT) — только внутри `try { … } catch { Warn … }`: его сбой не должен останавливать git pull и
перезапуск мозга. Место для шага STT в `update.ps1` помечено «МЕСТО ДЛЯ ШАГА СБОРЩИКА ГОЛОСА».
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

## 7. Распознавание речи (/stt)

Голос ученика → текст на сервере: сайдкар `atomlab-stt` (Python, `brain/stt/sidecar/server.py`) только на
`127.0.0.1:8788`, мозг принимает `POST /stt` и пересылает проверенный WAV (контракт «Голос» v1).

- **Движки.** GigaAM-Multilingual CTC — ru/uz (large 600M fp16 на видеокарте; мало памяти → 220M; нет CUDA → CPU);
  faster-whisper large-v3-turbo — английский (финальная реплика переслушивается) и детекция языка. Язык текста
  определяет мозг (`detectLang` из `brain/pipeline/normalize.ts`), формулы и ослышки правит сайт (`fixTranscript`).
- **Видеопамять (RTX 5080, 16 ГБ).** Gemma 12B + bge-m3 ≈ 10–11 ГБ; GigaAM large fp16 ≈ 1,3–2 ГБ; whisper turbo fp16
  ≈ 1,6–2 ГБ — whisper на видеокарту, только если после GigaAM свободно ≥ 3,2 ГБ, иначе на CPU. Для картинок
  арбитр GPU может попросить `POST /gpu {"mode":"release"}` (модели на CPU) и `{"mode":"acquire"}` (обратно);
  клиент — `sttSidecarOf(brain).release()/acquire()` из `brain/stt/route.ts` (подключить в `brain/llm/gpuArbiter.ts`).
- **Установка.** `deploy/brain-pc/stt.ps1` (шаг 10b установщика; потом — автоматически): место ≥ 12 ГБ → Python 3.12
  в `C:\ATOMLAB\python` (подпись PSF, без PATH) → venv `C:\ATOMLAB\stt\venv` → torch cu128 + `stt-requirements.txt` →
  модели в `C:\ATOMLAB\stt\models` (sha256 по метаданным Hugging Face; недоступен — зеркало hf-mirror.com) → проверка
  CUDA → прогрев → задача «ATOMLAB STT» (`run-stt.ps1`, SYSTEM, при старте). Настройки — `stt-config.json`
  (`enabled:false` — выключить удалённо, через git). `stt.ps1 -DryRun` — только печать шагов.
- **Автообновление.** `update.ps1` вызывает `stt.ps1 -FromUpdate` (секунды, в `try/catch`: сбой — строка в
  `logs\update.log`, обновление мозга идёт дальше): изменились `stt-requirements.txt`/`stt-config.json` → запуск
  отдельной задачи «ATOMLAB STT Setup» (повтор неудачи — не чаще раза в 6 ч); изменился код сайдкара → флаг
  `run\restart-stt` (перезапуск, когда нет соединений с 8788); сайдкар молчит → запуск задачи «ATOMLAB STT».
- **Лимиты.** На сессию сайта (`session=` или заголовок `X-Brain-Session`): 30 финальных в минуту и 600 в сутки,
  partial — 60 в минуту отдельно, один запрос в полёте; на адрес — 300 финальных в минуту (школьный NAT). Тело ≤ 1 МиБ,
  аудио 0,3–25 с, WAV PCM16 16 кГц моно. Нет сайдкара → `503 stt_unavailable` с `Retry-After: 10` за миллисекунды.
- **Приватность.** Аудио только в памяти (ни файлов, ни журналов); в журналах — длительность, байты, язык, мс, код,
  никогда текст. Журнал диалогов не затрагивается: распознанный текст приходит обычным `/chat`.

| проверка | команда |
|---|---|
| без GPU и Python (фейковый сайдкар, 44 проверки) | `npm run brain:stt-selftest` |
| сайдкар на заглушке (разбор WAV, очередь, /gpu) | `npm run brain:stt-sidecar-test` |
| живой сервер (клипы `scripts/voice/clips/*.wav` или синтетика; p50/p95 при 4 клиентах) | `npx tsx scripts/brain/stt.selftest.mts --live=https://<узел>.ts.net` |
| руками | `curl -X POST --data-binary @clip.wav -H "Content-Type: audio/wav" "http://127.0.0.1:8787/stt?lang=ru&session=test"` |
| состояние | `curl http://127.0.0.1:8787/stt/health`, `curl http://127.0.0.1:8788/health`, `C:\ATOMLAB\logs\stt-*.log` |

## 8. Наблюдение

Три вещи: **монитор доступности** на ноутбуке владельца (узнать, что сервер молчит, раньше учеников), **ночной живой
прогон качества** на самом сервере (03:00) и **отчёт** в репозитории (`docs/plans/live-report.md`).

### Монитор доступности (ноутбук владельца)

`npm run brain:monitor` — `GET <адрес>/health` через Funnel (адрес — `public/brain.json` `urls[0]` или `--url=`):

| статус | значит | что видят ученики |
|---|---|---|
| `up` | мозг отвечает, модель в памяти | обычный ИИ-учитель |
| `degraded` | мозг отвечает, но LLM недоступна или идёт загрузка базы | ответы запасным путём (без модели) |
| `down` | нет ответа за 15 с, HTTP ≠ 200 или не JSON | сайт говорит «сервер недоступен» |

- Журнал — `.tmp\brain-monitor\log.jsonl` (строка на проверку), состояние — `.tmp\brain-monitor\state.json`
  (`--dir=` — другая папка). Смена статуса печатается; о сбое сообщается после **2 проверок подряд** (`--fail-after=`,
  дребезг Funnel/DNS), о восстановлении — сразу, с длительностью простоя; пока сервер лежит — напоминание раз в 6 ч
  (`--remind-hours=`, 0 — без напоминаний).
- **Telegram (по желанию).** Бот — у @BotFather (`/newbot` → токен). Написать боту любое сообщение, открыть
  `https://api.telegram.org/bot<токен>/getUpdates` и взять `chat.id`. Ключи — **только вне репозитория**, файл
  `%USERPROFILE%\atomlab-monitor.env`:
  ```
  ATOMLAB_TG_TOKEN=123456:ABC…
  ATOMLAB_TG_CHAT=123456789
  ```
  (или переменные среды пользователя с теми же именами). Токен не пишется ни в вывод, ни в журнал.
- Проверка руками (PowerShell): `npm run brain:monitor -- --once --env-file=$env:USERPROFILE\atomlab-monitor.env` (код 0 — `up`).
- **Сводка доступности** (24 ч / 7 / 30 дней, простои): `npm run brain:monitor -- --summary --md=docs/plans/brain-availability.md`
  — этот файл и есть журнал доступности в репозитории (обновлять и коммитить раз в неделю или после простоя).

**Каждые 5 минут — «Планировщик заданий» Windows.** PowerShell **от администратора** (S4U: без окна, без пароля,
работает и при заблокированном экране; путь к репозиторию поправить, если он другой):

```powershell
$repo = "$env:USERPROFILE\Desktop\химия"
$node = (Get-Command node.exe).Source
$act = New-ScheduledTaskAction -Execute $node -WorkingDirectory $repo -Argument ('--import tsx scripts\brain\monitor.mts --once --env-file="{0}\atomlab-monitor.env"' -f $env:USERPROFILE)
$trg = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$who = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U
$set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'ATOMLAB Monitor' -Action $act -Trigger $trg -Principal $who -Settings $set -Description 'ATOMLAB: /health сервера мозга каждые 5 мин'
```

Проверить: `Start-ScheduledTask 'ATOMLAB Monitor'`, через минуту — новая строка в `.tmp\brain-monitor\log.jsonl`.
Убрать: `Unregister-ScheduledTask 'ATOMLAB Monitor' -Confirm:$false`. Монитор работает, только пока включён ноутбук;
для круглосуточного взгляда со стороны можно добавить бесплатный внешний пинг (UptimeRobot / Healthchecks) на
`https://<узел>.ts.net/health` со словом `"ok":true`.

### Что делать, если сервер молчит

1. Открыть `https://<узел>.ts.net/health` в браузере. Ответил — это был дребезг сети (монитор сам пришлёт «работает»).
2. `degraded` (мозг отвечает, LLM нет): сторож **ATOMLAB Update** сам поднимает Ollama и мозг каждые 15 мин —
   подождать 15–20 мин. Не прошло — пункт 4.
3. `down` дольше 20 мин — написать другу: ПК включён и не спит? Есть интернет? Значок Tailscale «Connected»?
   Самое надёжное — **перезагрузить ПК**: Ollama, мозг, ComfyUI, STT и Funnel поднимаются задачами при старте сами
   (вход в Windows не нужен).
4. Если друг разрешил SSH (`ssh <пользователь>@atomlab-brain`): `schtasks /Query /TN "ATOMLAB Brain"`,
   `type C:\ATOMLAB\logs\update.log`, последние строки `C:\ATOMLAB\logs\brain-*.log`, `curl http://127.0.0.1:8787/health`;
   вручную: `schtasks /Run /TN "ATOMLAB Update"` (сторож + обновление).
5. Пока сервер лежит, сайт работает без ИИ-учителя, ничего не ломается и не теряется.

### Ночной живой прогон качества (на сервере, 03:00)

Задача **ATOMLAB Nightly** (`deploy/brain-pc/nightly-eval.ps1`, SYSTEM; ставится установщиком, на старых серверах её
один раз добавляет Update) → `scripts/brain/nightly-live.mts` против `http://127.0.0.1:8787` с ключом админа из
`secrets\admin-token.txt` (лимиты учеников его не касаются):

| часть | что | пороги (Fable, nextBuild #2) |
|---|---|---|
| диалоги | `brain:eval --sample=40 --cat=dialog-ru,dialog-uz,dialog-en,length,logic,calc` | общий ≥ 85 %, calc 100 %, первое слово p50 ≤ 2 с и p95 ≤ 8 с (без busy), R3 / CJK / wikiLeak = 0 |
| программа Kimyo | `brain:eval:curriculum --file=brain/eval/curriculum/sample-live.jsonl --no-report` | общий ≥ 85 %, calc 100 %, test и why ≥ 85 %, R3 / CJK / wikiLeak = 0 |
| картинки | `POST /admin/image/test` × 3 темы (картинки выключены — «пропущено») | все готовы, p50 ≤ 15 с, p95 ≤ 30 с, nsfw < 0,1 |
| речь | `voice:eval` по `scripts/voice/fixtures` на `/stt` (STT недоступно — «пропущено») | WER ru ≤ 12 %, uz ≤ 18 %, en ≤ 10 % |

- Итог — `C:\ATOMLAB\reports\live-ГГГГММДД.json` (хранится 60 дней), журнал — `C:\ATOMLAB\logs\nightly-eval.log`.
  Провал порога печатается красным, но **никогда** не останавливает обновление и работу мозга; любой сбой самого
  прогона — только предупреждение (код 0). Пороги меняются в `scripts/brain/liveReportLib.mts`.
- Если ПК в 03:00 был выключен — прогон пропускается до следующей ночи (днём видеокарта — ученикам).
- Вручную на сервере: `Start-ScheduledTask 'ATOMLAB Nightly'` или
  `powershell -NoProfile -ExecutionPolicy Bypass -File C:\ATOMLAB\bin\nightly-eval.ps1 [-Only eval,stt]`.
- Отчёт отдаёт мозг: `GET /admin/live-report` (последний), `?date=2026-10-12`, `?list=1` (даты и итоги) — только с
  заголовком `X-Brain-Admin`, только чтение.
- Вопросы ночного прогона идут обычным `/chat` — в журнале диалогов сервера в 03:00 будут эти контрольные вопросы.

**Отчёт в репозиторий (ноутбук владельца):**

```powershell
$env:BRAIN_ADMIN_TOKEN = '<ключ из C:\ATOMLAB\secrets\admin-token.txt>'
npm run brain:live-report                  # → docs/plans/live-report.md (+ live-report.json), затем commit
npm run brain:live-report -- --date=2026-10-12
npm run brain:live-report -- --file=live-20261012.json   # без сети: файл, скопированный с сервера
```

Проверка без живого сервера (пороги, `/admin/live-report`, ночной прогон на mock-LLM и STT-заглушке, монитор с
Telegram-заглушкой): `npm run brain:live-selftest`.
