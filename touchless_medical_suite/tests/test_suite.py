"""Run:  python -m unittest discover -s tests -v"""
import sys, os, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np, cv2
from medsuite import enhancement as enh, segmentation as seg, boundary as bd, color as col
from medsuite.gestures import count_fingers, GestureController
from medsuite.phantom import make_phantom
from medsuite.workbench import Workbench, TOOLS


def fake_hand(n):
    m = np.zeros((300, 300), np.uint8)
    cv2.circle(m, (150, 205), 75, 255, -1)
    if n == 0:
        return m
    xs = {1: [150], 2: [120, 180], 3: [105, 150, 195], 4: [90, 130, 170, 210], 5: [80, 115, 150, 185, 220]}[n]
    for x in xs:
        cv2.rectangle(m, (x - 9, 50 + (x - 150) ** 2 // 100), (x + 9, 200), 255, -1)   # centre fingers longer
    return m


class T(unittest.TestCase):
    def setUp(self):
        self.img = make_phantom()

    def test_transforms(self):
        for f in (enh.log_transform, enh.contrast_stretch, lambda x: enh.power_law(x, .5)):
            o = f(self.img); self.assertEqual(o.dtype, np.uint8); self.assertEqual(o.shape, self.img.shape)
        self.assertGreater(enh.power_law(self.img, .5).mean(), self.img.mean())

    def test_otsu_matches_opencv(self):
        t, _ = cv2.threshold(self.img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        self.assertLessEqual(abs(seg.otsu_threshold(self.img) - t), 1)

    def test_roi_otsu_finds_lesions(self):
        m, t = seg.otsu_binarize(cv2.GaussianBlur(self.img, (0, 0), 1.5), levels=2)
        self.assertTrue(110 < t < 150, t)
        self.assertTrue(m[int(256 * .42), int(256 * .40)])          # lesion 1 centre selected
        self.assertFalse(m[int(256 * .5), int(256 * .5) + 60])      # plain tissue not selected

    def test_region_growing(self):
        sm = cv2.GaussianBlur(self.img, (0, 0), 1.2)
        m = seg.region_growing(sm, (int(256 * .40), int(256 * .42)), tol=10)
        self.assertTrue(200 < m.sum() < 2500, m.sum())
        self.assertFalse(m[5, 5])

    def test_split_merge(self):
        lab, mean = seg.split_and_merge(cv2.GaussianBlur(self.img, (0, 0), 1.5))
        self.assertEqual(lab.shape, self.img.shape)
        self.assertTrue(2 <= len(np.unique(lab)) < 500)

    def test_boundary_tools(self):
        mask = np.zeros((50, 50), bool); mask[10:40, 10:40] = True
        b = bd.morph_boundary(mask)
        self.assertEqual(int(b.sum()), 30 * 30 - 28 * 28)
        self.assertTrue(bd.log_zero_crossings(self.img).any())
        self.assertTrue(bd.canny_auto(self.img).any())
        self.assertEqual(bd.log_sharpen(self.img).shape, self.img.shape)
        _, lines = bd.watershed_split(self.img, seg.clean_mask(seg.otsu_binarize(self.img)[0]))
        self.assertEqual(lines.shape, self.img.shape)

    def test_hsi_roundtrip(self):
        rgb = np.random.default_rng(0).uniform(0.05, 0.95, (40, 40, 3))
        h, s, i = col.rgb_to_hsi(rgb)
        self.assertLess(np.abs(col.hsi_to_rgb(h, s, i) - rgb).max(), 1e-3)

    def test_color_outputs(self):
        for o in (col.pseudocolor_hsv(self.img), col.pseudocolor_hsi(self.img),
                  col.intensity_slice(self.img, 100, 140), col.color_slice_hsv(col.pseudocolor_hsv(self.img), 0)):
            self.assertEqual(o.shape, self.img.shape + (3,))
        self.assertEqual(len({tuple(p) for p in col.pseudocolor_hsv(self.img).reshape(-1, 3)[::50]}) > 20, True)

    def test_finger_counting(self):
        for n in range(6):
            self.assertEqual(count_fingers(fake_hand(n))[0], n, f"hand {n}")
        self.assertEqual(count_fingers(np.zeros((300, 300), np.uint8))[0], -1)

    def test_gesture_state_machine(self):
        g = GestureController(hold_frames=3, repeat_every=2)
        acts = [g.feed(4)[0] for _ in range(6)]
        self.assertEqual(acts.count("next"), 1)                     # one-shot
        acts = [g.feed(2)[0] for _ in range(7)]
        self.assertGreaterEqual(acts.count("inc"), 2)               # repeats while held
        self.assertEqual(g.feed(1, (.5, .5))[0], "point")

    def test_workbench_all_tools(self):
        wb = Workbench(self.img)
        wb.set_seed(int(256 * .40), int(256 * .42))
        for i in range(len(TOOLS)):
            wb.tool = i
            for _ in range(2):
                wb.confirm(); wb.adjust(+1); wb.adjust(-1)
                out, info = wb.render()
                self.assertEqual(out.shape[:2], self.img.shape); self.assertIsInstance(info, str)


if __name__ == "__main__":
    unittest.main()
