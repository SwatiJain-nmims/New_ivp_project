"""The analysis 'workbench': holds the scan, active tool and parameters, and renders results.
Both the gesture app and the CLI drive this same object."""
import numpy as np
import cv2
from . import enhancement as enh, segmentation as seg, boundary as bd, color as col

TOOLS = ["Original", "Enhance", "Otsu Segment", "Region Grow", "Boundary", "Pseudo-Color"]
ENH_MODES = ["power-law", "log", "stretch", "log+stretch"]
OTSU_MODES = ["ROI 1-level", "ROI 2-level", "global"]
EDGE_MODES = ["morph boundary", "LoG zero-cross", "Canny", "watershed"]
COLOR_MODES = ["HSV rainbow", "HSI rainbow", "intensity slice", "HSV colour slice"]


def _bgr(g):
    return cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)


def _overlay(base_gray, mask, color, alpha=0.45):
    out = _bgr(base_gray).astype(np.float32)
    out[mask] = (1 - alpha) * out[mask] + alpha * np.array(color, np.float32)
    return out.astype(np.uint8)


class Workbench:
    def __init__(self, img):
        self.img = img
        self.tool = 0
        self.seed = None
        self.p = dict(gamma=0.8, otsu_off=0, tol=12, sigma=1.5, center=150, width=24)
        self.enh_mode = 0
        self.edge_mode = 0
        self.color_mode = 0
        self.otsu_mode = 1
        self.rg_mask = None
        self._rg_key = None
        self.msg = ""

    # ---- state changes -------------------------------------------------
    def next_tool(self):
        self.tool = (self.tool + 1) % len(TOOLS)

    def set_seed(self, x, y):
        self.seed = (int(x), int(y))

    def reset(self):
        self.__init__(self.img)

    def adjust(self, direction):
        """direction = +1 / -1 acts on the active tool's main parameter."""
        p, t = self.p, TOOLS[self.tool]
        if t == "Enhance":
            p["gamma"] = float(np.clip(p["gamma"] + 0.05 * direction, 0.2, 3.0))
        elif t == "Otsu Segment":
            p["otsu_off"] = int(np.clip(p["otsu_off"] + 2 * direction, -60, 60))
        elif t == "Region Grow":
            p["tol"] = int(np.clip(p["tol"] + 1 * direction, 1, 60))
        elif t == "Boundary":
            p["sigma"] = float(np.clip(p["sigma"] + 0.1 * direction, 0.5, 5.0))
        elif t == "Pseudo-Color":
            p["center"] = int(np.clip(p["center"] + 4 * direction, 0, 255))

    def confirm(self):
        """Context-sensitive 'click'."""
        t = TOOLS[self.tool]
        if t == "Enhance":
            self.enh_mode = (self.enh_mode + 1) % len(ENH_MODES)
        elif t == "Otsu Segment":
            self.otsu_mode = (self.otsu_mode + 1) % len(OTSU_MODES)
        elif t == "Region Grow":
            self.grow()
        elif t == "Boundary":
            self.edge_mode = (self.edge_mode + 1) % len(EDGE_MODES)
        elif t == "Pseudo-Color":
            self.color_mode = (self.color_mode + 1) % len(COLOR_MODES)

    # ---- computations --------------------------------------------------
    def enhanced(self):
        m, g = ENH_MODES[self.enh_mode], self.img
        if m == "power-law":
            return enh.power_law(g, self.p["gamma"])
        if m == "log":
            return enh.log_transform(g)
        if m == "stretch":
            return enh.contrast_stretch(g)
        return enh.contrast_stretch(enh.log_transform(g))

    def otsu_mask(self):
        smooth = cv2.GaussianBlur(self.img, (0, 0), 1.5)
        mask, t = seg.otsu_binarize(smooth, self.p["otsu_off"], self.otsu_mode != 2, levels=2 if self.otsu_mode == 1 else 1)
        return seg.clean_mask(mask), t

    def grow(self):
        if self.seed is None:
            self.msg = "Point at a lesion first (1 finger / click)"
            return
        key = (self.seed, self.p["tol"])
        if key != self._rg_key:
            smooth = cv2.GaussianBlur(self.img, (0, 0), 1.2)
            self.rg_mask = seg.clean_mask(seg.region_growing(smooth, self.seed, self.p["tol"]), 3, 3, 10)
            self._rg_key = key
        self.msg = f"Region: {int(self.rg_mask.sum())} px"

    def working_mask(self):
        return self.rg_mask if self.rg_mask is not None else self.otsu_mask()[0]

    # ---- rendering -----------------------------------------------------
    def render(self):
        """Returns (BGR image, info line)."""
        t, g = TOOLS[self.tool], self.img
        if t == "Original":
            return _bgr(g), "raw scan"
        if t == "Enhance":
            return _bgr(self.enhanced()), f"{ENH_MODES[self.enh_mode]}  gamma={self.p['gamma']:.2f}"
        if t == "Otsu Segment":
            m, th = self.otsu_mask()
            tag = OTSU_MODES[self.otsu_mode]
            return _overlay(g, m, (0, 200, 0)), f"{tag}  T={th}  offset={self.p['otsu_off']:+d}"
        if t == "Region Grow":
            if self.rg_mask is not None and self.seed is not None:
                self.grow()                                    # re-grow if tol changed (cached)
            out = _overlay(g, self.rg_mask, (0, 0, 255)) if self.rg_mask is not None else _bgr(g)
            if self.seed:
                cv2.drawMarker(out, self.seed, (0, 255, 255), cv2.MARKER_CROSS, 14, 1)
            return out, f"seed={self.seed} tol={self.p['tol']}  {self.msg}"
        if t == "Boundary":
            sharp = bd.log_sharpen(g, self.p["sigma"])
            mask, em = self.working_mask(), EDGE_MODES[self.edge_mode]
            out = _bgr(sharp)
            if em == "morph boundary":
                out[bd.morph_boundary(mask)] = (0, 255, 255)
            elif em == "LoG zero-cross":
                out[bd.log_zero_crossings(g, self.p["sigma"])] = (255, 255, 0)
            elif em == "Canny":
                out[bd.canny_auto(sharp)] = (0, 128, 255)
            else:
                _, lines = bd.watershed_split(g, mask)
                out[lines] = (0, 0, 255)
                out[bd.morph_boundary(mask)] = (0, 255, 255)
            return out, f"LoG-sharpen sigma={self.p['sigma']:.1f}  {em}"
        # Pseudo-Color
        cm, base = COLOR_MODES[self.color_mode], enh.contrast_stretch(g)
        c, w = self.p["center"], self.p["width"]
        if cm == "HSV rainbow":
            out = col.pseudocolor_hsv(base)
        elif cm == "HSI rainbow":
            out = col.pseudocolor_hsi(base)
        elif cm == "intensity slice":
            out = col.intensity_slice(base, c - w, c + w)
        else:
            hue = (1 - c / 255.0) * 240
            out = col.color_slice_hsv(col.pseudocolor_hsv(base), hue, 40)
        return out, f"{cm}  centre={c}"
