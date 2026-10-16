"""Units 4 & 5: LoG, Canny, grayscale/binary morphology, boundary extraction, watershed."""
import numpy as np
import cv2


def log_response(img, sigma=1.5):
    g = cv2.GaussianBlur(img.astype(np.float32), (0, 0), sigma)
    return cv2.Laplacian(g, cv2.CV_32F, ksize=3)


def log_sharpen(img, sigma=1.5, k=1.5):
    """g = f - k*LoG(f) (kernel has negative centre). Boosts lesion edges."""
    r = log_response(img, sigma)
    return np.clip(img.astype(np.float32) - k * (sigma ** 2) * r, 0, 255).astype(np.uint8)


def log_zero_crossings(img, sigma=1.5, thresh=None):
    """Marr-Hildreth edges: sign changes of the LoG response with sufficient slope."""
    r = log_response(img, sigma)
    if thresh is None:
        thresh = 0.25 * np.abs(r).max()
    zc = np.zeros(r.shape, bool)
    for dy, dx in [(0, 1), (1, 0), (1, 1), (1, -1)]:
        b = np.roll(r, (-dy, -dx), (0, 1))
        zc |= (r * b < 0) & (np.abs(r - b) > thresh)
    zc[0, :] = zc[-1, :] = False
    zc[:, 0] = zc[:, -1] = False
    return zc


def canny_auto(img, sigma=0.33):
    g = cv2.GaussianBlur(img, (5, 5), 1.2)
    m = float(np.median(g[g > 0])) if np.any(g > 0) else 128.0
    return cv2.Canny(g, int(max(0, (1 - sigma) * m)), int(min(255, (1 + sigma) * m))) > 0


def morph_boundary(mask, k=3):
    """beta(A) = A - (A eroded by B)."""
    m = mask.astype(np.uint8)
    return (m - cv2.erode(m, np.ones((k, k), np.uint8))).astype(bool)


def morph_gradient(img, k=3):
    return cv2.morphologyEx(img, cv2.MORPH_GRADIENT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))


def top_hat(img, k=15):
    return cv2.morphologyEx(img, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))


def watershed_split(img, mask):
    """Distance-transform-marker watershed; separates touching lesions. Returns (labels, lines)."""
    m = mask.astype(np.uint8) * 255
    if m.max() == 0:
        return np.zeros(mask.shape, np.int32), np.zeros(mask.shape, bool)
    dist = cv2.distanceTransform(m, cv2.DIST_L2, 5)
    _, fg = cv2.threshold(dist, 0.5 * dist.max(), 255, 0)
    fg = fg.astype(np.uint8)
    bg = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=2)
    unknown = cv2.subtract(bg, fg)
    _, markers = cv2.connectedComponents(fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    markers = cv2.watershed(cv2.cvtColor(img, cv2.COLOR_GRAY2BGR), markers.astype(np.int32))
    return markers, markers == -1
