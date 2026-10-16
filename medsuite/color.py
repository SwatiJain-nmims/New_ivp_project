"""Units 2 & 7: pseudo-colouring, intensity slicing and colour slicing in HSV / HSI.
All colour outputs are BGR uint8 (OpenCV display order)."""
import numpy as np
import cv2


def rgb_to_hsi(rgb):
    """rgb float in [0,1], shape (...,3) -> H(rad, 0..2pi), S, I."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    i = (r + g + b) / 3.0
    s = 1.0 - np.minimum(np.minimum(r, g), b) / np.maximum(i, 1e-8)
    num = 0.5 * ((r - g) + (r - b))
    den = np.sqrt((r - g) ** 2 + (r - b) * (g - b)) + 1e-8
    theta = np.arccos(np.clip(num / den, -1, 1))
    h = np.where(b <= g, theta, 2 * np.pi - theta)
    return h, s, i


def hsi_to_rgb(h, s, i):
    """Inverse of rgb_to_hsi (sector formulas). Result clipped to [0,1]."""
    h = np.mod(h, 2 * np.pi)
    r = np.zeros_like(h); g = np.zeros_like(h); b = np.zeros_like(h)
    third = 2 * np.pi / 3

    def f(hh):
        return i * (1 + s * np.cos(hh) / np.maximum(np.cos(np.pi / 3 - hh), 1e-8))

    m1 = h < third
    m2 = (h >= third) & (h < 2 * third)
    m3 = h >= 2 * third
    b[m1] = (i * (1 - s))[m1]; r[m1] = f(h)[m1]; g[m1] = (3 * i - r - b)[m1]
    h2 = h - third
    r[m2] = (i * (1 - s))[m2]; g[m2] = f(h2)[m2]; b[m2] = (3 * i - r - g)[m2]
    h3 = h - 2 * third
    g[m3] = (i * (1 - s))[m3]; b[m3] = f(h3)[m3]; r[m3] = (3 * i - g - b)[m3]
    return np.clip(np.stack([r, g, b], -1), 0, 1)


def pseudocolor_hsv(gray):
    """Rainbow map: dark -> blue (240 deg), bright -> red (0 deg), in HSV."""
    g = gray.astype(np.float32) / 255.0
    hsv = np.zeros(gray.shape + (3,), np.uint8)
    hsv[..., 0] = ((1 - g) * 120).astype(np.uint8)        # OpenCV hue: deg/2 -> 120..0
    hsv[..., 1] = 255
    hsv[..., 2] = (90 + 165 * np.sqrt(g)).astype(np.uint8)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)


def pseudocolor_hsi(gray):
    """Same idea in HSI: hue from intensity, S=1, I tied to intensity."""
    g = gray.astype(np.float32) / 255.0
    rgb = hsi_to_rgb((1 - g) * (4 * np.pi / 3), np.ones_like(g), 0.30 + 0.35 * g)
    return cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)


def intensity_slice(gray, lo, hi, color=(0, 0, 255), dim=0.55):
    """Highlight grey levels in [lo, hi] with a colour; rest stays grey (dimmed)."""
    out = cv2.cvtColor((gray * dim).astype(np.uint8), cv2.COLOR_GRAY2BGR)
    sel = (gray >= lo) & (gray <= hi)
    out[sel] = color
    return out


def color_slice_hsv(bgr, hue_center_deg, hue_width_deg=40, s_min=0.25):
    """Keep pixels whose HSV hue lies in the band; desaturate everything else."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    hue = hsv[..., 0].astype(np.float32) * 2
    d = np.abs((hue - hue_center_deg + 180) % 360 - 180)
    keep = (d <= hue_width_deg / 2) & (hsv[..., 1] >= s_min * 255)
    gray = cv2.cvtColor(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
    return np.where(keep[..., None], bgr, (gray * 0.5).astype(np.uint8))
