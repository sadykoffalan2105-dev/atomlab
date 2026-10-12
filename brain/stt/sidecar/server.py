"""
atomlab-stt — сайдкар распознавания речи для мозга ATOMLAB (контракт «Голос» v1, внутренняя часть).
Только 127.0.0.1 (по умолчанию порт 8788); мозг (brain/stt/route.ts) пересылает сюда проверенный WAV.

  POST /transcribe  тело: сырой WAV PCM16 16 кГц моно 0,3–25 с; заголовки X-Lang-Hint (ru|uz|en|auto),
                    X-Partial (0|1), X-Engine (auto|gigaam|whisper)
                    → {ok:true, text, engine, device, ms:{queue,decode,infer}, durationMs, lang?, confidence?}
                    | {ok:false, code: too_long|bad_audio|busy|timeout|not_loaded}
  GET  /health      → {ok, engines:[{name,device,loaded,langs}], queue:{running,waiting}, maxSeconds, state}
  POST /gpu         {"mode":"release"|"acquire"} → {ok:true, state:'cpu'|'cuda'} (арбитр GPU мозга)

Один поток инференса с очередью (видеокарта — по одному запросу), ≤ 4 запроса в очереди (дальше busy),
таймаут ожидания результата 12 с. Аудио только в памяти; в журнал — длительность, байты, язык, мс, код. НИКОГДА текст.

Запуск: python server.py (env STT_PORT, STT_DEVICE=auto|cuda|cpu, STT_MODELS_DIR, STT_WHISPER=on|off, STT_LOG,
STT_ENGINE=stub — заглушка для тестов без GPU).
"""
from __future__ import annotations

import io
import json
import os
import queue
import sys
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Optional

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engines as eng  # noqa: E402

MAX_SECONDS = 25
MIN_MS = 300
MAX_BODY = 1_048_576
MAX_QUEUE = 4
INFER_TIMEOUT_S = 12.0
RATE = 16_000

_log_lock = threading.Lock()


def log(msg: str) -> None:
    """Журнал сайдкара: только служебные числа и коды (без текста и аудио)."""
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {msg}"
    path = os.environ.get("STT_LOG", "")
    with _log_lock:
        if path:
            try:
                with open(path, "a", encoding="utf-8") as f:
                    f.write(line + "\n")
                return
            except OSError:
                pass
        print(line, file=sys.stderr, flush=True)


class AudioError(Exception):
    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(code)
        self.code = code
        self.detail = detail


def decode_wav(data: bytes, max_seconds: float = MAX_SECONDS) -> tuple:
    """WAV из памяти → (float32 [-1..1] 16 кГц моно, длительность мс). Без файлов на диске."""
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            ch, width, rate, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
            if ch != 1:
                raise AudioError("bad_audio", "channels")
            if rate != RATE:
                raise AudioError("bad_audio", "rate")
            if width != 2:
                raise AudioError("bad_audio", "bits")
            frames = w.readframes(n)
    except AudioError:
        raise
    except (wave.Error, EOFError, ValueError) as e:
        raise AudioError("bad_audio", "format") from e
    pcm = np.frombuffer(frames, dtype="<i2")
    dur_ms = int(round(len(pcm) * 1000 / RATE))
    if dur_ms > max_seconds * 1000:
        raise AudioError("too_long")
    if dur_ms < MIN_MS:
        raise AudioError("bad_audio", "too_short")
    return (pcm.astype(np.float32) / 32768.0), dur_ms


class Job:
    __slots__ = ("audio", "lang", "partial", "engine", "done", "result", "error", "cancelled", "t_enq", "t_start", "t_end")

    def __init__(self, audio: Any, lang: str, partial: bool, engine: str) -> None:
        self.audio = audio
        self.lang = lang
        self.partial = partial
        self.engine = engine
        self.done = threading.Event()
        self.result: Optional[dict] = None
        self.error: Optional[str] = None
        self.cancelled = False
        self.t_enq = time.perf_counter()
        self.t_start = 0.0
        self.t_end = 0.0


