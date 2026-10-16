"""Headless batch mode: run every stage on a scan and save a montage + individual outputs.
    python cli.py --input scan.dcm --out results/        (omit --input to use the phantom)"""
import argparse, os
import cv2, numpy as np
from medsuite.io_utils import load_image
from medsuite.phantom import make_phantom
from medsuite.workbench import Workbench, TOOLS
from medsuite import segmentation as seg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input"); ap.add_argument("--out", default="results")
    ap.add_argument("--seed", nargs=2, type=int, metavar=("X", "Y"), help="region-growing seed")
    ap.add_argument("--tol", type=int, default=12)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    img = load_image(a.input) if a.input else make_phantom()
    wb = Workbench(img)
    wb.p["tol"] = a.tol
    h, w = img.shape
    # default seed: brightest smoothed blob inside the tissue
    sm = cv2.GaussianBlur(img, (0, 0), 6)
    wb.set_seed(*(a.seed if a.seed else cv2.minMaxLoc(sm)[3]))
    tiles = []
    for i, name in enumerate(TOOLS):
        wb.tool = i
        if name == "Region Grow":
            wb.grow()
        out, info = wb.render()
        cv2.imwrite(os.path.join(a.out, f"{i}_{name.replace(' ', '_').lower()}.png"), out)
        t = out.copy(); cv2.putText(t, name, (6, 16), cv2.FONT_HERSHEY_SIMPLEX, .5, (0, 255, 255), 1)
        tiles.append(t)
    # extras: split & merge + colour modes
    lab, means = seg.split_and_merge(cv2.GaussianBlur(img, (0, 0), 1.5))
    cv2.imwrite(os.path.join(a.out, "split_merge.png"), means)
    wb.tool = TOOLS.index("Pseudo-Color")
    for m in range(4):
        wb.color_mode = m
        cv2.imwrite(os.path.join(a.out, f"color_mode_{m}.png"), wb.render()[0])
    wb.tool = TOOLS.index("Boundary")
    for m in range(4):
        wb.edge_mode = m
        cv2.imwrite(os.path.join(a.out, f"boundary_mode_{m}.png"), wb.render()[0])
    cv2.imwrite(os.path.join(a.out, "montage.png"), np.vstack([np.hstack(tiles[:3]), np.hstack(tiles[3:])]))
    print(f"Saved results to {a.out}/ (regions after split&merge: {lab.max() + 1})")


if __name__ == "__main__":
    main()
