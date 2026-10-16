"""Image loading (DICOM / PNG / JPG / ...) and normalisation to 8-bit grayscale."""
import os
import cv2
import numpy as np


def to_uint8(a, p_low=0.5, p_high=99.5):
    """Percentile-window any numeric array into uint8 [0, 255]."""
    a = a.astype(np.float32)
    lo, hi = np.percentile(a, [p_low, p_high])
    if hi <= lo:
        hi = lo + 1.0
    return (np.clip((a - lo) / (hi - lo), 0, 1) * 255).astype(np.uint8)


def load_image(path, max_side=384):
    """Load a scan as uint8 grayscale. Supports .dcm and common image formats."""
    ext = os.path.splitext(path)[1].lower()
    if ext in (".dcm", ".dicom"):
        import pydicom  # lazy: optional dependency
        ds = pydicom.dcmread(path)
        a = ds.pixel_array.astype(np.float32)
        a = a * float(getattr(ds, "RescaleSlope", 1)) + float(getattr(ds, "RescaleIntercept", 0))
        if a.ndim == 3:  # multi-frame or RGB
            a = a.mean(-1) if a.shape[-1] in (3, 4) else a[a.shape[0] // 2]
        if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
            a = a.max() - a
        img = to_uint8(a)
    else:
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise FileNotFoundError(f"Could not read image: {path}")
    h, w = img.shape
    if max(h, w) > max_side:
        s = max_side / max(h, w)
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    return img
