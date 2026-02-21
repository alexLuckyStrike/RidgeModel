#!/usr/bin/env python3
import sys, json, os
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional

import numpy as np

try:
    import cv2
except Exception as e:
    print(json.dumps({"ok": False, "error": f"OpenCV not installed: {e}"}))
    sys.exit(1)

# OCR is optional
try:
    import pytesseract
    _HAVE_TESS = True
except Exception:
    pytesseract = None
    _HAVE_TESS = False


def read_stdin_json() -> Dict[str, Any]:
    raw = sys.stdin.read()
    return json.loads(raw) if raw else {}


def safe_basename(p: str) -> str:
    return os.path.basename(p) if p else ""


def ensure_bgr(img: np.ndarray) -> np.ndarray:
    if img is None:
        return img
    if len(img.shape) == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    if img.shape[2] == 4:
        return cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    return img


def bgr_to_lab(bgr: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    return lab


def delta_e(lab1: np.ndarray, lab2: np.ndarray) -> float:
    # simple Euclidean distance in LAB
    d = lab1.astype(np.float32) - lab2.astype(np.float32)
    return float(np.sqrt(np.sum(d * d)))


def find_long_rect_roi(img_bgr: np.ndarray) -> np.ndarray:
    """Find a long rectangle (strip) and return cropped ROI.
    If not found, return center crop.
    """
    img_bgr = ensure_bgr(img_bgr)
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150)
    edges = cv2.dilate(edges, None, iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best = None
    best_score = -1
    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        area = cw * ch
        if area < 0.03 * w * h:
            continue
        ar = max(cw, ch) / (min(cw, ch) + 1e-6)
        if ar < 3.0:
            continue
        # prefer big + long
        score = area * ar
        if score > best_score:
            best_score = score
            best = (x, y, cw, ch)

    if best is None:
        # fallback: center crop
        cx0 = int(w * 0.15)
        cx1 = int(w * 0.85)
        cy0 = int(h * 0.15)
        cy1 = int(h * 0.85)
        return img_bgr[cy0:cy1, cx0:cx1].copy()

    x, y, cw, ch = best
    roi = img_bgr[y:y+ch, x:x+cw].copy()
    # rotate so strip is vertical (height > width)
    if roi.shape[1] > roi.shape[0]:
        roi = cv2.rotate(roi, cv2.ROTATE_90_CLOCKWISE)
    return roi


def _box_iou(a: Tuple[int, int, int, int], b: Tuple[int, int, int, int]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    x1 = max(ax, bx)
    y1 = max(ay, by)
    x2 = min(ax + aw, bx + bw)
    y2 = min(ay + ah, by + bh)
    inter_w = max(0, x2 - x1)
    inter_h = max(0, y2 - y1)
    inter = inter_w * inter_h
    if inter <= 0:
        return 0.0
    union = aw * ah + bw * bh - inter
    return float(inter / max(1.0, union))


def find_strip_rois(img_bgr: np.ndarray) -> List[np.ndarray]:
    """Find multiple strip-like ROIs in one image.
    Returns vertical ROIs sorted left->right. Falls back to one ROI.
    """
    img_bgr = ensure_bgr(img_bgr)
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 40, 130)
    edges = cv2.dilate(edges, None, iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    raw_boxes: List[Tuple[int, int, int, int, int]] = []
    img_area = max(1, h * w)
    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        area = cw * ch
        if area < 0.0025 * img_area:
            continue
        ar = max(cw, ch) / (min(cw, ch) + 1e-6)
        if ar < 3.0:
            continue
        raw_boxes.append((x, y, cw, ch, area))

    # NMS by area
    raw_boxes.sort(key=lambda b: b[4], reverse=True)
    picked: List[Tuple[int, int, int, int, int]] = []
    for box in raw_boxes:
        cur = (box[0], box[1], box[2], box[3])
        if any(_box_iou(cur, (p[0], p[1], p[2], p[3])) > 0.4 for p in picked):
            continue
        picked.append(box)

    # left to right
    picked.sort(key=lambda b: b[0])
    rois: List[np.ndarray] = []
    for x, y, cw, ch, _ in picked:
        roi = img_bgr[y:y + ch, x:x + cw].copy()
        if roi.size == 0:
            continue
        if roi.shape[1] > roi.shape[0]:
            roi = cv2.rotate(roi, cv2.ROTATE_90_CLOCKWISE)
        rois.append(roi)

    if rois:
        return rois
    return [find_long_rect_roi(img_bgr)]


def _count_segments(mask_1d: np.ndarray, min_len: int) -> int:
    count = 0
    start = -1
    for i, v in enumerate(mask_1d):
        if v and start == -1:
            start = i
        if (not v) and start != -1:
            if i - start >= min_len:
                count += 1
            start = -1
    if start != -1 and len(mask_1d) - start >= min_len:
        count += 1
    return count


def estimate_zone_count(strip_bgr: np.ndarray) -> int:
    """Estimate count of reactive pads/zones on a strip."""
    strip_bgr = ensure_bgr(strip_bgr)
    h, w = strip_bgr.shape[:2]
    if h < 20 or w < 4:
        return 0

    x0 = int(w * 0.25)
    x1 = int(w * 0.75)
    y0 = int(h * 0.06)
    y1 = int(h * 0.94)
    core = strip_bgr[y0:y1, x0:x1].copy()
    if core.size == 0:
        return 0

    hsv = cv2.cvtColor(core, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    color_mask = ((sat > 25) & (val > 30) & ((val < 245) | (sat > 45))).astype(np.uint8)
    color_mask = cv2.morphologyEx(color_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    row_signal = np.mean(color_mask, axis=1)
    if row_signal.size == 0:
        return 0

    kernel = np.ones(9, dtype=np.float32) / 9.0
    smooth = np.convolve(row_signal, kernel, mode="same")
    thr = max(0.07, float(np.max(smooth) * 0.35))
    active = smooth > thr

    min_len = max(3, int(core.shape[0] * 0.03))
    count = _count_segments(active, min_len=min_len)

    # practical bounds for this domain
    return int(max(0, min(12, count)))


def split_into_zones(strip_bgr: np.ndarray, n_zones: int) -> List[np.ndarray]:
    """Split strip ROI into n zones along the long axis, excluding margins."""
    h, w = strip_bgr.shape[:2]
    # remove a bit of margins
    top = int(h * 0.12)
    bot = int(h * 0.88)
    left = int(w * 0.18)
    right = int(w * 0.82)
    core = strip_bgr[top:bot, left:right].copy()
    ch, cw = core.shape[:2]
    zones = []
    for i in range(n_zones):
        y0 = int(i * ch / n_zones)
        y1 = int((i + 1) * ch / n_zones)
        patch = core[y0:y1, :].copy()
        zones.append(patch)
    return zones


def median_lab(patch_bgr: np.ndarray) -> List[float]:
    lab = bgr_to_lab(patch_bgr)
    flat = lab.reshape(-1, 3)
    med = np.median(flat, axis=0)
    return [float(med[0]), float(med[1]), float(med[2])]


def extract_scale_palette(scale_path: Optional[str], k: int) -> List[Dict[str, Any]]:
    """Heuristic palette from scale image: take high-saturation pixels and cluster with kmeans.
    Returns clusters sorted by L.
    Labels are L1..Lk.
    """
    if not scale_path or not os.path.exists(scale_path):
        return []
    img = cv2.imread(scale_path)
    if img is None:
        return []
    img = ensure_bgr(img)
    img_small = cv2.resize(img, (0, 0), fx=0.5, fy=0.5)
    hsv = cv2.cvtColor(img_small, cv2.COLOR_BGR2HSV)
    # mask out near-white / low saturation
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    mask = (sat > 60) & (val > 40) & (val < 250)
    pixels = img_small[mask]
    if pixels.shape[0] < 500:
        # fallback: use all pixels but skip extremes
        pixels = img_small.reshape(-1, 3)

    # use OpenCV kmeans in BGR then convert centroids to LAB
    Z = np.float32(pixels.reshape(-1, 3))
    # cap to avoid huge memory
    if Z.shape[0] > 30000:
        idx = np.random.choice(Z.shape[0], 30000, replace=False)
        Z = Z[idx]

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    flags = cv2.KMEANS_PP_CENTERS
    compactness, labels, centers = cv2.kmeans(Z, k, None, criteria, 3, flags)
    centers = np.uint8(centers)
    centers_lab = cv2.cvtColor(centers.reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).reshape(-1, 3)

    palette = []
    for i in range(k):
        lab = centers_lab[i]
        palette.append({
            "label": f"L{i+1}",
            "lab": [float(lab[0]), float(lab[1]), float(lab[2])]
        })

    palette.sort(key=lambda x: x["lab"][0])
    # relabel after sorting
    for i, p in enumerate(palette):
        p["label"] = f"L{i+1}"
    return palette


def match_to_palette(zone_lab: List[float], palette: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not palette:
        return {"label": None, "delta_e": None}
    z = np.array(zone_lab, dtype=np.float32)
    best = None
    best_d = 1e9
    for p in palette:
        pl = np.array(p["lab"], dtype=np.float32)
        d = float(np.linalg.norm(z - pl))
        if d < best_d:
            best_d = d
            best = p
    return {"label": best["label"], "delta_e": round(best_d, 2)}


def analyze_strip(path: str, scale_type: str, palette: List[Dict[str, Any]], n_zones: int) -> Dict[str, Any]:
    img = cv2.imread(path)
    if img is None:
        return {"id": os.path.basename(path), "filename": safe_basename(path), "error": "Failed to read image"}
    roi = find_long_rect_roi(img)
    zones = split_into_zones(roi, n_zones)
    out_zones = []
    for i, z in enumerate(zones, start=1):
        lab = median_lab(z)
        nearest = match_to_palette(lab, palette)
        out_zones.append({
            "index": i,
            "mean_lab": [round(lab[0], 2), round(lab[1], 2), round(lab[2], 2)],
            "nearest": nearest
        })
    return {
        "id": os.path.basename(path),
        "filename": safe_basename(path),
        "scale_type": scale_type,
        "zones": out_zones
    }


def detect_scale_profile(scale_path: Optional[str], fallback_count: int, profile_id: str) -> Optional[Dict[str, Any]]:
    if not scale_path or not os.path.exists(scale_path):
        return None
    img = cv2.imread(scale_path)
    if img is None:
        return None

    # Try to infer strip count from reference strip printed on package.
    scale_rois = find_strip_rois(img)
    counts = [estimate_zone_count(roi) for roi in scale_rois]
    counts = [c for c in counts if c > 0]
    inferred = max(counts, key=counts.count) if counts else fallback_count
    if inferred <= 0:
        inferred = fallback_count

    palette_k = 8 if inferred <= 2 else 10 if inferred <= 5 else 12
    palette = extract_scale_palette(scale_path, k=palette_k)
    return {
        "id": profile_id,
        "count": int(inferred),
        "palette": palette,
        "filename": safe_basename(scale_path),
        "k": palette_k,
    }


def pick_scale_profile(zone_count: int, profiles: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not profiles:
        return None
    if zone_count <= 0:
        # If strip count could not be detected, prefer the smallest scale.
        return sorted(profiles, key=lambda p: p.get("count", 999))[0]
    return min(profiles, key=lambda p: abs(int(p.get("count", 0)) - zone_count))


def analyze_photo_with_auto_mapping(path: str, source_group: str, profiles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    img = cv2.imread(path)
    if img is None:
        return [{
            "id": os.path.basename(path),
            "filename": safe_basename(path),
            "error": "Failed to read image",
            "source_group": source_group,
        }]

    rois = find_strip_rois(img)
    out_items: List[Dict[str, Any]] = []

    for idx, roi in enumerate(rois, start=1):
        detected_count = estimate_zone_count(roi)
        profile = pick_scale_profile(detected_count, profiles)

        matched_count = int(profile.get("count", 0)) if profile else 0
        n_zones = matched_count if matched_count > 0 else (detected_count if detected_count > 0 else 2)
        palette = profile.get("palette", []) if profile else []
        scale_id = profile.get("id") if profile else None

        zones = split_into_zones(roi, n_zones)
        out_zones = []
        for zone_i, zone_patch in enumerate(zones, start=1):
            lab = median_lab(zone_patch)
            nearest = match_to_palette(lab, palette)
            out_zones.append({
                "index": zone_i,
                "mean_lab": [round(lab[0], 2), round(lab[1], 2), round(lab[2], 2)],
                "nearest": nearest
            })

        out_items.append({
            "id": f"{os.path.basename(path)}#{idx}",
            "filename": safe_basename(path),
            "strip_index": idx,
            "source_group": source_group,
            "detected_zone_count": int(detected_count),
            "matched_scale_count": int(n_zones),
            "matched_scale_id": scale_id,
            "scale_type": f"{n_zones}-zones",
            "zones": out_zones,
        })

    return out_items


def ocr_image(path: str) -> Dict[str, Any]:
    img = cv2.imread(path)
    if img is None:
        return {"id": os.path.basename(path), "filename": safe_basename(path), "text": "", "error": "Failed to read image"}
    warning = None
    text = ""
    if not _HAVE_TESS:
        warning = "pytesseract не установлен. Установите requirements и системный tesseract."
    else:
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
            text = pytesseract.image_to_string(gray, lang="rus+eng")
        except Exception as e:
            warning = f"OCR ошибка: {e}"
    return {
        "id": os.path.basename(path),
        "filename": safe_basename(path),
        "text": text.strip(),
        "warning": warning
    }


def main():
    payload = read_stdin_json()

    scale2_path = payload.get("scale2")
    scale5_path = payload.get("scale5")
    scale_profiles = []
    p2 = detect_scale_profile(scale2_path, fallback_count=2, profile_id="scale2")
    if p2:
        scale_profiles.append(p2)
    p5 = detect_scale_profile(scale5_path, fallback_count=5, profile_id="scale5")
    if p5:
        scale_profiles.append(p5)

    rest_items = []
    load_items = []

    rest_paths = []
    rest_paths.extend(payload.get("rest", []) or [])
    rest_paths.extend(payload.get("rest2", []) or [])
    rest_paths.extend(payload.get("rest5", []) or [])

    load_paths = []
    load_paths.extend(payload.get("load", []) or [])
    load_paths.extend(payload.get("load2", []) or [])
    load_paths.extend(payload.get("load5", []) or [])

    for p in rest_paths:
        rest_items.extend(analyze_photo_with_auto_mapping(p, "rest", scale_profiles))

    for p in load_paths:
        load_items.extend(analyze_photo_with_auto_mapping(p, "load", scale_profiles))

    ocr_items = []
    for p in payload.get("text", []) or []:
        ocr_items.append(ocr_image(p))

    # workout photos are stored but not analyzed in MVP (can be used later)
    out = {
        "ok": True,
        "meta": {
            "session_id": payload.get("session_id"),
            "scale2": safe_basename(scale2_path) if scale2_path else None,
            "scale5": safe_basename(scale5_path) if scale5_path else None,
            "scale_profiles": [
                {
                    "id": p.get("id"),
                    "count": p.get("count"),
                    "filename": p.get("filename"),
                    "palette_size": len(p.get("palette", [])),
                }
                for p in scale_profiles
            ],
            "note": "MVP 0.2: авто-определение количества зон на шкале и на полоске с сопоставлением к ближайшей шкале."
        },
        "rest": {"items": rest_items},
        "load": {"items": load_items},
        "ocr": {"items": ocr_items}
    }

    sys.stdout.write(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
