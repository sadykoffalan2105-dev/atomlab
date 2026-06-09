"""ctypes bridge to native/rag_scan (optional C acceleration)."""

from __future__ import annotations

import ctypes
import hashlib
import sys
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from teacher_service.brain.rag import RagChunk

_LIB = None
_LIB_PATH: Path | None = None
_HASH_TO_CHUNK_ID: dict[int, str] = {}


def _lib_candidates() -> list[Path]:
    here = Path(__file__).resolve().parent
    names = []
    if sys.platform == "win32":
        names = ["rag_scan.dll", "rag_scan.pyd"]
    elif sys.platform == "darwin":
        names = ["rag_scan.dylib"]
    else:
        names = ["rag_scan.so"]
    return [here / "rag_scan" / n for n in names]


def _load_lib():
    global _LIB, _LIB_PATH
    if _LIB is not None:
        return _LIB
    for path in _lib_candidates():
        if path.is_file():
            _LIB = ctypes.CDLL(str(path))
            _LIB_PATH = path
            _LIB.rag_reset.argtypes = []
            _LIB.rag_reset.restype = None
            _LIB.rag_add_chunk.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_char_p]
            _LIB.rag_add_chunk.restype = ctypes.c_int
            _LIB.rag_top_k.argtypes = [
                ctypes.c_char_p,
                ctypes.c_int,
                ctypes.POINTER(ctypes.c_int),
                ctypes.POINTER(ctypes.c_float),
            ]
            _LIB.rag_top_k.restype = ctypes.c_int
            return _LIB
    return None


def chunk_id_hash(chunk_id: str) -> int:
    digest = hashlib.md5(chunk_id.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "little", signed=False)


def load_index_into_native(chunks: list[RagChunk]) -> bool:
    global _HASH_TO_CHUNK_ID
    lib = _load_lib()
    if lib is None:
        return False
    lib.rag_reset()
    _HASH_TO_CHUNK_ID.clear()
    for chunk in chunks:
        kw = " ".join(chunk.keywords)
        id_hash = chunk_id_hash(chunk.chunk_id)
        _HASH_TO_CHUNK_ID[id_hash] = chunk.chunk_id
        ok = lib.rag_add_chunk(
            id_hash,
            chunk.norm_text.encode("utf-8"),
            kw.encode("utf-8"),
        )
        if not ok:
            return False
    return True


def native_top_k(query: str, k: int) -> list[tuple[str, float]]:
    lib = _load_lib()
    if lib is None:
        return []

    out_ids = (ctypes.c_int * k)()
    out_scores = (ctypes.c_float * k)()
    found = lib.rag_top_k(query.encode("utf-8"), k, out_ids, out_scores)
    results: list[tuple[str, float]] = []
    for i in range(found):
        id_hash = out_ids[i]
        chunk_id = _HASH_TO_CHUNK_ID.get(id_hash)
        if not chunk_id:
            continue
        results.append((chunk_id, float(out_scores[i])))
    return results
