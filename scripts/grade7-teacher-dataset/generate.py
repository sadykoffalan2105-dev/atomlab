#!/usr/bin/env python3
"""
Генерация синтетического SFT-датасета (учитель ↔ ученик) по химии 7–11 классов.

Примеры:
  python generate.py --grade 8 --dialogs-per-subtopic 3
  python generate.py --grade all --dialogs-per-subtopic 2 --concurrency 4
  python generate.py --provider openrouter --grade 10 --resume
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:  # optional
    def load_dotenv(*_a: Any, **_k: Any) -> bool:
        return False

try:
    from openai import AsyncOpenAI, APIError, APIStatusError, RateLimitError
except ImportError:
    print("Установите зависимости: pip install -r requirements.txt", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parent
TOPICS_DIR = ROOT / "topics"
DATASET_DIR = ROOT / "dataset"
GRADES = (7, 8, 9, 10, 11)

STUDENT_TURN_HINTS = {
    "confused": (
        "Ученик ошибается или путает понятия. В первой реплике user — типичная ошибка "
        "или неверное утверждение. Учитель мягко исправляет и ведёт по шагам."
    ),
    "curious": (
        "Ученик любопытный: спрашивает «почему», «а если», просит жизненный пример. "
        "Диалог может быть 2–3 хода user/assistant."
    ),
    "advanced": (
        "Ученик уже знает базу и просит связать закон с другим понятием или сравнить. "
        "Ответ глубже, но без вузовского жаргона — строго по программе класса."
    ),
}


@dataclass
class Job:
    grade: int
    topic_id: str
    topic_title: str
    subtopic_id: str
    subtopic_title: str
    profile_id: str
    index: int

    @property
    def key(self) -> str:
        return f"g{self.grade}::{self.topic_id}::{self.subtopic_id}::{self.profile_id}::{self.index}"


def topics_path(grade: int) -> Path:
    return TOPICS_DIR / f"grade{grade}.json"


def output_path(grade: int) -> Path:
    return DATASET_DIR / f"grade{grade}_teacher_sft.jsonl"


def checkpoint_path(grade: int) -> Path:
    return DATASET_DIR / f"progress_g{grade}.json"


def load_topics(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def build_jobs(catalog: dict[str, Any], dialogs_per_subtopic: int) -> list[Job]:
    grade = int(catalog.get("grade", 7))
    profiles = [p["id"] for p in catalog.get("student_profiles", [])] or [
        "confused",
        "curious",
        "advanced",
    ]
    jobs: list[Job] = []
    for topic in catalog["topics"]:
        for sub in topic["subtopics"]:
            for i in range(1, dialogs_per_subtopic + 1):
                profile = profiles[(i - 1) % len(profiles)]
                jobs.append(
                    Job(
                        grade=grade,
                        topic_id=topic["id"],
                        topic_title=topic["title"],
                        subtopic_id=sub["id"],
                        subtopic_title=sub["title"],
                        profile_id=profile,
                        index=i,
                    )
                )
    return jobs


def load_checkpoint(path: Path) -> set[str]:
    if not path.exists():
        return set()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return set(data.get("done_keys", []))
    except (json.JSONDecodeError, OSError):
        return set()


def save_checkpoint(path: Path, done: set[str], meta: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "done_keys": sorted(done),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **meta,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def find_subtopic(catalog: dict[str, Any], topic_id: str, subtopic_id: str) -> dict[str, Any]:
    for topic in catalog["topics"]:
        if topic["id"] != topic_id:
            continue
        for sub in topic["subtopics"]:
            if sub["id"] == subtopic_id:
                return sub
    raise KeyError(f"subtopic not found: {topic_id}/{subtopic_id}")


def profile_label(catalog: dict[str, Any], profile_id: str) -> str:
    for p in catalog.get("student_profiles", []):
        if p["id"] == profile_id:
            return p.get("label", profile_id)
    return profile_id


def build_generation_prompt(catalog: dict[str, Any], job: Job) -> list[dict[str, str]]:
    sub = find_subtopic(catalog, job.topic_id, job.subtopic_id)
    grade = job.grade
    persona = catalog.get(
        "system_teacher_persona",
        f"Ты учитель химии {grade} класса.",
    )
    label = profile_label(catalog, job.profile_id)
    hint = STUDENT_TURN_HINTS.get(job.profile_id, "")

    concepts = ", ".join(sub.get("key_concepts", []))
    formulas = ", ".join(sub.get("formulas", [])) or "—"
    facts = "\n".join(f"- {x}" for x in sub.get("facts", []))
    mistakes = "\n".join(f"- {x}" for x in sub.get("common_mistakes", []))

    user_brief = f"""Сгенерируй ОДИН учебный диалог для датасета SFT.

