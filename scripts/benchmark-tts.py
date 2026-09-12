import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
script = ROOT / "teacher-tts-synth.py"

samples = [
    ("short", {"text": "Привет, это тест.", "locale": "ru", "prepared": True}),
    (
        "long",
        {
            "text": (
                "Из книги возьму историю, которая цепляет. Параграф 6. Практическое занятие. "
                "Очистка вещества от примесей. Суть темы: в природе редко встречают чистые вещества. "
                "Обычно смесь состоит из основного вещества и примесей. Фильтрация отделяет твёрдые частицы. "
                "Выпаривание убирает растворитель. Перегонка разделяет жидкости с разной температурой кипения."
            ),
            "locale": "ru",
            "prepared": True,
        },
    ),
]

for label, payload in samples:
    t0 = time.time()
    r = subprocess.run(
        ["python", str(script)],
        input=json.dumps(payload).encode("utf-8"),
        capture_output=True,
    )
    dt = time.time() - t0
    ok = r.returncode == 0
    b64 = 0
    if ok:
        b64 = len(json.loads(r.stdout).get("audioBase64", ""))
    print(f"{label}: {dt:.2f}s b64={b64} ok={ok}")
