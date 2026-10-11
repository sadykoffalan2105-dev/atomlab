# Картинки на сервере мозга: ComfyUI + модель + узел безопасности

Всё ставится и обновляется само (задачи планировщика от SYSTEM), друг ничего не делает. Владелец меняет одну строку в
`deploy/brain-pc/server-config.json` (блок `image`) и пушит в `main` — **ATOMLAB Update** за 1–2 запуска докачает недостающее,
перезапустит ComfyUI, когда тот свободен, и обновит `config.json` мозга.

## Файлы

| файл | что делает |
|---|---|
| `manifest.json` | что качать: ComfyUI portable (тег, URL, размер, SHA-256), `7zr.exe` (запасная распаковка), файлы моделей (`files`), движки и варианты (`engines.*.variants.*` → роли `unet`/`clip`/`vae`), классификатор (`safety`). Ссылки HF закреплены на коммит; хеши — из HF API (`lfs.oid`) и GitHub API (`digest`). Новое — правка здесь и `version + 1`. |
| `image-install.ps1` | идемпотентная установка: место на диске → ComfyUI (curl с докачкой → SHA-256 → `tar.exe`, запасной путь `7zr.exe`) → модели движка/варианта из `server-config.json` → классификатор → узел → `extra_model_paths.yaml`, `run\comfy-args.txt`. Уже проверенные файлы не перехешируются (`state.json → verified`: размер, время, SHA-256). Коды: 0 готово, 2 мало места, 3 «докачаю в следующий раз» (Update даёт ≤ 50 мин за запуск), 1 ошибка. |
| `run-comfy.ps1` | задача **ATOMLAB Comfy** (при старте системы, SYSTEM): держит ComfyUI на `127.0.0.1:8188`, перезапуск по `run\restart-comfy`, пауза при `run\comfy-hold` (замена папки при новом выпуске), стоп при `image.enabled = false`; раз в 10 мин чистит `comfy-out`/`comfy-tmp` от файлов старше часа. |
| `custom_nodes/atomlab_safety/__init__.py` | наш узел **ATOMLABSafetyCheck**: Falconsai NSFW ViT по готовой картинке, результат в `/history … outputs[<id>].atomlab_safety = [{index, nsfw, normal, model, ms}]`. Ошибки не глотаются — без результата мозг картинку не отдаёт (ЗРУ-444). |
| `image-check.ps1` | живая проверка на сервере (ничего не качает): задачи, `state.json`, логи, `/system_stats`, `/object_info/ATOMLABSafetyCheck`, узел на пустой картинке, `/health` мозга, `POST /admin/image/test`. |

## Раскладка на сервере (все пути ASCII)

```
C:\ATOMLAB\comfy\ComfyUI_windows_portable\   python_embeded\, ComfyUI\ (+ custom_nodes\atomlab_safety\), atomlab-tag.txt
C:\ATOMLAB\comfy\models\                      diffusion_models\, text_encoders\, vae\, atomlab_safety\falconsai_nsfw\
C:\ATOMLAB\comfy\extra_model_paths.yaml       ComfyUI видит модели из comfy\models (обновление ComfyUI их не трогает)
C:\ATOMLAB\comfy-out, C:\ATOMLAB\comfy-tmp    вывод и temp ComfyUI (мозг забирает картинку сразу, остатки — через час)
C:\ATOMLAB\logs\comfy-<дата>.log, run-comfy.log, image-install.log
C:\ATOMLAB\run\comfy.pid, comfy-args.txt, restart-comfy, comfy-hold
```

Отступление от первоначальной спецификации: модели лежат не в `ComfyUI\models\…`, а рядом, в `comfy\models` (через
`extra_model_paths.yaml`, `is_default: true`) — так новый выпуск ComfyUI ставится заменой папки, без переноса 12 ГБ.
Узел берёт путь к классификатору из `ATOMLAB_SAFETY_DIR` (ставит `run-comfy.ps1`), без неё — `ComfyUI/models/atomlab_safety/falconsai_nsfw`.

## Проверить руками (на сервере)

```powershell
# узел импортируется (folder_paths — из ComfyUI):
cd C:\ATOMLAB\comfy\ComfyUI_windows_portable\ComfyUI
..\python_embeded\python.exe -s -c "import sys, importlib.util; sys.path.insert(0, '.'); import folder_paths; s = importlib.util.spec_from_file_location('a', 'custom_nodes/atomlab_safety/__init__.py'); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); print(list(m.NODE_CLASS_MAPPINGS))"

# классификатор на чёрной картинке (ждём nsfw близко к 0):
$env:ATOMLAB_SAFETY_DIR = 'C:\ATOMLAB\comfy\models\atomlab_safety\falconsai_nsfw'
..\python_embeded\python.exe -s -c "import sys, importlib.util, torch; sys.path.insert(0, '.'); import folder_paths; s = importlib.util.spec_from_file_location('a', 'custom_nodes/atomlab_safety/__init__.py'); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); print(m.ATOMLABSafetyCheck().check(torch.zeros(1, 512, 512, 3)))"

# ComfyUI жив и узел загружен:
curl.exe -s http://127.0.0.1:8188/system_stats
curl.exe -s http://127.0.0.1:8188/object_info/ATOMLABSafetyCheck

# всё сразу:
powershell -NoProfile -ExecutionPolicy Bypass -File C:\ATOMLAB\bin\comfy\image-check.ps1
```

## Проверить без сервера (на любом ПК, ничего не качает)

```powershell
powershell -ExecutionPolicy Bypass -File deploy\brain-pc\comfy\image-install.ps1 -CheckManifest
powershell -ExecutionPolicy Bypass -File deploy\brain-pc\comfy\image-install.ps1 -DryRun -Root $env:TEMP\atomlab-dry
powershell -ExecutionPolicy Bypass -File deploy\brain-pc\comfy\image-install.ps1 -DryRun -Root $env:TEMP\atomlab-dry -Engine flux2-klein-4b -Variant fp8
python -m py_compile deploy\brain-pc\comfy\custom_nodes\atomlab_safety\__init__.py
```
