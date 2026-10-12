"""
Загрузка моделей сайдкара в STT_MODELS_DIR (вызывает deploy/brain-pc/stt.ps1):
  GigaAM-Multilingual (ревизии large_ctc и ctc) → <dir>/hf (кеш transformers);
  faster-whisper large-v3-turbo → <dir>/faster-whisper-large-v3-turbo.
После загрузки каждый LFS-файл сверяется с sha256 из метаданных хаба (контрольные суммы).
HF недоступен → зеркало (HF_ENDPOINT=https://hf-mirror.com). Код выхода: 0 — всё на месте, 1 — что-то не скачалось.
  python -I fetch_models.py <models_dir> [--whisper-repo=a,b] [--gigaam-repo=…] [--gigaam-revs=large_ctc,ctc] [--no-whisper]
"""
from __future__ import annotations

import hashlib
import os
import sys

sys.dont_write_bytecode = True


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify(api, repo: str, revision, local: str) -> bool:
    """Сверить LFS-файлы снимка с sha256 хаба (маленькие не-LFS файлы — по наличию)."""
    info = api.model_info(repo, revision=revision, files_metadata=True)
    good = True
    for s in info.siblings or []:
        p = os.path.join(local, s.rfilename)
        if not os.path.isfile(p):
            continue
        lfs = getattr(s, "lfs", None)
        want = None
        if lfs:
            want = lfs.get("sha256") if isinstance(lfs, dict) else getattr(lfs, "sha256", None)
        if want and sha256(p) != want:
            print(f"  !! контрольная сумма не совпала: {s.rfilename}")
            good = False
    return good


def fetch(repo: str, revision, **kw) -> bool:
    from huggingface_hub import HfApi, snapshot_download

    for endpoint in (os.environ.get("HF_ENDPOINT") or None, "https://hf-mirror.com"):
        if endpoint:
            os.environ["HF_ENDPOINT"] = endpoint
        try:
            local = snapshot_download(repo, revision=revision, endpoint=endpoint, **kw)
            good = verify(HfApi(endpoint=endpoint), repo, revision, local)
            print(f"  OK  {repo}@{revision or 'main'}: {'суммы сошлись' if good else 'СУММЫ НЕ СОШЛИСЬ'}")
            if good:
                return True
        except Exception as e:
            print(f"  !!  {repo}@{revision or 'main'} через {endpoint or 'huggingface.co'}: {type(e).__name__}")
    return False


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = {}
    for a in sys.argv[1:]:
        if a.startswith("--"):
            k, _, v = a[2:].partition("=")
            opts[k] = v or "1"
    if not args:
        print(__doc__)
        return 2
    root = args[0]
    os.makedirs(root, exist_ok=True)
    good = True
    g_repo = opts.get("gigaam-repo", "ai-sage/GigaAM-Multilingual")
    for rev in [r for r in opts.get("gigaam-revs", "large_ctc,ctc").split(",") if r]:
        good = fetch(g_repo, rev, cache_dir=os.path.join(root, "hf")) and good
    if opts.get("no-whisper") != "1":
        w_dir = os.path.join(root, "faster-whisper-large-v3-turbo")
        repos = [r for r in opts.get("whisper-repo", "mobiuslabsgmbh/faster-whisper-large-v3-turbo,Systran/faster-whisper-large-v3-turbo").split(",") if r]
        good = any(fetch(r, None, local_dir=w_dir) for r in repos) and good
    return 0 if good else 1


if __name__ == "__main__":
    sys.exit(main())