class Worker:
    """Один поток инференса: запросы по очереди, ≤ MAX_QUEUE всего (в работе + ждут)."""

    def __init__(self, engines: eng.Engines, max_queue: int = MAX_QUEUE, timeout_s: float = INFER_TIMEOUT_S) -> None:
        self.engines = engines
        self.max_queue = max_queue
        self.timeout_s = timeout_s
        self.q: "queue.Queue[Optional[Job]]" = queue.Queue()
        self.lock = threading.Lock()
        self.waiting = 0
        self.running = 0
        self.gpu_lock = threading.Lock()  # /gpu не одновременно с распознаванием
        self.t = threading.Thread(target=self._loop, name="stt-infer", daemon=True)
        self.t.start()

    def stats(self) -> dict:
        with self.lock:
            return {"running": self.running, "waiting": self.waiting}

    def submit(self, job: Job) -> bool:
        with self.lock:
            if self.running + self.waiting >= self.max_queue:
                return False
            self.waiting += 1
        self.q.put(job)
        return True

    def wait(self, job: Job) -> None:
        if not job.done.wait(self.timeout_s):
            job.cancelled = True
            job.error = "timeout"

    def stop(self) -> None:
        self.q.put(None)

    def _pick(self, job: Job) -> Optional[eng.Engine]:
        g, w = self.engines.gigaam, self.engines.whisper
        g_ok = g is not None and g.loaded
        w_ok = w is not None and w.loaded
        if job.engine == "whisper":
            return w if w_ok else None
        if job.engine == "gigaam" or job.partial:
            return g if g_ok else (w if w_ok else None)
        # auto: английская подсказка у финальной реплики — сразу whisper (GigaAM на en «умеренно»)
        if job.lang == "en" and w_ok:
            return w
        return g if g_ok else (w if w_ok else None)

    def _loop(self) -> None:
        while True:
            job = self.q.get()
            if job is None:
                return
            with self.lock:
                self.waiting -= 1
                self.running += 1
            try:
                if job.cancelled:
                    continue
                job.t_start = time.perf_counter()
                e = self._pick(job)
                if e is None:
                    job.error = "not_loaded"
                    continue
                try:
                    with self.gpu_lock:
                        text, conf = e.transcribe(job.audio, job.lang)
                except Exception as ex1:
                    # движок упал: тип и начало сообщения в журнал (без текста реплики), затем запасной движок — whisper
                    log(f"ошибка распознавания {e.name}: {type(ex1).__name__}: {str(ex1)[:200]}")
                    w = self.engines.whisper
                    if w is None or not w.loaded or w is e:
                        raise
                    e = w
                    with self.gpu_lock:
                        text, conf = e.transcribe(job.audio, job.lang)
                job.result = {"text": text or "", "engine": e.name, "device": e.device, "confidence": conf}
                # whisper по английской подсказке — язык уже известен (мозг: langSource 'whisper')
                if e.name.startswith("whisper") and job.lang == "en":
                    job.result["lang"] = "en"
            except Exception as ex:  # ошибка движка — код без подробностей текста
                log(f"ошибка распознавания: {type(ex).__name__}: {str(ex)[:200]}")
                job.error = "internal"
            finally:
                job.t_end = time.perf_counter()
                with self.lock:
                    self.running -= 1
                job.done.set()

    def gpu(self, mode: str) -> str:
        with self.gpu_lock:
            return self.engines.release() if mode == "release" else self.engines.acquire()


class App:
    def __init__(self, engines: eng.Engines, max_queue: int = MAX_QUEUE, timeout_s: float = INFER_TIMEOUT_S) -> None:
        self.engines = engines
        self.worker = Worker(engines, max_queue, timeout_s)

    def health(self) -> dict:
        return {
            "ok": True,
            "engines": self.engines.info(),
            "queue": self.worker.stats(),
            "maxSeconds": MAX_SECONDS,
            "state": self.engines.state,
        }

    def transcribe(self, body: bytes, lang: str, partial: bool, engine: str) -> tuple:
        """→ (http статус, dict ответа). Журнал — только числа и код."""
        t0 = time.perf_counter()
        if len(body) > MAX_BODY:
            return 413, {"ok": False, "code": "too_long"}
        try:
            audio, dur_ms = decode_wav(body)
        except AudioError as e:
            status = 413 if e.code == "too_long" else 400
            log(f"transcribe {len(body)} Б → {e.code}")
            return status, {"ok": False, "code": e.code, "detail": e.detail}
        t_dec = time.perf_counter()
        if self.engines.main() is None:
            return 503, {"ok": False, "code": "not_loaded"}
        job = Job(audio, lang if lang in ("ru", "uz", "en") else "auto", partial, engine)
        if not self.worker.submit(job):
            log(f"transcribe {dur_ms} мс аудио → busy")
            return 429, {"ok": False, "code": "busy"}
        self.worker.wait(job)
        if job.error or job.result is None:
            code = job.error or "internal"
            log(f"transcribe {dur_ms} мс аудио, {len(body)} Б, hint {job.lang} → {code}")
            return (504 if code == "timeout" else 503 if code == "not_loaded" else 500), {"ok": False, "code": code}
        ms = {
            "queue": int(round((job.t_start - job.t_enq) * 1000)),
            "decode": int(round((t_dec - t0) * 1000)),
            "infer": int(round((job.t_end - job.t_start) * 1000)),
        }
        r = dict(job.result)
        out = {"ok": True, "text": r["text"], "engine": r["engine"], "device": r["device"], "ms": ms, "durationMs": dur_ms}
        if r.get("lang"):
            out["lang"] = r["lang"]
        if r.get("confidence") is not None:
            out["confidence"] = r["confidence"]
        log(f"transcribe {dur_ms} мс аудио, {len(body)} Б, hint {job.lang}{' partial' if partial else ''} → {r['engine']}/{r['device']} infer {ms['infer']} мс, queue {ms['queue']} мс")
        return 200, out


