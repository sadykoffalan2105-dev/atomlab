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
проверки (x64, админ, ≥ 30 ГБ, `nvidia-smi`: драйвер ≥ 572.16 для RTX 50) → Git, Node LTS, Tailscale (winget; запасной
путь — официальные загрузки с проверкой подписи Authenticode) → Ollama (архив с GitHub в `C:\ATOMLAB\ollama`, SHA-256 +
подпись «Ollama Inc.»; без значка в трее) → клон репозитория (мелкий, частичный: `brain src scripts/brain deploy`) →
tsx (≈ 11 МБ вместо 1,1 ГБ полного `npm ci`; если мозгу понадобится пакет — сам переключится на `npm ci --ignore-scripts`)
→ снимок базы в `C:\ATOMLAB\atomlab-brain-data` (существующий журнал не трогается) → `config.json` (профиль gpu, модели
из `deploy/brain-pc/server-config.json`, `adminToken` в `C:\ATOMLAB\secrets\admin-token.txt`) → `ollama pull` →
векторы → задачи планировщика (SYSTEM, при старте, с перезапуском) → питание (без сна от сети) → `tailscale up` +
`tailscale funnel --bg 8787` → SSH (только после вопроса, только из сети Tailscale) → самопроверка: `/health` локально
и через Funnel, 20 живых вопросов, GPU, p50/p95 первого слова → `отчёт.txt` на рабочем столе и крупный адрес.

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
| логи | `C:\ATOMLAB\logs` (brain-*.log, ollama-*.log, update.log, install-*.log); старше 14 дней удаляются |
| состояние | `C:\ATOMLAB\state.json` (модели, режим зависимостей, Funnel, ожидающий перезапуск) |
| сторож | Update заодно поднимает упавшие Ollama/мозг и снова включает Funnel |
| удалённо | если друг разрешил SSH: `ssh <пользователь>@atomlab-brain` из своей сети Tailscale |
| удалить | `УДАЛИТЬ.bat` (задачи, Funnel, logout; модели и `C:\ATOMLAB` — после отдельного «да») |

Проверка установщика без установки: `powershell -ExecutionPolicy Bypass -File deploy\brain-pc\install.ps1 -DryRun`.
Проверка кода и данных на любом ПК (без админа, в свою папку и на свой порт):
`install.ps1 -Only code-data -Root $env:TEMP\atomlab-install-test -RepoSource <путь к репо> -Branch <ветка> -BrainPort 8792 -ChatModel qwen2.5:3b-instruct`.

## 6. Распознавание речи (/stt)

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
