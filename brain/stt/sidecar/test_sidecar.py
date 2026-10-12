"""
Проверка сайдкара без GPU и без моделей (движок-заглушка STT_ENGINE=stub):
  python -I brain/stt/sidecar/test_sidecar.py   (или pytest brain/stt/sidecar/test_sidecar.py)
  — разбор WAV в тензор из памяти (и отказы: стерео / 48 кГц / 8 бит / не WAV / > 25 с / < 0,3 с), без файлов;
  — очередь: ≤ 4 в работе+ожидании (дальше busy), таймаут ожидания;
  — /gpu release/acquire на заглушке; HTTP: /health, /transcribe, /gpu, 404; журнал без текста.
Код выхода 1, если хоть одна проверка не прошла.
"""
from __future__ import annotations

import io
import json
import os
import struct
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request

os.environ["STT_ENGINE"] = "stub"
sys.dont_write_bytecode = True  # без __pycache__ рядом с исходниками
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")  # консоль Windows (cp1251) не печатает ✓
    except Exception:
        pass
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import engines as eng  # noqa: E402
import server as srv  # noqa: E402

passed = 0
failed = 0


def ok(cond: bool, what: str, extra: str = "") -> None:
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
    print(f"  {'✓' if cond else '✗'} {what}{' — ' + extra if extra else ''}")


def wav(ms: int, rate: int = 16000, ch: int = 1, bits: int = 16, tone: float = 440.0) -> bytes:
    n = int(rate * ms / 1000)
    width = bits // 8
    frames = bytearray()
    import math

    for i in range(n):
        v = int(math.sin(2 * math.pi * tone * i / rate) * 8000)
        for _ in range(ch):
            frames += struct.pack("<h", v) if width == 2 else struct.pack("<B", (v >> 8) + 128)
    data = bytes(frames)
    hdr = b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE" + b"fmt " + struct.pack("<IHHIIHH", 16, 1, ch, rate, rate * ch * width, ch * width, bits)
    return hdr + b"data" + struct.pack("<I", len(data)) + data


def test_decode() -> None:
    print("1) разбор WAV в памяти")
    before = set(os.listdir(tempfile.gettempdir()))
    a, dur = srv.decode_wav(wav(1000))
    ok(a.dtype.name == "float32" and len(a) == 16000 and dur == 1000 and float(abs(a).max()) <= 1.0, "1 с PCM16 16 кГц → float32 16000 отсчётов, [-1..1]")
    for bad, detail in ((wav(500, ch=2), "channels"), (wav(500, rate=48000), "rate"), (wav(500, bits=8), "bits"), (b"not a wav at all" * 10, "format")):
        try:
            srv.decode_wav(bad)
            ok(False, f"отказ {detail}")
        except srv.AudioError as e:
            ok(e.code == "bad_audio" and e.detail == detail, f"отказ bad_audio/{detail}")
    try:
        srv.decode_wav(wav(26000))
        ok(False, "26 с → too_long")
    except srv.AudioError as e:
        ok(e.code == "too_long", "26 с → too_long")
    try:
        srv.decode_wav(wav(200))
        ok(False, "0,2 с → too_short")
    except srv.AudioError as e:
        ok(e.detail == "too_short", "0,2 с → bad_audio/too_short")
    after = set(os.listdir(tempfile.gettempdir()))
    ok(not [f for f in after - before if f.lower().endswith((".wav", ".pcm", ".raw"))], "временных аудиофайлов нет")


def test_queue() -> None:
    print("2) очередь и таймаут")
    engines = eng.build_engines("", "cpu", True, lambda s: None)
    os.environ["STT_STUB_DELAY_MS"] = "400"
    app = srv.App(engines, max_queue=2, timeout_s=5)
    res: list = []

    def call() -> None:
        res.append(app.transcribe(wav(1000), "ru", False, "auto")[0])

    ts = [threading.Thread(target=call) for _ in range(3)]
    for t in ts:
        t.start()
        time.sleep(0.03)
    for t in ts:
        t.join()
    ok(sorted(res) == [200, 200, 429], "3 запроса при очереди 2 → 200, 200, 429 busy", str(sorted(res)))
    app2 = srv.App(engines, max_queue=4, timeout_s=0.1)
    st, body = app2.transcribe(wav(1000), "ru", False, "auto")
    ok(st == 504 and body.get("code") == "timeout", "инференс дольше таймаута → timeout")
    time.sleep(0.5)
    ok(app2.worker.stats() == {"running": 0, "waiting": 0}, "после таймаута очередь освобождается")
    os.environ["STT_STUB_DELAY_MS"] = "0"
    st, body = app.transcribe(wav(1000), "en", False, "auto")
    ok(st == 200 and body["engine"].startswith("whisper") and body.get("lang") == "en", "подсказка en у финальной → whisper, lang en")
    st, body = app.transcribe(wav(1000), "en", True, "auto")
    ok(st == 200 and body["engine"].startswith("gigaam"), "partial → только GigaAM")
    st, body = app.transcribe(wav(1000), "ru", False, "auto")
    ok(st == 200 and set(body["ms"]) == {"queue", "decode", "infer"} and body["durationMs"] == 1000, "ответ: ms{queue,decode,infer}, durationMs")


