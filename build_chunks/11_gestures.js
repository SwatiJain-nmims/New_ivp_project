  // ==========================================
  // TOUCHLESS GESTURE CONTROL LAYER (MediaPipe Integration)
  // ONLY extracts (x, y, z) landmarks; all DIP computations, ROIs, and thresholds are handled manually.
  // ==========================================
  class GestureController {
    constructor(uiController) {
      this.ui = uiController;
      this.hands = null;
      this.camera = null;
      this.isActive = false;
      this.isModelLoaded = false;
      this.currentGesture = 'NONE';
      this.landmarks = null;

      // Filter and debounce variables
      this.smoothedElevation = 0.5;
      this.smoothedPinch = 0.1;
      this.lastGestureTime = 0;
      this.peaceToggleDebounce = 0;
    }

    async init() {
      if (typeof Hands === 'undefined') {
        console.warn('MediaPipe Hands script not ready yet.');
        return false;
      }

      try {
        // Try local assets first, fallback to CDN if needed
        this.hands = new Hands({
          locateFile: (file) => {
            // Check if served from server with local assets folder
            return `mediapipe_assets/${file}`;
          }
        });

        this.hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => this.onHandResults(results));
        this.isModelLoaded = true;
        console.log('GestureController: MediaPipe Hands initialized successfully.');
        const statusBadge = document.getElementById('cameraStatusText');
        if (statusBadge) statusBadge.textContent = 'MediaPipe Ready';
        return true;
      } catch (e) {
        console.warn('Local assets loader failed, attempting CDN fallback locateFile:', e);
        try {
          this.hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
          });
          this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          this.hands.onResults((results) => this.onHandResults(results));
          this.isModelLoaded = true;
          return true;
        } catch (err2) {
          console.error('All MediaPipe Hands initialization attempts failed:', err2);
          return false;
        }
      }
    }

    async startCamera(videoElement) {
      if (!this.hands) {
        const ok = await this.init();
        if (!ok) {
          alert('Could not initialize MediaPipe Hands. Running in interactive mouse simulation mode.');
          return false;
        }
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 320 },
              height: { ideal: 240 },
              facingMode: 'user'
            }
          });
          videoElement.srcObject = stream;
          await videoElement.play();

          this.isActive = true;
          document.getElementById('cameraStatusText').textContent = 'Tracking Active';
          document.getElementById('camPlaceholder').style.display = 'none';

          // Robust native video processing loop with hands.send
          const processFrame = async () => {
            if (!this.isActive) return;
            if (videoElement.readyState >= 2) {
              try {
                await this.hands.send({ image: videoElement });
              } catch (err) {
                // If frame fails, keep loop alive
                console.warn('Frame send error:', err);
              }
            }
            if (this.isActive) {
              requestAnimationFrame(processFrame);
            }
          };

          requestAnimationFrame(processFrame);
          return true;
        } catch (err) {
          console.warn('Webcam stream unavailable:', err);
          alert('Webcam access was not granted or camera is occupied by another app. You can interactively use Mouse Simulation mode.');
          return false;
        }
      }
      return false;
    }

    stopCamera(videoElement) {
      this.isActive = false;
      if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(t => t.stop());
        videoElement.srcObject = null;
      }
      if (this.camera) {
        try { this.camera.stop(); } catch(e){}
      }
      document.getElementById('cameraStatusText').textContent = 'Offline (Mouse Mode)';
      document.getElementById('camPlaceholder').style.display = 'block';

      // Clear overlay
      const overlayCanvas = document.getElementById('webcamOverlayCanvas');
      if (overlayCanvas) {
        const ctx = overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
    }

    /**
     * Parse 21 3D hand landmarks:
     * 0: Wrist
     * 4: Thumb Tip
     * 8: Index Finger Tip
     * 12: Middle Finger Tip
     * 16: Ring Finger Tip
     * 20: Pinky Tip
     */
    onHandResults(results) {
      const overlayCanvas = document.getElementById('webcamOverlayCanvas');
      if (!overlayCanvas) return;
      const ctx = overlayCanvas.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        this.currentGesture = 'NONE';
        this.ui.updateGestureHUD('No Hand Detected', 'Position hand in webcam view', '🖐️');
        return;
      }

      const lm = results.multiHandLandmarks[0];
      this.landmarks = lm;

      // Draw hand skeleton on mini canvas
      this.renderLandmarksOnCanvas(ctx, lm, overlayCanvas.width, overlayCanvas.height);

      // 1. Gesture Classification
      const gesture = this.classifyGesture(lm);
      this.currentGesture = gesture;

      // 2. Compute Hand Elevation (Index fingertip Y landmark: 0=top, 1=bottom)
      const rawElevation = Math.max(0, Math.min(1, 1.0 - lm[8].y)); // Invert so high hand = 1.0, low hand = 0.0
      this.smoothedElevation = this.smoothedElevation * 0.65 + rawElevation * 0.35;

      // 3. Compute Pinch Distance: landmark 4 (Thumb) to landmark 8 (Index)
      const dx = lm[4].x - lm[8].x;
      const dy = lm[4].y - lm[8].y;
      const dz = (lm[4].z || 0) - (lm[8].z || 0);
      const pinchDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      this.smoothedPinch = this.smoothedPinch * 0.65 + pinchDist * 0.35;

      // 4. Pass coordinates to UIController for active DIP parameter modulation
      this.ui.handleGestureAction(gesture, this.smoothedElevation, this.smoothedPinch, lm[8]);
    }

    /**
     * Classify Hand State into Distinct Clinical Gestures:
     * - Open Palm
     * - Fist
     * - Index Pointing
     * - Peace Sign (V)
     * - Pinch
     */
    classifyGesture(lm) {
      // Check which fingers are extended (tip.y < pip.y)
      const thumbExtended = Math.abs(lm[4].x - lm[2].x) > 0.04;
      const indexExtended = lm[8].y < lm[6].y;
      const middleExtended = lm[12].y < lm[10].y;
      const ringExtended = lm[16].y < lm[14].y;
      const pinkyExtended = lm[20].y < lm[18].y;

      // Euclidean distance between Thumb tip (4) and Index tip (8)
      const pinchDist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);

      // Peace Sign (Index & Middle extended, Ring & Pinky closed)
      if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
        return 'PEACE_SIGN';
      }

      // Fist (All 4 fingers curled)
      if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return 'FIST';
      }

      // Index Pointing (Only index finger extended)
      if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return 'INDEX_POINT';
      }

      // Pinch (Thumb and Index close together)
      if (pinchDist < 0.075) {
        return 'PINCH';
      }

      // Open Palm (At least 3-4 fingers extended)
      const extendedCount = (indexExtended ? 1 : 0) + (middleExtended ? 1 : 0) +
                            (ringExtended ? 1 : 0) + (pinkyExtended ? 1 : 0);
      if (extendedCount >= 3) {
        return 'OPEN_PALM';
      }

      return 'PARTIAL';
    }

    renderLandmarksOnCanvas(ctx, lm, w, h) {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#f43f5e';

      // Landmark connections
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],       // Index
        [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
        [9, 13], [13, 14], [14, 15], [15, 16],// Ring
        [13, 17], [17, 18], [18, 19], [19, 20],// Pinky
        [0, 17]                               // Palm base
      ];

      for (let [i, j] of connections) {
        ctx.beginPath();
        ctx.moveTo(lm[i].x * w, lm[i].y * h);
        ctx.lineTo(lm[j].x * w, lm[j].y * h);
        ctx.stroke();
      }

      // Landmark points
      for (let i = 0; i < lm.length; i++) {
        ctx.beginPath();
        ctx.arc(lm[i].x * w, lm[i].y * h, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