Класс: {grade}
Тема: {job.topic_title}
Подтема: {job.subtopic_title}
Профиль ученика: {label} ({job.profile_id})
Вариант №{job.index}

Ключевые понятия: {concepts}
Формулы / примеры: {formulas}

Факты (опирайся только на них + школьную программу {grade} класса):
{facts}

Типичные ошибки:
{mistakes}

Требования к профилю:
{hint}

Формат ответа — СТРОГО один JSON-объект без markdown-ограждений:
{{
  "topic": "{job.topic_title}",
  "subtopic": "{job.subtopic_title}",
  "student_profile": "{job.profile_id}",
  "messages": [
    {{"role": "system", "content": "..."}},
    {{"role": "user", "content": "..."}},
    {{"role": "assistant", "content": "..."}}
  ]
}}

Правила messages:
1) Первый элемент — role=system: краткая роль учителя {grade} класса + рамка темы (2–4 предложения).
2) Далее чередование user / assistant (минимум 1 пара, максимум 3 пары user→assistant).
3) В ответах assistant используй неявный Chain-of-Thought для ученика:
   - прямой ответ одной фразой;
   - затем «Разберём по шагам:» с нумерованными шагами 1) 2) 3);
   - короткий пример;
   - один вопрос на самопроверку.
4) Язык: русский. Уровень объяснения — {grade} класс. Без выдуманных дат и фактов вне списка.
5) Не пиши рассуждения вне JSON. Не используй LaTeX.
"""

    return [
        {
            "role": "system",
            "content": (
                f"{persona}\n\n"
                "Ты генерируешь синтетические диалоги для обучения ИИ-учителя. "
                "Выводи только валидный JSON."
            ),
        },
        {"role": "user", "content": user_brief},
    ]


def make_client(provider: str, api_key: str, base_url: str | None) -> AsyncOpenAI:
    if provider == "openrouter":
        return AsyncOpenAI(
            api_key=api_key,
            base_url=base_url or "https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "https://atomlab.local"),
                "X-Title": os.getenv("OPENROUTER_APP_NAME", "ATOMLAB Teacher Dataset"),
            },
        )
    return AsyncOpenAI(api_key=api_key, base_url=base_url or None)


def extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < 0 or end <= start:
        raise ValueError("JSON object not found in model output")
    return json.loads(text[start : end + 1])


def normalize_record(raw: dict[str, Any], job: Job) -> dict[str, Any]:
    messages = raw.get("messages")
    if not isinstance(messages, list) or len(messages) < 3:
        raise ValueError("messages must be a list with at least system+user+assistant")

    clean_msgs: list[dict[str, str]] = []
    for m in messages:
        role = str(m.get("role", "")).strip()
        content = str(m.get("content", "")).strip()
        if role not in {"system", "user", "assistant"}:
            raise ValueError(f"invalid role: {role}")
        if not content:
            raise ValueError("empty message content")
        clean_msgs.append({"role": role, "content": content})

    if clean_msgs[0]["role"] != "system":
        raise ValueError("first message must be system")

    return {
        "id": job.key,
        "grade": job.grade,
        "topic": raw.get("topic") or job.topic_title,
        "subtopic": raw.get("subtopic") or job.subtopic_title,
        "topic_id": job.topic_id,
        "subtopic_id": job.subtopic_id,
        "student_profile": job.profile_id,
        "messages": clean_msgs,
    }


async def call_model(
    client: AsyncOpenAI,
    model: str,
    messages: list[dict[str, str]],
    temperature: float,
    max_retries: int,
) -> str:
    delay = 1.5
    last_err: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or ""
            if not content.strip():
                raise ValueError("empty model content")
            return content
        except RateLimitError as e:
            last_err = e
            wait = delay * attempt + random.uniform(0, 0.8)
            print(f"[rate-limit] attempt {attempt}/{max_retries}, sleep {wait:.1f}s", flush=True)
            await asyncio.sleep(wait)
        except APIStatusError as e:
            last_err = e
            if e.status_code in {408, 409, 425, 429, 500, 502, 503, 504}:
                wait = delay * attempt + random.uniform(0, 0.8)
                print(f"[api {e.status_code}] attempt {attempt}/{max_retries}, sleep {wait:.1f}s", flush=True)
                await asyncio.sleep(wait)
                continue
            raise
        except APIError as e:
            last_err = e
            wait = delay * attempt
            print(f"[api-error] {e}; attempt {attempt}/{max_retries}, sleep {wait:.1f}s", flush=True)
            await asyncio.sleep(wait)
        except Exception as e:
            last_err = e
            wait = delay * attempt
            print(f"[error] {e}; attempt {attempt}/{max_retries}, sleep {wait:.1f}s", flush=True)
            await asyncio.sleep(wait)
    raise RuntimeError(f"failed after {max_retries} retries: {last_err}")


async def generate_one(
    client: AsyncOpenAI,
    catalog: dict[str, Any],
    job: Job,
    model: str,
    temperature: float,
    max_retries: int,
    sem: asyncio.Semaphore,
) -> dict[str, Any]:
    async with sem:
        prompt = build_generation_prompt(catalog, job)
        raw_text = await call_model(client, model, prompt, temperature, max_retries)
        raw = extract_json_object(raw_text)
        return normalize_record(raw, job)


async def run_grade(args: argparse.Namespace, grade: int, client: AsyncOpenAI) -> tuple[int, int]:
    path = Path(args.topics) if args.topics else topics_path(grade)
    if not path.exists():
        print(f"[skip] нет файла тем: {path}", file=sys.stderr)
        return 0, 0

    catalog = load_topics(path)
    if int(catalog.get("grade", grade)) != grade and not args.topics:
        print(f"[warn] в {path} grade={catalog.get('grade')}, ожидался {grade}", flush=True)

    jobs = build_jobs(catalog, args.dialogs_per_subtopic)
    # ensure grade on jobs matches requested
    jobs = [
        Job(grade, j.topic_id, j.topic_title, j.subtopic_id, j.subtopic_title, j.profile_id, j.index)
        for j in jobs
    ]
    if args.topic:
        jobs = [j for j in jobs if j.topic_id == args.topic]
    if args.limit:
        jobs = jobs[: args.limit]

    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    out = Path(args.output) if args.output else output_path(grade)
    ckpt = checkpoint_path(grade)
    done = load_checkpoint(ckpt) if args.resume else set()
    if not args.resume and out.exists() and not args.append:
        out.unlink()

    pending = [j for j in jobs if j.key not in done]
    print(
        f"[g{grade}] заданий: {len(jobs)} | готово: {len(jobs) - len(pending)} | генерация: {len(pending)} -> {out.name}",
        flush=True,
    )
    if not pending:
        return 0, 0

    sem = asyncio.Semaphore(args.concurrency)
    lock = asyncio.Lock()
    ok = 0
    fail = 0

    async def worker(job: Job) -> None:
        nonlocal ok, fail
        try:
            record = await generate_one(
                client,
                catalog,
                job,
                args.model,
                args.temperature,
                args.max_retries,
                sem,
            )
            line = json.dumps(record, ensure_ascii=False)
            async with lock:
                with out.open("a", encoding="utf-8") as f:
                    f.write(line + "\n")
                done.add(job.key)
                save_checkpoint(
                    ckpt,
                    done,
                    {
                        "grade": grade,
                        "output": str(out),
                        "provider": args.provider,
                        "model": args.model,
                        "dialogs_per_subtopic": args.dialogs_per_subtopic,
                    },
                )
                ok += 1
                print(f"[ok] {job.key}", flush=True)
        except Exception as e:
            fail += 1
            print(f"[fail] {job.key}: {e}", flush=True)

    batch_size = max(args.concurrency * 2, 4)
    for i in range(0, len(pending), batch_size):
        batch = pending[i : i + batch_size]
        await asyncio.gather(*(worker(j) for j in batch))

    print(f"[g{grade}] success={ok} fail={fail} -> {out}", flush=True)
    return ok, fail


async def run(args: argparse.Namespace) -> int:
    load_dotenv(ROOT / ".env")
    load_dotenv()

    provider = args.provider
    api_key = args.api_key or os.getenv("OPENROUTER_API_KEY" if provider == "openrouter" else "OPENAI_API_KEY")
    if not api_key:
        env_name = "OPENROUTER_API_KEY" if provider == "openrouter" else "OPENAI_API_KEY"
        print(f"Нет API-ключа. Задайте {env_name} в .env или --api-key.", file=sys.stderr)
        return 2

    if args.grade == "all":
        grades = list(GRADES)
    else:
        grades = [int(args.grade)]

    client = make_client(provider, api_key, args.base_url)
    total_ok = 0
    total_fail = 0
    for g in grades:
        ok, fail = await run_grade(args, g, client)
        total_ok += ok
        total_fail += fail

    print(f"Итого success={total_ok} fail={total_fail}")
    return 0 if total_fail == 0 else 1


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate chemistry teacher SFT dataset (JSONL) for grades 7-11")
    p.add_argument(
        "--grade",
        default="7",
        help="Класс: 7, 8, 9, 10, 11 или all",
    )
    p.add_argument("--topics", default=None, help="Явный путь к topics/gradeN.json (иначе по --grade)")
    p.add_argument("--output", default=None, help="Явный путь .jsonl (иначе dataset/gradeN_teacher_sft.jsonl)")
    p.add_argument(
        "--dialogs-per-subtopic",
        type=int,
        default=3,
        help="Сколько диалогов на каждую подтему (профили чередуются)",
    )
    p.add_argument("--provider", choices=("openai", "openrouter"), default="openai")
    p.add_argument(
        "--model",
        default=os.getenv("DATASET_MODEL", "gpt-4o-mini"),
        help="Имя модели (для OpenRouter: openai/gpt-4o-mini и т.п.)",
    )
    p.add_argument("--base-url", default=None, help="Кастомный base URL API")
    p.add_argument("--api-key", default=None)
    p.add_argument("--concurrency", type=int, default=3)
    p.add_argument("--temperature", type=float, default=0.85)
    p.add_argument("--max-retries", type=int, default=5)
    p.add_argument("--resume", action="store_true", help="Продолжить с progress_gN.json")
    p.add_argument("--append", action="store_true", help="Не удалять output при старте без --resume")
    p.add_argument("--topic", default=None, help="Фильтр: только topic id")
    p.add_argument("--limit", type=int, default=None, help="Ограничить число заданий на класс (smoke-тест)")
    return p.parse_args(argv)


def main() -> None:
    args = parse_args()
    if args.grade != "all":
        try:
            g = int(args.grade)
        except ValueError:
            print("--grade должен быть 7..11 или all", file=sys.stderr)
            sys.exit(2)
        if g not in GRADES:
            print("--grade должен быть 7..11 или all", file=sys.stderr)
            sys.exit(2)
    try:
        code = asyncio.run(run(args))
    except KeyboardInterrupt:
        print("\nОстановлено. Прогресс сохранён в dataset/progress_gN.json", file=sys.stderr)
        code = 130
    sys.exit(code)


if __name__ == "__main__":
    main()
