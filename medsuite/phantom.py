"""Synthetic low-contrast 'scan' with lesions, so the suite runs without real patient data."""
import cv2
import numpy as np


def make_phantom(size=256, seed=7):
    rng = np.random.default_rng(seed)
    img = np.zeros((size, size), np.float32)
    c = size // 2
    cv2.ellipse(img, (c, c), (int(size * .40), int(size * .46)), 0, 0, 360, 95, -1)      # body
    cv2.ellipse(img, (c, c), (int(size * .30), int(size * .36)), 0, 0, 360, 110, -1)     # organ
    cv2.circle(img, (int(size * .40), int(size * .42)), int(size * .07), 150, -1)         # lesion 1
    pts = np.array([[.60, .55], [.68, .52], [.72, .60], [.66, .68], [.58, .64]]) * size   # lesion 2
    cv2.fillPoly(img, [pts.astype(np.int32)], 145)
    cv2.circle(img, (int(size * .52), int(size * .30)), int(size * .035), 70, -1)         # dark cyst
    img = cv2.GaussianBlur(img, (0, 0), 2.0)
    img += rng.normal(0, 4.0, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)
