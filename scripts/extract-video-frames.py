import cv2
import json
import os
import numpy as np

root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
video = os.path.join(root, "video", "20260624-2159-03.3805460.mp4")
out_dir = os.path.join(root, "scripts", "video-frames")
os.makedirs(out_dir, exist_ok=True)

cap = cv2.VideoCapture(video)
if not cap.isOpened():
    print(json.dumps({"error": "cannot_open", "path": video}))
    raise SystemExit(1)

fps = cap.get(cv2.CAP_PROP_FPS) or 30
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

saved = []
# Sample roughly every second across the whole clip.
interval = max(int(fps), 1)
indices = sorted(set(list(range(0, total, interval)) + [total - 1]))

target_w = 960


def write_unicode(path, frame):
    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
    if not ok:
        return False
    buf.tofile(path)
    return os.path.isfile(path)


for idx in indices:
    if idx < 0:
        continue
    cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
    ok, frame = cap.read()
    if not ok or frame is None:
        continue
    if frame.shape[1] > target_w:
        scale = target_w / frame.shape[1]
        frame = cv2.resize(frame, (target_w, int(frame.shape[0] * scale)), interpolation=cv2.INTER_AREA)
    # mean brightness helps spot black frames quickly
    brightness = round(float(np.mean(frame)), 1)
    name = f"frame_{idx:06d}.jpg"
    path = os.path.join(out_dir, name)
    if write_unicode(path, frame):
        saved.append({
            "frame": idx,
            "sec": round(idx / fps, 2),
            "file": name,
            "brightness": brightness,
            "size": os.path.getsize(path),
        })

cap.release()
print(json.dumps({
    "fps": fps,
    "total_frames": total,
    "duration_sec": round(total / fps, 2),
    "resolution": [w, h],
    "out_dir": out_dir,
    "saved_count": len(saved),
    "saved": saved,
}, ensure_ascii=False, indent=2))
