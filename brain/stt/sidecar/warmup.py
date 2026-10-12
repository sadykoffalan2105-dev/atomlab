"""
Прогрев и проверка движков после установки (deploy/brain-pc/stt.ps1): загрузить модели как сайдкар,
распознать 2-секундный синтетический сигнал из памяти, напечатать JSON {ok, cuda, engines, inferMs}. Текст не печатается.
  python -I warmup.py   (env STT_MODELS_DIR, STT_DEVICE, STT_WHISPER — как у server.py)
"""
from __future__ import annotations

import json
import os
import sys
import time

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402

import engines as eng  # noqa: E402


def main() -> int:
    models = os.environ.get("STT_MODELS_DIR", "")
    device = os.environ.get("STT_DEVICE", "auto").lower()
    whisper_on = os.environ.get("STT_WHISPER", "on").lower() not in ("off", "0", "false")
    logs: list = []
    e = eng.build_engines(models, device, whisper_on, logs.append)
    t = np.arange(32000, dtype=np.float32) / 16000.0
    audio = (np.sin(2 * np.pi * 220 * t) * 0.2).astype(np.float32)
    out: dict = {"ok": False, "cuda": eng.cuda_free_gb() is not None, "engines": e.info(), "inferMs": {}, "log": logs}
    for x in e.list():
        if not x.loaded:
            continue
        try:
            t0 = time.perf_counter()
            x.transcribe(audio, "ru")
            out["inferMs"][x.name] = int((time.perf_counter() - t0) * 1000)
        except Exception as ex:
            out["inferMs"][x.name] = f"ошибка {type(ex).__name__}"
    out["ok"] = e.main() is not None and all(isinstance(v, int) for v in out["inferMs"].values())
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