def make_handler(app: App):
    class Handler(BaseHTTPRequestHandler):
        server_version = "atomlab-stt/1"
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt: str, *args: Any) -> None:  # стандартный журнал запросов выключен
            return

        def _send(self, status: int, obj: dict) -> None:
            data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _loopback(self) -> bool:
            host = self.client_address[0] if self.client_address else ""
            if host in ("127.0.0.1", "::1") or host.startswith("127.") or host == "::ffff:127.0.0.1":
                return True
            self._send(403, {"ok": False, "code": "forbidden"})
            return False

        def _body(self, limit: int) -> Optional[bytes]:
            try:
                n = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                n = 0
            if n > limit:
                self.close_connection = True
                self._send(413, {"ok": False, "code": "too_long"})
                return None
            return self.rfile.read(n) if n > 0 else b""

        def do_GET(self) -> None:  # noqa: N802
            if not self._loopback():
                return
            if self.path.split("?")[0] == "/health":
                return self._send(200, app.health())
            self._send(404, {"ok": False, "code": "not_found"})

        def do_POST(self) -> None:  # noqa: N802
            if not self._loopback():
                return
            p = self.path.split("?")[0]
            if p == "/transcribe":
                body = self._body(MAX_BODY)
                if body is None:
                    return
                lang = (self.headers.get("X-Lang-Hint") or "auto").lower()
                partial = (self.headers.get("X-Partial") or "0") in ("1", "true")
                engine = (self.headers.get("X-Engine") or "auto").lower()
                status, obj = app.transcribe(body, lang, partial, engine)
                del body
                return self._send(status, obj)
            if p == "/gpu":
                raw = self._body(4096)
                if raw is None:
                    return
                try:
                    mode = json.loads(raw.decode("utf-8") or "{}").get("mode")
                except (ValueError, AttributeError):
                    mode = None
                if mode not in ("release", "acquire"):
                    return self._send(400, {"ok": False, "code": "bad_request"})
                t0 = time.perf_counter()
                state = app.worker.gpu(mode)
                log(f"gpu {mode} → {state} за {int((time.perf_counter() - t0) * 1000)} мс")
                return self._send(200, {"ok": True, "state": state})
            self._send(404, {"ok": False, "code": "not_found"})

    return Handler


def serve(app: App, port: int) -> ThreadingHTTPServer:
    srv = ThreadingHTTPServer(("127.0.0.1", port), make_handler(app))
    srv.daemon_threads = True
    return srv


def main() -> None:
    try:
        sys.stderr.reconfigure(encoding="utf-8")  # журнал в консоль Windows без «кракозябр»
    except Exception:
        pass
    port = int(os.environ.get("STT_PORT", "8788"))
    device = os.environ.get("STT_DEVICE", "auto").lower()
    models = os.environ.get("STT_MODELS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "models"))
    whisper_on = os.environ.get("STT_WHISPER", "on").lower() not in ("off", "0", "false")
    engines = eng.build_engines(models, device, whisper_on, log)
    app = App(engines)
    if engines.main() is None:
        log("ни один движок не загрузился — /transcribe отвечает not_loaded (мозг: 503, сайт: Web Speech)")
    srv = serve(app, port)
    log(f"слушаю 127.0.0.1:{port}; движки: " + ", ".join(f"{e['name']}@{e['device']}" for e in engines.info()))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
