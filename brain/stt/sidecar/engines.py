"""
Движки распознавания речи сайдкара atomlab-stt (контракт «Голос» v1, brain/stt/sidecar/server.py).

  GigaAM-Multilingual (CTC) — основной для ru/uz (en «умеренно»): large_ctc 600M fp16 на CUDA,
                              мало видеопамяти → multilingual_ctc 220M, нет CUDA → CPU;
  faster-whisper large-v3-turbo — английский (повторное распознавание финальной реплики) и детекция языка;
                              CUDA float16 (на sm_120 int8 отключён), CPU int8.
  stub                       — заглушка для тестов без GPU и без моделей (STT_ENGINE=stub).

Аудио подаётся тензором из памяти (float32, 16 кГц, моно) — временных файлов нет.
Тексты и аудио здесь не логируются (это делает только вызывающий — и только длительности/коды).
"""
from __future__ import annotations

import os
import threading
import time
from typing import Any, Optional

# словарь химии для подсказки whisper (initial_prompt / hotwords): формулы и термины трёх языков
CHEM_PROMPT = (
    "Chemistry lesson. H2SO4, HCl, NaOH, H2O, CO2, NaCl, valence, molar mass, mole, oxide, acid, base, salt, "
    "valentlik, molyar massa, oksid, kislota, asos, tuz, mol, валентность, молярная масса, оксид, кислота."
)
CHEM_HOTWORDS = "H2SO4 HCl NaOH H2O CO2 valence molar mass mole oxide acid valentlik molyar massa oksid kislota"

GB = 1024 ** 3
# пороги размещения по свободной видеопамяти (spec-voice: GigaAM large ≥ 2,0 ГБ; whisper ≥ 3,2 ГБ после GigaAM)
GIGAAM_LARGE_MIN_GB = 2.0
GIGAAM_SMALL_MIN_GB = 0.9
WHISPER_MIN_GB = 3.2


def _torch():
    try:
        import torch  # noqa: WPS433 — тяжёлый импорт только при настоящих движках
        return torch
    except Exception:
        return None


def cuda_free_gb() -> Optional[float]:
    """Свободная видеопамять (ГБ) или None — CUDA нет."""
    torch = _torch()
    try:
        if torch is not None and torch.cuda.is_available():
            free, _total = torch.cuda.mem_get_info()
            return free / GB
    except Exception:
        return None
    return None


def empty_cuda_cache() -> None:
    torch = _torch()
    try:
        if torch is not None and torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass


class Engine:
    """Общий интерфейс: transcribe(audio float32 16 кГц, lang) → (text, confidence|None)."""

    name = "engine"
    langs: list = []

    def __init__(self) -> None:
        self.device = "cpu"
        self.loaded = False
        self.lock = threading.Lock()

    def info(self) -> dict:
        return {"name": self.name, "device": self.device, "loaded": self.loaded, "langs": list(self.langs)}

    def transcribe(self, audio: Any, lang: str) -> tuple:  # pragma: no cover — переопределяется
        raise NotImplementedError

    def to_device(self, device: str) -> str:  # pragma: no cover — переопределяется
        self.device = device
        return device


class StubEngine(Engine):
    """Заглушка для селфтестов: текст из STT_STUB_TEXT, задержка STT_STUB_DELAY_MS, перенос cuda↔cpu — флаг."""

    def __init__(self, name: str = "stub", langs: Optional[list] = None, device: str = "cpu") -> None:
        super().__init__()
        self.name = name
        self.langs = langs or ["ru", "uz", "en"]
        self.device = device
        self.loaded = True

    def transcribe(self, audio: Any, lang: str) -> tuple:
        delay = float(os.environ.get("STT_STUB_DELAY_MS", "0") or 0)
        if delay > 0:
            time.sleep(delay / 1000.0)
        n = len(audio)
        text = os.environ.get("STT_STUB_TEXT")
        if text is None:
            text = "" if n == 0 else "проверка связи"
        return text, None

    def to_device(self, device: str) -> str:
        self.device = device
        return device


