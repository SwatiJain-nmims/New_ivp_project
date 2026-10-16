# Touchless Medical & Diagnostic Image Analysis Suite

Hands-free clinical viewer: control segmentation, boundary enhancement and pseudo-colouring of
DICOM / X-ray / MRI slices with hand gestures from a webcam. Built for the Image & Video Processing course.

## Setup
```
pip install -r requirements.txt
python main.py                      # synthetic phantom + webcam
python main.py --input scan.dcm     # your DICOM / PNG / JPG
python main.py --no-camera          # keyboard + mouse only
python cli.py --out results         # headless: runs every stage, saves images + montage
python -m unittest discover -s tests -v
```
Gesture control needs a webcam, a plain background and good light. Put your hand in the green box.
Press **c** with your palm covering the centre of the box to calibrate skin colour.

## Gestures (keyboard fallback in brackets)
| Gesture | Action |
|---|---|
| Fist | Confirm / apply (space) |
| 1 finger | Point: fingertip moves the region-growing seed (mouse click) |
| 2 fingers | Parameter + (`+`), repeats while held |
| 3 fingers | Parameter - (`-`) |
| 4 fingers | Next tool (`n`) |
| Open palm | Reset (`r`) |

`s` saves a screenshot to `results/`, `q` quits.

## Tools and the course concepts they use
| Tool | Param (2/3 fingers) | Confirm (fist) | Concepts |
|---|---|---|---|
| Enhance | gamma | cycle power-law / log / stretch / log+stretch | Unit 2: log, power-law, contrast stretching |
| Otsu Segment | threshold offset | ROI 1-level / ROI 2-level / global | Unit 6: Otsu (own implementation), morphology clean-up |
| Region Grow | tolerance | grow from seed | Unit 6: region growing (own implementation) |
| Boundary | LoG sigma | morph boundary / LoG zero-cross / Canny / watershed | Units 4-5: LoG, Canny, A-(A erode B), watershed |
| Pseudo-Color | slice centre | HSV rainbow / HSI rainbow / intensity slice / HSV colour slice | Units 2 & 7: HSV, HSI (own conversion), slicing |

Region splitting & merging (`segmentation.split_and_merge`) runs in `cli.py` (output `split_merge.png`).
Grayscale morphology helpers (`morph_gradient`, `top_hat`) are in `boundary.py`.

## Layout
```
main.py / cli.py          entry points (interactive / batch)
medsuite/gestures.py      HSV skin slicing -> contour -> convexity defects -> finger count -> debounced actions
medsuite/workbench.py     state + rendering of each tool (shared by app and CLI)
medsuite/enhancement.py segmentation.py boundary.py color.py   image-processing algorithms
medsuite/phantom.py       synthetic low-contrast scan with lesions (demo / tests)
tests/test_suite.py       unit tests (Otsu vs OpenCV, HSI round-trip, finger counting, ...)
```

## Notes / limits
- Educational prototype, **not** a certified medical device; do not use for diagnosis.
- Finger counting is classical CV, so it is sensitive to lighting and skin-like backgrounds; recalibrate with `c`.
- Parameters in `workbench.py` (e.g. `bg_level` in `otsu_binarize`) are tuned for the phantom; adjust for real scans.
