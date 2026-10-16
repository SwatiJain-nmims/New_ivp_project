"""Touchless control: skin colour slicing in HSV -> morphology -> contour -> convexity defects
-> finger count. No deep-learning dependency; uses the same IVP tools as the rest of the suite.

Gesture vocabulary (hand held inside the green ROI box):
    fist (0)  -> CONFIRM / apply     1 finger -> POINT (fingertip moves the seed)
    2 fingers -> parameter +         3 fingers -> parameter -
    4 fingers -> next tool           open palm (5) -> reset
"""
import math
import cv2
import numpy as np

DEFAULT_SKIN = ((0, 40, 60), (25, 255, 255))   # HSV lower / upper (tunable with calibrate)


def skin_mask(bgr, lower, upper):
    hsv = cv2.cvtColor(cv2.GaussianBlur(bgr, (5, 5), 0), cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, np.array(lower, np.uint8), np.array(upper, np.uint8))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k, iterations=1)
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, k, iterations=2)


def calibrate_skin(bgr_patch, margin=(12, 60, 70)):
    """Sample HSV range from a patch the hand covers (press 'c' with palm over the box)."""
    hsv = cv2.cvtColor(bgr_patch, cv2.COLOR_BGR2HSV).reshape(-1, 3).astype(np.int32)
    med = np.median(hsv, 0)
    lo = np.clip(med - margin, 0, 255)
    hi = np.clip(med + margin, 0, 255)
    hi[0] = min(179, hi[0]); lo[1] = max(lo[1], 20); lo[2] = max(lo[2], 40); hi[1] = 255; hi[2] = 255
    return tuple(int(v) for v in lo), tuple(int(v) for v in hi)


def count_fingers(mask, min_area=2500):
    """Return (fingers 0-5 or -1 if no hand, fingertip (x,y) or None, contour or None)."""
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return -1, None, None
    c = max(cnts, key=cv2.contourArea)
    area = cv2.contourArea(c)
    if area < min_area:
        return -1, None, None
    tip = tuple(c[c[:, :, 1].argmin()][0])                       # top-most point
    hull_idx = cv2.convexHull(c, returnPoints=False)
    gaps = 0
    if hull_idx is not None and len(hull_idx) > 3:
        try:
            defects = cv2.convexityDefects(c, hull_idx)
        except cv2.error:
            defects = None
        if defects is not None:
            palm_r = cv2.minEnclosingCircle(c)[1]
            for s, e, f, d in defects.reshape(-1, 4):
                a, b, p = c[s][0], c[e][0], c[f][0]
                ab = np.linalg.norm(a - b)
                ap = np.linalg.norm(a - p)
                bp = np.linalg.norm(b - p)
                if ap * bp == 0:
                    continue
                ang = math.degrees(math.acos(np.clip((ap ** 2 + bp ** 2 - ab ** 2) / (2 * ap * bp), -1, 1)))
                depth = d / 256.0
                if ang < 85 and depth > 0.18 * palm_r:           # a V-shaped gap between fingers
                    gaps += 1
    if gaps == 0:
        x, y, w, h = cv2.boundingRect(c)
        hull_area = max(cv2.contourArea(cv2.convexHull(c)), 1)
        solidity = area / hull_area
        fingers = 0 if (solidity > 0.88 and h / max(w, 1) < 1.25) else 1
    else:
        fingers = min(gaps + 1, 5)
    return fingers, tip, c


class GestureController:
    """Debounces raw finger counts into actions.
    update(frame_roi) -> (action | None, fingertip_normalised | None, fingers, mask)"""

    NAMES = {0: "fist", 1: "point", 2: "param +", 3: "param -", 4: "next tool", 5: "reset"}

    def __init__(self, hold_frames=6, repeat_every=4):
        self.skin = DEFAULT_SKIN
        self.hold, self.repeat = hold_frames, repeat_every
        self.last, self.streak, self.fired = -1, 0, False

    def calibrate(self, roi_patch):
        self.skin = calibrate_skin(roi_patch)

    def update(self, roi):
        mask = skin_mask(roi, *self.skin)
        fingers, tip, _ = count_fingers(mask)
        h, w = mask.shape
        tip_n = (tip[0] / w, tip[1] / h) if tip else None
        return self.feed(fingers, tip_n) + (fingers, mask)

    def feed(self, fingers, tip_n=None):
        """Pure state machine (unit-testable): returns (action, tip_n)."""
        if fingers == self.last:
            self.streak += 1
        else:
            self.last, self.streak, self.fired = fingers, 1, False
        action = None
        if fingers == 1 and tip_n is not None:
            action = "point"                                    # continuous, no debounce
        elif self.streak >= self.hold:
            if fingers in (2, 3):                               # repeat while held
                if (self.streak - self.hold) % self.repeat == 0:
                    action = "inc" if fingers == 2 else "dec"
            elif not self.fired and fingers in (0, 4, 5):       # one-shot
                action = {0: "confirm", 4: "next", 5: "reset"}[fingers]
                self.fired = True
        return action, tip_n
