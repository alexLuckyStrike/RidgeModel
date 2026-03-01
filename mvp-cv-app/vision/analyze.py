#!/usr/bin/env python3
import sys, json, os, re, math
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional

import numpy as np

try:
    import cv2
except Exception as e:
    print(json.dumps({"ok": False, "error": f"OpenCV not installed: {e}"}))
    sys.exit(1)

# OCR is optional — requires both pytesseract module AND tesseract binary
try:
    import pytesseract
    pytesseract.get_tesseract_version()  # raises if tesseract binary not in PATH
    _HAVE_TESS = True
except Exception:
    pytesseract = None
    _HAVE_TESS = False


def read_stdin_json() -> Dict[str, Any]:
    raw = sys.stdin.read()
    return json.loads(raw) if raw else {}


def safe_basename(p: str) -> str:
    return os.path.basename(p) if p else ""


def file_ext(p: str) -> str:
    return os.path.splitext(p)[1].lower() if p else ""


def read_text_file_loose(path: str) -> str:
    for enc in ("utf-8", "utf-8-sig", "cp1251", "windows-1251"):
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except Exception:
            continue
    with open(path, "rb") as f:
        return f.read().decode("utf-8", errors="replace")


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


def tighten_strip_roi(roi_bgr: np.ndarray) -> np.ndarray:
    """Crop a candidate elongated ROI closer to the actual strip body."""
    roi_bgr = ensure_bgr(roi_bgr)
    if roi_bgr is None or roi_bgr.size == 0:
        return roi_bgr
    h, w = roi_bgr.shape[:2]
    if h < 20 or w < 8:
        return roi_bgr

    hsv = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2LAB)
    sat = hsv[:, :, 1].astype(np.float32)
    val = hsv[:, :, 2].astype(np.float32)
    a = lab[:, :, 1].astype(np.float32) - 128.0
    b = lab[:, :, 2].astype(np.float32) - 128.0
    chroma = np.sqrt(a * a + b * b)

    colorish = ((sat > 18) | (chroma > 7)).astype(np.float32)
    not_bg = ((val < 248) | colorish.astype(bool)).astype(np.float32)
    col_signal = np.mean((0.7 * colorish + 0.3 * not_bg), axis=0)
    if col_signal.size == 0:
        return roi_bgr

    # Smooth x-profile and pick dominant band.
    kx = max(5, int(w * 0.08) | 1)
    col_smooth = cv2.GaussianBlur(col_signal.reshape(1, -1), (kx, 1), 0).reshape(-1)
    peak_idx = int(np.argmax(col_smooth))
    thr_x = max(0.03, float(np.max(col_smooth) * 0.45))
    active_x = col_smooth > thr_x
    x0 = peak_idx
    x1 = peak_idx
    while x0 > 0 and active_x[x0 - 1]:
        x0 -= 1
    while x1 + 1 < w and active_x[x1 + 1]:
        x1 += 1
    pad_x = max(2, int((x1 - x0 + 1) * 0.6))
    x0 = max(0, x0 - pad_x)
    x1 = min(w, x1 + pad_x + 1)
    # Prevent very wide crops that re-introduce napkin/background noise.
    band_w = x1 - x0
    max_band_w = max(18, int(w * 0.35))
    if band_w > max_band_w:
        cx = peak_idx
        x0 = max(0, int(cx - max_band_w / 2))
        x1 = min(w, int(cx + max_band_w / 2))
        if x1 <= x0:
            x0, x1 = 0, w

    cropped = roi_bgr[:, x0:x1].copy()
    if cropped.size == 0:
        return roi_bgr

    # Trim top/bottom using row activity inside narrowed x-band.
    hsv2 = cv2.cvtColor(cropped, cv2.COLOR_BGR2HSV)
    sat2 = hsv2[:, :, 1].astype(np.float32)
    val2 = hsv2[:, :, 2].astype(np.float32)
    row_signal = np.mean(((sat2 > 18) | (val2 < 248)).astype(np.float32), axis=1)
    ky = max(5, int(cropped.shape[0] * 0.03) | 1)
    row_smooth = cv2.GaussianBlur(row_signal.reshape(-1, 1), (1, ky), 0).reshape(-1)
    thr_y = max(0.02, float(np.max(row_smooth) * 0.35))
    active_y = row_smooth > thr_y
    ys = np.where(active_y)[0]
    if ys.size > 0:
        y0 = max(0, int(ys[0]) - max(4, int(0.02 * h)))
        y1 = min(h, int(ys[-1]) + max(4, int(0.02 * h)) + 1)
        cropped = cropped[y0:y1, :].copy()

    return cropped if cropped.size > 0 else roi_bgr