class GigaAMEngine(Engine):
    """GigaAM-Multilingual CTC: пакет gigaam (load_model) или transformers (trust_remote_code)."""

    langs = ["ru", "uz", "en"]

    def __init__(self, variant: str, models_dir: str, device: str) -> None:
        super().__init__()
        self.variant = variant  # 'multilingual_large_ctc' | 'multilingual_ctc'
        self.name = "gigaam-large" if "large" in variant else "gigaam"
        self.models_dir = models_dir
        self.device = device
        self.model: Any = None
        self.fp16 = False

    def load(self) -> None:
        torch = _torch()
        if torch is None:
            raise RuntimeError("torch не установлен")
        last: Optional[Exception] = None
        try:
            import gigaam  # type: ignore

            self.model = gigaam.load_model(self.variant, device=self.device, download_root=os.path.join(self.models_dir, "gigaam"))
        except Exception as e:  # пакет старый или вариант зовётся иначе — путь через transformers
            last = e
            self.model = None
        if self.model is None:
            try:
                from transformers import AutoModel  # type: ignore

                rev = "large_ctc" if "large" in self.variant else "ctc"
                m = AutoModel.from_pretrained("ai-sage/GigaAM-Multilingual", revision=rev, trust_remote_code=True, cache_dir=os.path.join(self.models_dir, "hf"))
                self.model = getattr(m, "model", m)
                self.model.to(self.device)
            except Exception as e:
                raise RuntimeError(f"GigaAM {self.variant} не загрузился: {last or ''} / {e}") from e
        self.model.eval()
        self._set_precision()
        self.loaded = True

    def _set_precision(self) -> None:
        # fp16 на CUDA (600M → ~1,3 ГБ), на CPU — float32
        self.fp16 = self.device == "cuda"
        try:
            if self.fp16:
                self.model.half()
            else:
                self.model.float()
        except Exception:
            self.fp16 = False

    def transcribe(self, audio: Any, lang: str) -> tuple:
        torch = _torch()
        m = self.model
        with self.lock, torch.inference_mode():
            wav = torch.from_numpy(audio).to(self.device)
            if self.fp16:
                wav = wav.half()
            wav = wav.unsqueeze(0)
            length = torch.tensor([wav.shape[-1]], device=self.device)
            # уровень forward + decoding (как внутри transcribe(path), но без файла на диске)
            if hasattr(m, "forward") and hasattr(m, "decoding") and hasattr(m, "head"):
                encoded, encoded_len = m.forward(wav, length)
                out = m.decoding.decode(m.head, encoded, encoded_len)
                text = out[0] if isinstance(out, (list, tuple)) else str(out)
            elif hasattr(m, "transcribe_tensor"):
                text = m.transcribe_tensor(wav, length)
            else:
                raise RuntimeError("у модели GigaAM нет forward/decoding")
        if isinstance(text, (list, tuple)):
            text = text[0] if text else ""
        if not isinstance(text, str):
            text = getattr(text, "text", str(text))
        return text, None

    def to_device(self, device: str) -> str:
        with self.lock:
            self.model.to(device)
            self.device = device
            self._set_precision()
            if device == "cpu":
                empty_cuda_cache()
        return device


class WhisperEngine(Engine):
    """faster-whisper large-v3-turbo (ctranslate2 ≥ 4.6.3)."""

    langs = ["en", "ru", "uz"]

    def __init__(self, models_dir: str, device: str) -> None:
        super().__init__()
        self.models_dir = models_dir
        self.device = device
        self.model: Any = None
        self.name = "whisper-turbo" if device == "cuda" else "whisper-turbo-cpu"

    def _path(self) -> str:
        local = os.path.join(self.models_dir, "faster-whisper-large-v3-turbo")
        return local if os.path.isdir(local) else "large-v3-turbo"

    def load(self) -> None:
        from faster_whisper import WhisperModel  # type: ignore

        compute = "float16" if self.device == "cuda" else "int8"
        self.model = WhisperModel(self._path(), device=self.device, compute_type=compute, download_root=os.path.join(self.models_dir, "whisper"))
        self.name = "whisper-turbo" if self.device == "cuda" else "whisper-turbo-cpu"
        self.loaded = True

    def transcribe(self, audio: Any, lang: str) -> tuple:
        with self.lock:
            kw: dict = dict(
                language=lang if lang in ("en", "ru", "uz") else None,
                beam_size=1,
                vad_filter=True,
                condition_on_previous_text=False,
                initial_prompt=CHEM_PROMPT,
            )
            try:
                segments, info = self.model.transcribe(audio, hotwords=CHEM_HOTWORDS, **kw)
            except TypeError:  # старый faster-whisper без hotwords
                segments, info = self.model.transcribe(audio, **kw)
            text = " ".join(s.text.strip() for s in segments).strip()
        conf = getattr(info, "language_probability", None)
        return text, (float(conf) if conf is not None else None)

    def detect_language(self, audio: Any) -> Optional[str]:
        with self.lock:
            try:
                lang, _p, _all = self.model.detect_language(audio)
                return lang
            except Exception:
                return None

    def to_device(self, device: str) -> str:
        """ctranslate2 не переносит веса между устройствами — выгрузить и загрузить заново."""
        with self.lock:
            self.model = None
            empty_cuda_cache()
            self.device = device
        self.load()
        return device


