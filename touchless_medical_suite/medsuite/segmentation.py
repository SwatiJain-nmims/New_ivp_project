"""Unit 6: Otsu thresholding, region growing, region splitting & merging (all from scratch)."""
from collections import deque
import numpy as np
import cv2


def otsu_threshold(img, mask=None):
    """Otsu's method: maximise between-class variance. `mask` limits the histogram (ROI-Otsu)."""
    vals = img[mask] if mask is not None else img.ravel()
    if vals.size == 0:
        return 128
    p = np.bincount(vals.ravel(), minlength=256).astype(np.float64)
    p /= p.sum()
    omega = np.cumsum(p)
    mu = np.cumsum(p * np.arange(256))
    with np.errstate(divide="ignore", invalid="ignore"):
        sb = (mu[-1] * omega - mu) ** 2 / (omega * (1 - omega))
    if np.all(np.isnan(sb)):
        return 128
    return int(np.nanargmax(sb))


def otsu_binarize(img, offset=0, roi_otsu=True, bg_level=60, levels=1):
    """Returns (mask, threshold). With roi_otsu the background is excluded from the histogram,
    so Otsu separates tissue from lesion instead of body from air. levels=2 re-applies Otsu
    inside the bright class (multi-level) to isolate the brightest structures (lesions)."""
    roi = img > bg_level if roi_otsu else None
    t = int(np.clip(otsu_threshold(img, roi) + offset, 0, 255))
    mask = img > t
    if roi is not None:
        mask &= roi
    for _ in range(levels - 1):
        if not mask.any():
            break
        t = int(np.clip(otsu_threshold(img, mask) + offset, 0, 255))
        mask &= img > t
    return mask, t


def clean_mask(mask, open_k=3, close_k=5, min_area=30):
    """Morphological open/close + drop tiny components."""
    m = mask.astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_k, open_k)))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_k, close_k)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    out = np.zeros_like(m, bool)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            out |= lab == i
    return out


def region_growing(img, seed, tol=15, connectivity=8):
    """Seeded region growing. A pixel joins if it is within `tol` of the running region mean
    (and within 2*tol of the seed mean, which stops slow drift/leakage). seed=(x, y)."""
    h, w = img.shape
    sx, sy = int(np.clip(seed[0], 0, w - 1)), int(np.clip(seed[1], 0, h - 1))
    patch = img[max(sy - 1, 0):sy + 2, max(sx - 1, 0):sx + 2]
    seed_mean = float(patch.mean())
    total, count = seed_mean, 1
    mask = np.zeros((h, w), bool)
    visited = np.zeros((h, w), bool)
    mask[sy, sx] = visited[sy, sx] = True
    nbrs = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    if connectivity == 8:
        nbrs += [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    q = deque([(sy, sx)])
    while q:
        y, x = q.popleft()
        mean = total / count
        for dy, dx in nbrs:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                v = float(img[ny, nx])
                if abs(v - mean) <= tol and abs(v - seed_mean) <= 2 * tol:
                    mask[ny, nx] = True
                    total += v
                    count += 1
                    q.append((ny, nx))
    return mask


def split_and_merge(img, min_size=8, split_std=6.0, merge_thresh=10.0):
    """Quad-tree split (std > split_std) followed by merging of adjacent regions whose
    means differ by <= merge_thresh. Returns (label_map, mean_image)."""
    h, w = img.shape
    n = 1 << int(np.ceil(np.log2(max(h, w))))
    pad = np.pad(img, ((0, n - h), (0, n - w)), mode="edge").astype(np.float32)
    labels = np.zeros((n, n), np.int32)
    sums, counts = [], []

    def split(y, x, s):
        blk = pad[y:y + s, x:x + s]
        if s <= min_size or blk.std() <= split_std:
            labels[y:y + s, x:x + s] = len(sums)
            sums.append(float(blk.sum()))
            counts.append(s * s)
        else:
            k = s // 2
            for dy in (0, k):
                for dx in (0, k):
                    split(y + dy, x + dx, k)

    split(0, 0, n)
    parent = list(range(len(sums)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    pairs = np.concatenate([
        np.stack([labels[:, :-1].ravel(), labels[:, 1:].ravel()], 1),
        np.stack([labels[:-1, :].ravel(), labels[1:, :].ravel()], 1)])
    pairs = np.unique(pairs[pairs[:, 0] != pairs[:, 1]], axis=0)
    means0 = np.array(sums) / np.array(counts)
    order = np.argsort(np.abs(means0[pairs[:, 0]] - means0[pairs[:, 1]]))
    for i in order:
        a, b = find(int(pairs[i, 0])), find(int(pairs[i, 1]))
        if a != b and abs(sums[a] / counts[a] - sums[b] / counts[b]) <= merge_thresh:
            parent[b] = a
            sums[a] += sums[b]
            counts[a] += counts[b]
    roots = np.array([find(i) for i in range(len(sums))])
    uniq, new = np.unique(roots, return_inverse=True)
    lab = new[labels][:h, :w].astype(np.int32)
    means = np.array([sums[r] / counts[r] for r in uniq], np.float32)
    return lab, means[lab].astype(np.uint8)