def test_gpu() -> None:
    print("3) /gpu release/acquire (заглушка)")
    engines = eng.build_engines("", "cuda", True, lambda s: None)
    ok(engines.state == "cuda" and all(e.device == "cuda" for e in engines.list()), "старт на cuda (заглушка)")
    ok(engines.release() == "cpu" and all(e.device == "cpu" for e in engines.list()), "release → все движки на cpu")
    ok(engines.acquire() == "cuda" and all(e.device == "cuda" for e in engines.list()), "acquire → обратно на cuda")
    cpu = eng.build_engines("", "cpu", False, lambda s: None)
    ok(cpu.acquire() == "cpu" and cpu.whisper is None, "без CUDA acquire честно остаётся на cpu; STT_WHISPER=off — без whisper")


def http(port: int, method: str, path: str, body: bytes | None = None, headers: dict | None = None) -> tuple:
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8") or "{}")


def test_http() -> None:
    print("4) HTTP")
    logf = os.path.join(tempfile.mkdtemp(prefix="atomlab-stt-test-"), "stt.log")
    os.environ["STT_LOG"] = logf
    os.environ["STT_STUB_TEXT"] = "секретная фраза ученика"
    engines = eng.build_engines("", "cuda", True, lambda s: None)
    app = srv.App(engines)
    s = srv.serve(app, 0)
    port = s.server_address[1]
    threading.Thread(target=s.serve_forever, daemon=True).start()
    try:
        st, h = http(port, "GET", "/health")
        ok(st == 200 and h["ok"] and h["maxSeconds"] == 25 and len(h["engines"]) == 2 and h["queue"] == {"running": 0, "waiting": 0}, "GET /health")
        st, r = http(port, "POST", "/transcribe", wav(1200), {"Content-Type": "audio/wav", "X-Lang-Hint": "ru", "X-Partial": "0"})
        ok(st == 200 and r["ok"] and r["text"] == "секретная фраза ученика" and r["device"] == "cuda", "POST /transcribe → текст, device cuda")
        st, r = http(port, "POST", "/transcribe", wav(500, rate=48000), {"Content-Type": "audio/wav"})
        ok(st == 400 and r.get("code") == "bad_audio", "48 кГц → 400 bad_audio")
        st, r = http(port, "POST", "/gpu", json.dumps({"mode": "release"}).encode(), {"Content-Type": "application/json"})
        ok(st == 200 and r == {"ok": True, "state": "cpu"}, "POST /gpu release → cpu")
        st, h = http(port, "GET", "/health")
        ok(all(e["device"] == "cpu" for e in h["engines"]), "/health после release: cpu")
        st, r = http(port, "POST", "/gpu", json.dumps({"mode": "acquire"}).encode(), {"Content-Type": "application/json"})
        ok(st == 200 and r["state"] == "cuda", "POST /gpu acquire → cuda")
        st, r = http(port, "POST", "/gpu", b"{}", {"Content-Type": "application/json"})
        ok(st == 400, "POST /gpu без mode → 400")
        st, r = http(port, "GET", "/nope")
        ok(st == 404, "неизвестный путь → 404")
        text = open(logf, encoding="utf-8").read()
        ok("секретная" not in text and "transcribe" in text, "журнал: есть строки запросов, нет текста распознавания")
    finally:
        s.shutdown()
        os.environ.pop("STT_STUB_TEXT", None)
        os.environ.pop("STT_LOG", None)


def test_privacy_grep() -> None:
    print("5) код: аудио/текст не пишутся")
    src = open(os.path.join(HERE, "server.py"), encoding="utf-8").read() + open(os.path.join(HERE, "engines.py"), encoding="utf-8").read()
    ok("tempfile" not in src and ".wav\"" not in src and "NamedTemporary" not in src, "нет временных файлов в сайдкаре")
    ok("log(f\"" in src and "r['text']" not in src.split("def log")[1].split("def ")[0], "log() не получает текст")


if __name__ == "__main__":
    test_decode()
    test_queue()
    test_gpu()
    test_http()
    test_privacy_grep()
    print(f"\nсайдкар: прошло {passed}, не прошло {failed}")
    sys.exit(1 if failed else 0)
