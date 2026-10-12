# ATOMLAB: узел ComfyUI «ATOMLABSafetyCheck» — проверка готовой картинки классификатором
# Falconsai NSFW ViT (Apache-2.0, ViT-base, метки normal/nsfw) прямо внутри ComfyUI.
#
# Зачем: сайт ATOMLAB для учеников 12–17 лет (закон РУз ЗРУ-444 «О защите детей от информации,
# наносящей вред их здоровью»). Мозг отдаёт картинку, ТОЛЬКО если в /history у задания есть
# outputs[<id>].atomlab_safety = [{index, nsfw, normal, model, ms}] и nsfw ниже порога.
# Ошибки здесь НЕ глотаются: задание падает целиком, и непроверенная картинка не уходит никому.
#
# Модель (config.json, preprocessor_config.json, model.safetensors) кладёт deploy/brain-pc/comfy/image-install.ps1
# со сверкой SHA-256 в C:\ATOMLAB\comfy\models\atomlab_safety\falconsai_nsfw; run-comfy.ps1 передаёт путь
# в ATOMLAB_SAFETY_DIR. Без переменной — ComfyUI/models/atomlab_safety/falconsai_nsfw (ручной запуск).
# Ничего не качается из сети (local_files_only, HF_HUB_OFFLINE=1 в run-comfy.ps1).
# Зависимости — только то, что уже есть в ComfyUI portable: torch, transformers, Pillow, numpy.
# Устройство: cuda (fp16), если есть, иначе cpu; ATOMLAB_SAFETY_DEVICE=cpu — принудительно процессор.

import os
import time

import numpy as np
import torch
from PIL import Image

import folder_paths

MODEL_DIR = os.environ.get("ATOMLAB_SAFETY_DIR") or os.path.join(folder_paths.models_dir, "atomlab_safety", "falconsai_nsfw")
MODEL_NAME = "falconsai-nsfw-vit"

_cache = {}  # ленивая загрузка один раз на процесс ComfyUI


def _load():
    if "model" in _cache:
        return _cache["processor"], _cache["model"], _cache["device"], _cache["labels"]
    from transformers import AutoImageProcessor, AutoModelForImageClassification

    want = os.environ.get("ATOMLAB_SAFETY_DEVICE", "").strip().lower()
    device = "cuda" if torch.cuda.is_available() and want != "cpu" else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    processor = AutoImageProcessor.from_pretrained(MODEL_DIR, local_files_only=True)
    model = AutoModelForImageClassification.from_pretrained(MODEL_DIR, local_files_only=True)
    model.to(device=device, dtype=dtype)
    model.eval()
    labels = {int(k): str(v).lower() for k, v in model.config.id2label.items()}
    if "nsfw" not in labels.values() or "normal" not in labels.values():
        raise RuntimeError("ATOMLABSafetyCheck: в config.json нет меток normal/nsfw: %r" % (labels,))
    _cache.update(processor=processor, model=model, device=device, labels=labels, dtype=dtype)
    return processor, model, device, labels


def _to_pil(frame):
    # IMAGE в ComfyUI: тензор [H, W, 3], float 0..1
    arr = frame.detach().float().cpu().numpy()
    arr = np.clip(arr * 255.0 + 0.5, 0, 255).astype(np.uint8)
    if arr.ndim == 3 and arr.shape[-1] == 4:
        arr = arr[..., :3]
    return Image.fromarray(arr).convert("RGB")


class ATOMLABSafetyCheck:
    CATEGORY = "ATOMLAB"
    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "check"
    DESCRIPTION = "ATOMLAB: NSFW-проверка готовой картинки (Falconsai ViT). Без её результата мозг картинку не отдаёт."

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"images": ("IMAGE",)}}

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # всегда выполнять заново: результат проверки не должен браться из кеша ComfyUI
        return float("nan")

    def check(self, images):
        processor, model, device, labels = _load()
        dtype = _cache["dtype"]
        idx = {name: i for i, name in labels.items()}
        out = []
        with torch.inference_mode():
            for i in range(int(images.shape[0])):
                t0 = time.perf_counter()
                inputs = processor(images=_to_pil(images[i]), return_tensors="pt")
                pixels = inputs["pixel_values"].to(device=device, dtype=dtype)
                logits = model(pixel_values=pixels).logits.float()
                probs = torch.softmax(logits, dim=-1)[0].cpu().tolist()
                out.append({
                    "index": i,
                    "nsfw": round(float(probs[idx["nsfw"]]), 6),
                    "normal": round(float(probs[idx["normal"]]), 6),
                    "model": MODEL_NAME,
                    "ms": int(round((time.perf_counter() - t0) * 1000)),
                })
        return {"ui": {"atomlab_safety": out}}


NODE_CLASS_MAPPINGS = {"ATOMLABSafetyCheck": ATOMLABSafetyCheck}
NODE_DISPLAY_NAME_MAPPINGS = {"ATOMLABSafetyCheck": "ATOMLAB Safety Check (NSFW)"}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