class Engines:
    """Набор движков с размещением по свободной видеопамяти и переносом CPU↔GPU (арбитр GPU мозга)."""

    def __init__(self, gigaam: Optional[Engine], whisper: Optional[Engine], wanted: str) -> None:
        self.gigaam = gigaam
        self.whisper = whisper
        self.wanted = wanted  # куда грузили при старте: 'cuda' | 'cpu'
        self.state = wanted

    def list(self) -> list:
        return [e for e in (self.gigaam, self.whisper) if e is not None]

    def info(self) -> list:
        return [e.info() for e in self.list()]

    def main(self) -> Optional[Engine]:
        return self.gigaam if self.gigaam is not None and self.gigaam.loaded else (self.whisper if self.whisper is not None and self.whisper.loaded else None)

    def release(self) -> str:
        """Все модели на CPU: видеопамять уходит картинкам (ComfyUI)."""
        for e in self.list():
            if e.loaded and e.device == "cuda":
                e.to_device("cpu")
        empty_cuda_cache()
        self.state = "cpu"
        return self.state

    def acquire(self) -> str:
        """Обратно на видеокарту (если при старте она была)."""
        if self.wanted != "cuda":
            self.state = "cpu"
            return self.state
        for e in self.list():
            if e.loaded and e.device != "cuda":
                e.to_device("cuda")
        self.state = "cuda"
        return self.state


def build_engines(models_dir: str, device_pref: str, whisper_on: bool, log) -> Engines:
    """Загрузить движки по env: STT_ENGINE=stub — заглушка; иначе GigaAM (+ whisper) по свободной видеопамяти."""
    if os.environ.get("STT_ENGINE", "") == "stub":
        dev = "cuda" if device_pref == "cuda" else "cpu"
        g = StubEngine("gigaam-large" if dev == "cuda" else "gigaam", ["ru", "uz", "en"], dev)
        w = StubEngine("whisper-turbo" if dev == "cuda" else "whisper-turbo-cpu", ["en"], dev) if whisper_on else None
        return Engines(g, w, dev)

    free = cuda_free_gb() if device_pref in ("auto", "cuda") else None
    use_cuda = free is not None
    log(f"старт: CUDA {'есть, свободно %.1f ГБ' % free if use_cuda else 'нет'}")

    gigaam: Optional[GigaAMEngine] = None
    for variant, need in (("multilingual_large_ctc", GIGAAM_LARGE_MIN_GB), ("multilingual_ctc", GIGAAM_SMALL_MIN_GB)):
        dev = "cuda" if use_cuda and free is not None and free >= need else "cpu"
        # на CPU — только лёгкая модель (220M), большая слишком медленная
        if dev == "cpu" and "large" in variant:
            continue
        try:
            e = GigaAMEngine(variant, models_dir, dev)
            t0 = time.time()
            e.load()
            log(f"GigaAM {variant} на {dev} за {time.time() - t0:.1f} с")
            gigaam = e
            break
        except Exception as ex:
            log(f"GigaAM {variant}: ошибка загрузки ({type(ex).__name__})")
    whisper: Optional[WhisperEngine] = None
    if whisper_on:
        left = cuda_free_gb() if use_cuda else None
        wdev = "cuda" if left is not None and left >= WHISPER_MIN_GB else "cpu"
        try:
            w = WhisperEngine(models_dir, wdev)
            t0 = time.time()
            w.load()
            log(f"whisper large-v3-turbo на {wdev} за {time.time() - t0:.1f} с")
            whisper = w
        except Exception as ex:
            log(f"whisper: ошибка загрузки ({type(ex).__name__})")
    wanted = "cuda" if any(e is not None and e.device == "cuda" for e in (gigaam, whisper)) else "cpu"
    return Engines(gigaam, whisper, wanted)
