"""Unit 2: intensity transformations."""
import numpy as np


def log_transform(img):
    """s = c*log(1+r); expands dark values."""
    r = img.astype(np.float32)
    c = 255.0 / np.log1p(max(r.max(), 1.0))
    return np.clip(c * np.log1p(r), 0, 255).astype(np.uint8)


def power_law(img, gamma=1.0):
    """s = 255*(r/255)^gamma; gamma<1 brightens, gamma>1 darkens."""
    r = img.astype(np.float32) / 255.0
    return np.clip(255.0 * np.power(r, gamma), 0, 255).astype(np.uint8)


def contrast_stretch(img, low_pct=2, high_pct=98):
    """Piece-wise linear stretch between percentiles."""
    lo, hi = np.percentile(img, [low_pct, high_pct])
    if hi <= lo:
        return img.copy()
    return (np.clip((img.astype(np.float32) - lo) / (hi - lo), 0, 1) * 255).astype(np.uint8)
