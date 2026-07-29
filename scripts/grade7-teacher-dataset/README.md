# Датасет химии 7–11 классов для обучения ИИ-учителя

Скрипт генерирует синтетические диалоги **учитель ↔ ученик** в формате JSONL (SFT) по справочникам `topics/grade{7–11}.json`.

## Структура

```
scripts/grade7-teacher-dataset/
├── topics/
│   ├── grade7.json          # ручной справочник 7 класса
│   ├── grade8.json … grade11.json   # из TOC учебника + обогащение
│   └── (пересборка: python build_topics_from_toc.py)
├── dataset/                 # gradeN_teacher_sft.jsonl + progress_gN.json
├── generate.py
├── build_topics_from_toc.py
├── requirements.txt
├── .env.example
└── README.md
```

## Установка

```bash
cd scripts/grade7-teacher-dataset
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
```

В `.env`:

```env
OPENAI_API_KEY=sk-...
# или
# OPENROUTER_API_KEY=sk-or-...
# DATASET_MODEL=openai/gpt-4o-mini
```

## Пересборка тем 8–11 из оглавления

```bash
python build_topics_from_toc.py
```

Берёт `src/data/g{8,9,10,11}BookToc.json`, группирует по главам, добавляет ключевые понятия/формулы/ошибки по шаблонам.

## Запуск

Один класс:

```bash
python generate.py --grade 8 --dialogs-per-subtopic 3
python generate.py --grade 11 --dialogs-per-subtopic 5 --concurrency 4
```

Все классы подряд:

```bash
python generate.py --grade all --dialogs-per-subtopic 2
```

OpenRouter:

```bash
python generate.py --provider openrouter --grade 10 --model openai/gpt-4o-mini
```

Smoke-тест:

```bash
python generate.py --grade 9 --limit 2 --dialogs-per-subtopic 1
```

Продолжить после обрыва:

```bash
python generate.py --grade 8 --resume --dialogs-per-subtopic 3
```

## Масштабирование

| Параметр | Смысл |
|----------|--------|
| `--grade 7\|8\|9\|10\|11\|all` | Какой класс генерировать |
| `--dialogs-per-subtopic N` | Диалогов на каждую подтему |
| `--concurrency K` | Параллельные запросы |
| `--temperature T` | Разнообразие (0.7–0.95) |
| `--topic ID` | Только одна тема |
| `--limit N` | Потолок заданий **на класс** |

Оценка объёма:

```
записей ≈ (подтемы класса) × dialogs_per_subtopic
```

Примерные подтемы (без «повторений»/практикумов):

| Класс | Подтем ≈ |
|-------|----------|
| 7 | 21 |
| 8 | 41 |
| 9 | 42 |
| 10 | 50 |
| 11 | 33 |

При `--dialogs-per-subtopic 5` и `--grade all` → порядка **900+** диалогов.

## Формат JSONL

`dataset/grade8_teacher_sft.jsonl` (и аналоги):

```json
{
  "id": "g8::c1-...::c1-s03-...::confused::1",
  "grade": 8,
  "topic": "Классы неорганических соединений",
  "subtopic": "Оксиды",
  "topic_id": "...",
  "subtopic_id": "...",
  "student_profile": "confused",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

Профили: `confused` / `curious` / `advanced`.  
Checkpoint: `dataset/progress_g{N}.json`.

## Темы по классам (кратко)

- **7** — предмет химии, смеси, атомы/молекулы, ПСХЭ, валентность, сохранение массы, типы реакций  
- **8** — классы веществ, периодичность, связь, неметаллы, расчёты  
- **9** — металлы, амфотерность, электролиз, растворы/анализ, кинетика/гидролиз  
- **10** — органика: теория, углеводороды, кислородсодержащие  
- **11** — атом/связь, моль/газы, электролиты, концентрации, скорость, равновесие, ОВР, электролиз  
