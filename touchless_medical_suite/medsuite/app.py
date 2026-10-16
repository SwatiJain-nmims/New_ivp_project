"""Interactive webcam application."""
import argparse
import cv2
import numpy as np
from .gestures import GestureController
from .io_utils import load_image
from .phantom import make_phantom
from .workbench import Workbench, TOOLS

VIEW = 512
ROI = (0.50, 0.08, 0.98, 0.78)      # x0,y0,x1,y1 as fraction of camera frame (right side)
HELP = "n:next  +/-:param  space:confirm  click:seed  c:calibrate  r:reset  s:save  q:quit"


def put(img, text, y, color=(255, 255, 255), scale=0.5):
    cv2.putText(img, text, (8, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), 3, cv2.LINE_AA)
    cv2.putText(img, text, (8, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1, cv2.LINE_AA)


def compose(wb, cam_view, gesture_txt):
    """Build the display: processed scan (left) + camera/gesture panel (right)."""
    out_img, info = wb.render()
    left = cv2.resize(out_img, (VIEW, VIEW), interpolation=cv2.INTER_NEAREST)
    put(left, f"[{wb.tool + 1}/{len(TOOLS)}] {TOOLS[wb.tool]}", 22, (0, 255, 255), 0.6)
    put(left, info, VIEW - 12)
    right = np.zeros((VIEW, 400, 3), np.uint8)
    if cam_view is not None:
        right[:300] = cv2.resize(cam_view, (400, 300))
    put(right, "gesture: " + gesture_txt, 325, (0, 255, 0))
    for i, line in enumerate(["fist=confirm  1=point", "2=param+  3=param-", "4=next tool  5=reset", HELP[:34], HELP[34:]]):
        put(right, line, 360 + 22 * i, (200, 200, 200), 0.45)
    return np.hstack([left, right])


def main(argv=None):
    ap = argparse.ArgumentParser(description="Touchless Medical Image Analysis Suite")
    ap.add_argument("--input", help="DICOM / PNG / JPG scan (default: synthetic phantom)")
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--no-camera", action="store_true", help="keyboard/mouse only")
    a = ap.parse_args(argv)

    wb = Workbench(load_image(a.input) if a.input else make_phantom())
    cap = None if a.no_camera else cv2.VideoCapture(a.camera)
    if cap is not None and not cap.isOpened():
        print("Camera not available -> keyboard/mouse mode.")
        cap = None
    gc = GestureController()
    win = "Touchless Medical Suite"
    cv2.namedWindow(win)

    def on_mouse(ev, x, y, *_):
        if ev == cv2.EVENT_LBUTTONDOWN and x < VIEW:
            wb.set_seed(x / (VIEW / wb.img.shape[1]), y / (VIEW / wb.img.shape[0]))
    cv2.setMouseCallback(win, on_mouse)

    gtxt, count = "(no camera)", 0
    while True:
        cam_view = None
        if cap is not None:
            ok, frame = cap.read()
            if ok:
                frame = cv2.flip(frame, 1)
                H, W = frame.shape[:2]
                x0, y0, x1, y1 = int(ROI[0] * W), int(ROI[1] * H), int(ROI[2] * W), int(ROI[3] * H)
                roi = frame[y0:y1, x0:x1]
                action, tip, fingers, mask = gc.update(roi)
                cv2.rectangle(frame, (x0, y0), (x1, y1), (0, 255, 0), 2)
                frame[y0:y0 + 80, x0:x0 + 100] = cv2.cvtColor(cv2.resize(mask, (100, 80)), cv2.COLOR_GRAY2BGR)
                gtxt = gc.NAMES.get(fingers, "no hand")
                if action == "point" and tip:
                    wb.set_seed(tip[0] * wb.img.shape[1], tip[1] * wb.img.shape[0])
                    cv2.circle(frame, (x0 + int(tip[0] * (x1 - x0)), y0 + int(tip[1] * (y1 - y0))), 8, (0, 0, 255), -1)
                elif action == "inc": wb.adjust(+1)
                elif action == "dec": wb.adjust(-1)
                elif action == "next": wb.next_tool()
                elif action == "confirm": wb.confirm()
                elif action == "reset": wb.reset()
                cam_view = frame
        cv2.imshow(win, compose(wb, cam_view, gtxt))
        k = cv2.waitKey(15) & 0xFF
        if k in (ord("q"), 27): break
        elif k == ord("n"): wb.next_tool()
        elif k in (ord("+"), ord("=")): wb.adjust(+1)
        elif k in (ord("-"), ord("_")): wb.adjust(-1)
        elif k == ord(" "): wb.confirm()
        elif k == ord("r"): wb.reset()
        elif k == ord("c") and cam_view is not None:
            gc.calibrate(roi[roi.shape[0] // 3: 2 * roi.shape[0] // 3, roi.shape[1] // 3: 2 * roi.shape[1] // 3])
        elif k == ord("s"):
            cv2.imwrite(f"results/capture_{count:03d}.png", compose(wb, None, "saved")); count += 1
    if cap is not None: cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