def find_strip_rois(img_bgr: np.ndarray) -> List[np.ndarray]:
    """Find multiple strip-like ROIs in one image.
    Returns vertical ROIs sorted left->right. Falls back to one ROI.
    """
    img_bgr = ensure_bgr(img_bgr)
    h, w = img_bgr.shape[:2]

    # First pass: find aligned colored pads and expand them into strip ROIs.
    # Works much better on real photos with napkin textures than edge-only contours.
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    color_mask = ((sat > 28) & (val > 35) & (val < 250)).astype(np.uint8) * 255
    color_mask = cv2.morphologyEx(color_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    color_mask = cv2.morphologyEx(color_mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))

    contours_color, _ = cv2.findContours(color_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    pad_boxes: List[Tuple[int, int, int, int]] = []
    img_area = max(1, h * w)
    for c in contours_color:
        x, y, cw, ch = cv2.boundingRect(c)
        area = cw * ch
        if area < 0.00008 * img_area:
            continue
        if area > 0.02 * img_area:
            continue
        if min(cw, ch) < 6:
            continue
        # pads are usually compact-ish rectangles, not long edges
        ar = max(cw, ch) / (min(cw, ch) + 1e-6)
        if ar > 6.0:
            continue
        pad_boxes.append((x, y, cw, ch))

    if pad_boxes:
        pad_boxes.sort(key=lambda b: b[0] + b[2] * 0.5)
        groups: List[List[Tuple[int, int, int, int]]] = []
        for box in pad_boxes:
            x, y, cw, ch = box
            cx = x + cw / 2.0
            assigned = False
            for g in groups:
                g_centers = [gx + gw / 2.0 for gx, gy, gw, gh in g]
                g_widths = [gw for gx, gy, gw, gh in g]
                g_cx = float(np.median(g_centers))
                tol = max(18.0, float(np.median(g_widths)) * 1.8)
                if abs(cx - g_cx) <= tol:
                    g.append(box)
                    assigned = True
                    break
            if not assigned:
                groups.append([box])

        candidate_boxes: List[Tuple[int, int, int, int, int]] = []
        for g in groups:
            if len(g) < 2:
                continue
            xs = [b[0] for b in g]
            ys = [b[1] for b in g]
            x2s = [b[0] + b[2] for b in g]
            y2s = [b[1] + b[3] for b in g]
            widths = [b[2] for b in g]
            heights = [b[3] for b in g]
            span_y = max(y2s) - min(ys)
            med_h = float(np.median(heights)) if heights else 1.0
            if med_h <= 0:
                continue
            # Reject accidental groups with huge gaps (common on textured napkins).
            if (span_y / med_h) > max(18.0, 10.0 * len(g)):
                continue

            x0 = max(0, int(min(xs) - max(widths) * 1.6))
            x1 = min(w, int(max(x2s) + max(widths) * 1.6))
            y0 = max(0, int(min(ys) - np.median(heights) * 2.0))
            y1 = min(h, int(max(y2s) + np.median(heights) * 2.0))
            bw = x1 - x0
            bh = y1 - y0
            if bw <= 0 or bh <= 0:
                continue
            if max(bw, bh) / (min(bw, bh) + 1e-6) < 3.0:
                continue
            # Filter obvious scale-package palette grids and broad blobs.
            if min(bw, bh) > 0.14 * min(w, h):
                continue
            if max(bw, bh) < 0.12 * max(w, h):
                continue
            candidate_boxes.append((x0, y0, bw, bh, len(g)))

        # Prefer groups with more pads and reasonable elongated boxes, then deduplicate.
        candidate_boxes.sort(
            key=lambda b: (b[4], (b[2] * b[3])), reverse=True
        )
        picked_boxes: List[Tuple[int, int, int, int, int]] = []
        for box in candidate_boxes:
            cur = (box[0], box[1], box[2], box[3])
            if any(_box_iou(cur, (p[0], p[1], p[2], p[3])) > 0.35 for p in picked_boxes):
                continue
            picked_boxes.append(box)

        picked_boxes.sort(key=lambda b: b[0])
        rois_from_pads: List[np.ndarray] = []
        for x, y, cw, ch, _ in picked_boxes:
            roi = img_bgr[y:y + ch, x:x + cw].copy()
            if roi.size == 0:
                continue
            if roi.shape[1] > roi.shape[0]:
                roi = cv2.rotate(roi, cv2.ROTATE_90_CLOCKWISE)
            roi = tighten_strip_roi(roi)
            # Final sanity: must contain at least 2 likely zones for multi-strip mode.
            zc = estimate_zone_count(roi)
            if zc >= 2:
                rois_from_pads.append(roi)

        if len(rois_from_pads) >= 2:
            return rois_from_pads

    # Fallback: edge-based contour search
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 40, 130)
    edges = cv2.dilate(edges, None, iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    raw_boxes: List[Tuple[int, int, int, int, int]] = []
    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        area = cw * ch
        if area < 0.0025 * img_area:
            continue
        long_side = max(cw, ch)
        short_side = min(cw, ch)
        if long_side < 0.30 * max(w, h):
            continue
        if short_side > 0.20 * min(w, h):
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
        roi = tighten_strip_roi(roi)
        # Suppress obvious napkin/edge artifacts.
        if estimate_zone_count(roi) < 1:
            continue
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
    lab = cv2.cvtColor(core, cv2.COLOR_BGR2LAB)
    a = lab[:, :, 1].astype(np.int16) - 128
    b = lab[:, :, 2].astype(np.int16) - 128
    chroma = np.sqrt(a * a + b * b)
    color_mask = (
        ((sat > 22) & (val > 28) & (val < 248))
        | (chroma > 8)
    ).astype(np.uint8)
    color_mask = cv2.morphologyEx(color_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    color_mask = cv2.morphologyEx(color_mask, cv2.MORPH_CLOSE, np.ones((5, 3), np.uint8))

    row_signal = np.mean(color_mask, axis=1)
    if row_signal.size == 0:
        return 0

    kernel = np.ones(11, dtype=np.float32) / 11.0
    smooth = np.convolve(row_signal, kernel, mode="same")
    thr = max(0.055, float(np.max(smooth) * 0.28))
    active = smooth > thr

    min_len = max(3, int(core.shape[0] * 0.02))
    count = _count_segments(active, min_len=min_len)
    # Merge over-splitting caused by tiny white gaps inside wet pads.
    if count > 0:
        active_u8 = active.astype(np.uint8)
        active_u8 = cv2.morphologyEx(active_u8.reshape(-1, 1), cv2.MORPH_CLOSE, np.ones((5, 1), np.uint8)).reshape(-1)
        count = min(count, _count_segments(active_u8 > 0, min_len=min_len))

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
        # Numeric axis for interpolation (ordinal when real concentrations are unknown).
        p["value"] = float(i + 1)
    return palette


def lab_to_rgb(lab: List[float]) -> List[int]:
    """Convert OpenCV LAB values to RGB [0-255]."""
    lab_px = np.array([[[lab[0], lab[1], lab[2]]]], dtype=np.uint8)
    bgr = cv2.cvtColor(lab_px, cv2.COLOR_LAB2BGR)
    r, g, b = int(bgr[0, 0, 2]), int(bgr[0, 0, 1]), int(bgr[0, 0, 0])
    return [r, g, b]


def ocr_zone(zone_bgr: np.ndarray) -> Dict[str, Any]:
    """Run OCR on a single zone patch. Returns text, confidence, bbox."""
    if not _HAVE_TESS:
        return {"text": None, "text_confidence": None, "text_bbox": None}
    try:
        # Upscale small zones for better OCR
        h, w = zone_bgr.shape[:2]
        scale_up = max(1.0, 80.0 / max(h, w))
        if scale_up > 1.0:
            zone_bgr = cv2.resize(zone_bgr, (0, 0), fx=scale_up, fy=scale_up,
                                  interpolation=cv2.INTER_CUBIC)

        gray = cv2.cvtColor(zone_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

        data = pytesseract.image_to_data(
            gray, lang="rus+eng",
            output_type=pytesseract.Output.DICT
        )

        words = []
        confidences = []
        bboxes = []
        for i, word in enumerate(data["text"]):
            conf = int(data["conf"][i])
            if conf > 30 and word.strip():
                words.append(word.strip())
                confidences.append(conf / 100.0)
                bboxes.append([
                    int(data["left"][i]), int(data["top"][i]),
                    int(data["width"][i]), int(data["height"][i])
                ])

        if not words:
            return {"text": None, "text_confidence": None, "text_bbox": None}

        text = " ".join(words)
        avg_conf = float(sum(confidences) / len(confidences))
        # union bbox
        xs = [b[0] for b in bboxes]
        ys = [b[1] for b in bboxes]
        x2s = [b[0] + b[2] for b in bboxes]
        y2s = [b[1] + b[3] for b in bboxes]
        bbox = [min(xs), min(ys), max(x2s) - min(xs), max(y2s) - min(ys)]

        return {
            "text": text,
            "text_confidence": round(avg_conf, 2),
            "text_bbox": bbox
        }
    except Exception as e:
        return {"text": None, "text_confidence": None, "text_bbox": None}


def extract_scale_zones(scale_path: Optional[str], n_zones: int) -> List[Dict[str, Any]]:
    """Segment scale image into zones, extract colors and OCR text per zone.

    Args:
        scale_path: path to scale image (scale2 or scale5)
        n_zones: number of zones to split into (2 or 5)

    Returns:
        list of zone dicts with: zone_index, label, rgb, lab, text, text_confidence, text_bbox
    """
    if not scale_path or not os.path.exists(scale_path):
        return []

    img = cv2.imread(scale_path)
    if img is None:
        return []

    img = ensure_bgr(img)

    # Find the scale ROI (long rectangle)
    roi = find_long_rect_roi(img)

    # Split into zones
    patches = split_into_zones(roi, n_zones)

    zones = []
    for i, patch in enumerate(patches, start=1):
        if patch.size == 0:
            continue

        # Extract color in LAB space
        lab = median_lab(patch)

        # Convert LAB → RGB for display
        rgb = lab_to_rgb(lab)

        # OCR on this zone patch
        ocr = ocr_zone(patch)

        zones.append({
            "zone_index": i,
            "label": f"L{i}",
            "rgb": rgb,
            "lab": [round(lab[0], 2), round(lab[1], 2), round(lab[2], 2)],
            "text": ocr.get("text"),
            "text_confidence": ocr.get("text_confidence"),
            "text_bbox": ocr.get("text_bbox"),
        })

    return zones


LEVEL_VALUES: Dict[str, Dict[str, float]] = {
    # URI-2 MAK (креатинин, ммоль/л)
    "creatinine": {
        "L1": 0.9,
        "L2": 1.8,
        "L3": 4.4,
        "L4": 8.8,
        "L5": 17.7,
        "L6": 26.5,
        "L7": 26.5,
    },
    # URI-2 MAK (альбумин, г/л)
    "albumin": {
        "L1": 0.01,
        "L2": 0.03,
        "L3": 0.08,
        "L4": 0.15,
        "L5": 0.3,
        "L6": 1.0,
        "L7": 5.0,
    },
    # URI-5A (кровь/гемоглобин/миоглобин, эр/мкл)
    "hb_myoglobin": {
        "L1": 0.0,
        "L2": 10.0,
        "L3": 25.0,
        "L4": 50.0,
        "L5": 250.0,
        "L6": 250.0,
    },
    # URI-5A (кетоны, ммоль/л)
    "ketones": {
        "L1": 0.0,
        "L2": 0.5,
        "L3": 1.5,
        "L4": 4.0,
        "L5": 8.0,
        "L6": 16.0,
    },
    # URI-5A (белок, г/л)
    "protein": {
        "L1": 0.0,
        "L2": 0.1,
        "L3": 0.3,
        "L4": 1.0,
        "L5": 3.0,
        "L6": 10.0,
    },
    # URI-5A (глюкоза, ммоль/л)
    "glucose": {
        "L1": 0.0,
        "L2": 2.8,
        "L3": 5.6,
        "L4": 14.0,
        "L5": 28.0,
        "L6": 56.0,
    },
    # URI-5A (pH)
    "ph": {
        "L1": 5.0,
        "L2": 6.0,
        "L3": 6.5,
        "L4": 7.0,
        "L5": 8.0,
        "L6": 9.0,
    },
}

ANALYTE_UNITS: Dict[str, str] = {
    "creatinine": "ммоль/л",
    "albumin": "г/л",
    "hb_myoglobin": "эр/мкл",
    "ketones": "ммоль/л",
    "protein": "г/л",
    "glucose": "ммоль/л",
    "ph": "pH",
}

ANALYTE_ROUNDING: Dict[str, int] = {
    "creatinine": 2,
    "albumin": 3,
    "hb_myoglobin": 0,
    "ketones": 2,
    "protein": 2,
    "glucose": 2,
    "ph": 1,
}


def log_interp(v1: float, v2: float, t: float) -> float:
    if v1 <= 0.0 or v2 <= 0.0:
        return v1 + (v2 - v1) * t
    return 10 ** (math.log10(v1) + (math.log10(v2) - math.log10(v1)) * t)


def get_analyte_zone_map(scale_id: Optional[str], n_zones: int) -> Dict[int, str]:
    # Mapping by known strip type in this MVP.
    if scale_id == "scale2" or n_zones == 2:
        return {
            1: "creatinine",
            2: "albumin",
        }
    if scale_id == "scale5" or n_zones == 5:
        # URI-5A: 5 зон. Индексы соответствуют текущему порядку split_into_zones.
        return {
            1: "hb_myoglobin",
            2: "ketones",
            3: "protein",
            4: "glucose",
            5: "ph",
        }
    return {}


def interpolate_numeric_from_nearest(nearest: Dict[str, Any], analyte: str) -> Optional[float]:
    levels = LEVEL_VALUES.get(analyte)
    if not levels:
        return None

    neighbors = nearest.get("neighbors") or []
    if not isinstance(neighbors, list) or len(neighbors) < 1:
        label = nearest.get("label")
        return float(levels.get(label)) if label in levels else None

    n1 = neighbors[0] if len(neighbors) > 0 else {}
    n2 = neighbors[1] if len(neighbors) > 1 else None
    l1 = n1.get("label")
    d1 = float(n1.get("delta_e", 1e9))
    v1 = levels.get(l1)
    if v1 is None:
        return None

    if not n2:
        return float(v1)
    l2 = n2.get("label")
    d2 = float(n2.get("delta_e", 1e9))
    v2 = levels.get(l2)
    if v2 is None:
        return float(v1)

    eps = 1e-6
    w1 = 1.0 / (d1 + eps)
    w2 = 1.0 / (d2 + eps)
    t = w2 / max(eps, (w1 + w2))
    t = float(max(0.0, min(1.0, t)))

    v_low, v_high = (float(v1), float(v2)) if v1 <= v2 else (float(v2), float(v1))
    if v1 > v2:
        t = 1.0 - t

    return float(log_interp(v_low, v_high, t))


def match_to_palette(zone_lab: List[float], palette: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not palette:
        return {
            "label": None,
            "delta_e": None,
            "interpolated_value": None,
            "interpolation": None,
        }
    z = np.array(zone_lab, dtype=np.float32)
    dists: List[Tuple[float, Dict[str, Any]]] = []
    for p in palette:
        pl = np.array(p["lab"], dtype=np.float32)
        d = float(np.linalg.norm(z - pl))
        dists.append((d, p))

    dists.sort(key=lambda x: x[0])
    d1, p1 = dists[0]
    if len(dists) < 2:
        return {
            "label": p1.get("label"),
            "delta_e": round(float(d1), 2),
            "interpolated_value": p1.get("value"),
            "interpolation": "none",
        }

    d2, p2 = dists[1]

    # Soft nearest-neighbor weight towards the second neighbor.
    eps = 1e-6
    w1 = 1.0 / (d1 + eps)
    w2 = 1.0 / (d2 + eps)
    t = w2 / max(eps, (w1 + w2))
    t = float(max(0.0, min(1.0, t)))

    v1 = float(p1.get("value", 0.0))
    v2 = float(p2.get("value", 0.0))
    v_low, v_high = (v1, v2) if v1 <= v2 else (v2, v1)
    t_adj = t if v1 <= v2 else (1.0 - t)
    t_adj = float(max(0.0, min(1.0, t_adj)))

    if v_low > 0.0 and v_high > 0.0:
        interpolated = 10 ** (math.log10(v_low) + (math.log10(v_high) - math.log10(v_low)) * t_adj)
        interpolation = "log10"
    else:
        interpolated = v_low + (v_high - v_low) * t_adj
        interpolation = "linear_fallback"

    return {
        "label": p1.get("label"),
        "delta_e": round(float(d1), 2),
        "interpolated_value": round(float(interpolated), 4),
        "interpolation": interpolation,
        "neighbors": [
            {
                "label": p1.get("label"),
                "value": v1,
                "delta_e": round(float(d1), 2),
            },
            {
                "label": p2.get("label"),
                "value": v2,
                "delta_e": round(float(d2), 2),
            },
        ],
    }


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
    # Scale package photos are noisy; keep known expected count when detection is implausible.
    if fallback_count in (2, 5) and inferred != fallback_count:
        inferred = fallback_count
    elif inferred < 2 or abs(inferred - fallback_count) > 2:
        inferred = fallback_count

    if profile_id == "scale2":
        palette_k = 7
    elif profile_id == "scale5":
        palette_k = 6
    else:
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


def _roi_transition_score(roi: np.ndarray, n_zones: int) -> float:
    if roi is None or roi.size == 0 or n_zones <= 1:
        return 0.0
    patches = split_into_zones(roi, n_zones)
    if len(patches) < 2:
        return 0.0
    labs = [np.array(median_lab(p), dtype=np.float32) for p in patches if p is not None and p.size > 0]
    if len(labs) < 2:
        return 0.0
    diffs = [float(np.linalg.norm(labs[i] - labs[i + 1])) for i in range(len(labs) - 1)]
    if not diffs:
        return 0.0
    # Mean adjacent color contrast; higher usually means more real pads captured.
    return float(sum(diffs) / len(diffs))


def _roi_palette_avg_delta(roi: np.ndarray, profile: Optional[Dict[str, Any]]) -> Optional[float]:
    if profile is None:
        return None
    n = int(profile.get("count", 0) or 0)
    if n <= 0:
        return None
    palette = profile.get("palette", []) or []
    patches = split_into_zones(roi, n)
    deltas: List[float] = []
    for p in patches:
        if p is None or p.size == 0:
            continue
        m = match_to_palette(median_lab(p), palette)
        d = m.get("delta_e")
        if d is not None:
            deltas.append(float(d))
    if not deltas:
        return None
    return float(sum(deltas) / len(deltas))


def choose_profile_for_roi(roi: np.ndarray, detected_count: int, profiles: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not profiles:
        return None

    scored: List[Tuple[float, float, float, int, Dict[str, Any]]] = []
    for p in profiles:
        n = int(p.get("count", 0) or 0)
        if n <= 0:
            continue
        transition = _roi_transition_score(roi, n)
        avg_de = _roi_palette_avg_delta(roi, p)
        palette_bonus = 0.0 if avg_de is None else (-0.02 * avg_de)
        count_penalty = 0.0 if detected_count <= 0 else (0.15 * abs(n - detected_count))
        total = transition + palette_bonus - count_penalty
        # Tuple ordering: total desc, transition desc, avg_de asc, smaller count diff
        scored.append((total, transition, (avg_de if avg_de is not None else 9999.0), abs(n - detected_count), p))

    if not scored:
        return pick_scale_profile(detected_count, profiles)

    scored.sort(key=lambda x: (-x[0], -x[1], x[2], x[3]))
    return scored[0][4]


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
        profile = choose_profile_for_roi(roi, detected_count, profiles)

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

        zone_map = get_analyte_zone_map(scale_id, n_zones)
        final_results: Dict[str, float] = {}
        for z in out_zones:
            analyte = zone_map.get(int(z.get("index", 0)))
            if not analyte:
                continue
            numeric = interpolate_numeric_from_nearest(z.get("nearest", {}), analyte)
            if numeric is None:
                continue
            precision = ANALYTE_ROUNDING.get(analyte, 2)
            final_results[analyte] = round(float(numeric), precision)

        out_items.append({
            "id": f"{os.path.basename(path)}#{idx}",
            "filename": safe_basename(path),
            "strip_index": idx,
            "source_group": source_group,
            "results": final_results,
            "units": {k: ANALYTE_UNITS.get(k) for k in final_results.keys()},
        })

    return out_items


def ocr_image(path: str) -> Dict[str, Any]:
    ext = file_ext(path)
    if ext in {".txt", ".md", ".csv"}:
        try:
            text = read_text_file_loose(path)
            return {
                "id": os.path.basename(path),
                "filename": safe_basename(path),
                "text": text.strip(),
                "warning": None
            }
        except Exception as e:
            return {
                "id": os.path.basename(path),
                "filename": safe_basename(path),
                "text": "",
                "warning": f"Text read error: {e}"
            }

    img = cv2.imread(path)
    if img is None:
        return {"id": os.path.basename(path), "filename": safe_basename(path), "text": "", "error": "Failed to read image"}
    warning = None
    text = ""
    if not _HAVE_TESS:
        warning = "pytesseract не установлен. Установите requirements и системный tesseract."
    else:
        try:
            candidates: List[np.ndarray] = []
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            candidates.append(gray)

            # Center crop variant helps with screen photos where UI occupies middle region.
            h, w = gray.shape[:2]
            cx0, cx1 = int(w * 0.12), int(w * 0.88)
            cy0, cy1 = int(h * 0.06), int(h * 0.96)
            if cx1 > cx0 and cy1 > cy0:
                candidates.append(gray[cy0:cy1, cx0:cx1])

            best_text = ""
            best_score = -1.0
            seen_shapes = set()

            for base in candidates:
                if base.size == 0:
                    continue
                for upscale in (1.0, 1.8):
                    proc = base
                    if upscale > 1.0:
                        proc = cv2.resize(proc, (0, 0), fx=upscale, fy=upscale, interpolation=cv2.INTER_CUBIC)
                    proc = cv2.fastNlMeansDenoising(proc, None, 10, 7, 21)
                    proc = cv2.equalizeHist(proc)
                    variants = [
                        proc,
                        cv2.threshold(proc, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1],
                        cv2.adaptiveThreshold(proc, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                              cv2.THRESH_BINARY, 31, 11),
                    ]
                    for v in variants:
                        key = (v.shape[0], v.shape[1], int(np.mean(v)))
                        if key in seen_shapes:
                            continue
                        seen_shapes.add(key)
                        for psm in (6, 11):
                            try:
                                cfg = f"--oem 3 --psm {psm}"
                                t = pytesseract.image_to_string(v, lang="rus+eng", config=cfg).strip()
                            except Exception:
                                continue
                            if not t:
                                continue
                            # Score: prefer longer text with more letters/numbers.
                            alnum = len(re.findall(r"[A-Za-zА-Яа-я0-9]", t))
                            score = alnum + len(t) * 0.2
                            if score > best_score:
                                best_score = score
                                best_text = t
            text = best_text
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
    for p in payload.get("workout", []) or []:
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
                    "zones": extract_scale_zones(
                        scale2_path if p.get("id") == "scale2" else scale5_path,
                        p.get("count", 2)
                    ),
                }
                for p in scale_profiles
            ],
            "note": "MVP 0.3: улучшено распознавание полосок на реальных фото, чтение .txt и OCR фото тренировки."
        },
        "rest": {"items": rest_items},
        "load": {"items": load_items},
        "ocr": {"items": ocr_items}
    }

    sys.stdout.write(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
