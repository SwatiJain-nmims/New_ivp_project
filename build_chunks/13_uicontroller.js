  // ==========================================
  // UI CONTROLLER & APPLICATION MASTER PIPELINE
  // Manages state, requestAnimationFrame loop, DOM events, and KaTeX rendering
  // ==========================================
  class UIController {
    constructor() {
      this.width = 256;
      this.height = 256;

      // Active module ('module1' ... 'module6')
      this.activeTab = 'module1';
      this.isSplitView = false;
      this.isFreezeFrame = false;

      // Distance Metric Points (Module 1)
      this.p1 = { x: 50, y: 60 };
      this.p2 = { x: 190, y: 190 };
      this.activeDistPoint = 'p1';

      // Region Growing Seed (Module 5)
      this.seedCoord = { x: 128, y: 128 };

      // Performance metrics
      this.lastFrameTime = performance.now();
      this.fps = 60.0;
      this.processingTime = 0.0;

      // DOM Canvases
      this.inputCanvas = document.getElementById('inputCanvas');
      this.inputCtx = this.inputCanvas.getContext('2d');
      this.outputCanvas = document.getElementById('outputCanvas');
      this.outputCtx = this.outputCanvas.getContext('2d');

      this.inputOverlay = document.getElementById('inputOverlayCanvas');
      this.inputOverlayCtx = this.inputOverlay.getContext('2d');
      this.outputOverlay = document.getElementById('outputOverlayCanvas');
      this.outputOverlayCtx = this.outputOverlay.getContext('2d');

      this.inputHistCanvas = document.getElementById('inputHistCanvas');
      this.outputHistCanvas = document.getElementById('outputHistCanvas');

      // Split canvases
      this.splitBaseCanvas = document.getElementById('splitBaseCanvas');
      this.splitBaseCtx = this.splitBaseCanvas.getContext('2d');
      this.splitOverlayCanvas = document.getElementById('splitOverlayCanvas');
      this.splitOverlayCtx = this.splitOverlayCanvas.getContext('2d');

      // Image Data Buffers
      this.inputImageData = null;
      this.outputImageData = null;

      // Gesture Controller
      this.gestureController = new GestureController(this);

      this.initEvents();
      this.loadPreset('medical_phantom');
      this.updateFormulaDisplay();

      // Start main animation & processing loop
      requestAnimationFrame((t) => this.renderLoop(t));
    }

    /**
     * Load Preset Image Data
     */
    loadPreset(key) {
      let imgData;
      if (key === 'medical_phantom') {
        imgData = TestPatternGenerator.createMedicalPhantom(this.width, this.height);
      } else if (key === 'xray_chest') {
        imgData = TestPatternGenerator.createChestXRay(this.width, this.height);
      } else if (key === 'retinal_scan') {
        imgData = TestPatternGenerator.createRetinalScan(this.width, this.height);
      } else if (key === 'geometric_shapes') {
        imgData = TestPatternGenerator.createMorphShapes(this.width, this.height);
      } else if (key === 'periodic_noise') {
        imgData = TestPatternGenerator.createPeriodicNoise(this.width, this.height);
      } else if (key === 'color_slices') {
        imgData = TestPatternGenerator.createColorCalibrationChart(this.width, this.height);
      } else {
        imgData = TestPatternGenerator.createMedicalPhantom(this.width, this.height);
      }

      this.inputImageData = imgData;
      this.inputCtx.putImageData(imgData, 0, 0);
      this.outputImageData = this.outputCtx.createImageData(this.width, this.height);

      this.executeActivePipeline();
    }

    /**
     * File Upload Handler
     */
    handleFileUpload(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.inputCtx.clearRect(0, 0, this.width, this.height);
          this.inputCtx.drawImage(img, 0, 0, this.width, this.height);
          this.inputImageData = this.inputCtx.getImageData(0, 0, this.width, this.height);
          this.executeActivePipeline();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    /**
     * Set up UI Event Listeners
     */
    initEvents() {
      // Tab navigation
      const tabButtons = document.querySelectorAll('.tab-btn');
      tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          tabButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeTab = btn.getAttribute('data-tab');

          // Switch active pane
          document.querySelectorAll('.module-pane').forEach(p => p.classList.remove('active'));
          document.getElementById(`pane-${this.activeTab}`).classList.add('active');

          // Update header title
          const titleMap = {
            module1: 'Unit 1 & 2: Spatial & Point Transformations',
            module2: 'Unit 2 & 5: Spatial Filtering & Convolution',
            module3: 'Unit 3: 2D Frequency Domain Filtering',
            module4: 'Unit 4: Mathematical Morphology',
            module5: 'Unit 6: Image Segmentation & Thresholding',
            module6: 'Unit 7: Color Image Processing'
          };
          document.getElementById('sidebarPanelTitle').textContent = titleMap[this.activeTab];
          document.getElementById('sidebarUnitBadge').textContent = btn.querySelector('.tab-badge').textContent;

          this.updateFormulaDisplay();
          this.executeActivePipeline();
        });
      });

      // Preset Selector
      document.getElementById('imagePresetSelect').addEventListener('change', (e) => {
        this.loadPreset(e.target.value);
      });

      // Upload Button
      document.getElementById('btnUploadImage').addEventListener('click', () => {
        document.getElementById('fileUploadInput').click();
      });
      document.getElementById('fileUploadInput').addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFileUpload(e.target.files[0]);
        }
      });

      // Reset Pipeline Button
      document.getElementById('btnResetAll').addEventListener('click', () => {
        this.loadPreset(document.getElementById('imagePresetSelect').value);
      });

      // View Mode Toggle (Split slider vs Dual canvas)
      document.getElementById('btnToggleViewMode').addEventListener('click', () => {
        this.toggleViewMode();
      });

      // Webcam Toggle
      const btnCam = document.getElementById('btnToggleCam');
      btnCam.addEventListener('click', async () => {
        const video = document.getElementById('webcamVideo');
        if (this.gestureController.isActive) {
          this.gestureController.stopCamera(video);
          btnCam.classList.remove('btn-active');
          document.getElementById('btnCamText').textContent = 'Start Webcam';
        } else {
          const started = await this.gestureController.startCamera(video);
          if (started) {
            btnCam.classList.add('btn-active');
            document.getElementById('btnCamText').textContent = 'Stop Webcam';
          }
        }
      });

      // Interactive Canvas Click for Distance Measurement (Module 1) and Seed Point (Module 5)
      this.inputCanvas.addEventListener('click', (e) => {
        const rect = this.inputCanvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;
        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);

        if (this.activeTab === 'module1') {
          if (this.activeDistPoint === 'p1') {
            this.p1 = { x, y };
            this.activeDistPoint = 'p2';
          } else {
            this.p2 = { x, y };
            this.activeDistPoint = 'p1';
          }
          this.executeActivePipeline();
        } else if (this.activeTab === 'module5') {
          this.seedCoord = { x, y };
          document.getElementById('m5_seed_coord').textContent = `(${x}, ${y})`;
          this.executeActivePipeline();
        }
      });

      // Split Slider Dragging
      const splitDivider = document.getElementById('splitDivider');
      const splitWrapper = document.getElementById('splitClippedWrapper');
      let isDragging = false;

      splitDivider.addEventListener('mousedown', () => { isDragging = true; });
      window.addEventListener('mouseup', () => { isDragging = false; });
      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const container = document.getElementById('splitSliderContainer');
        const rect = container.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const pct = (offsetX / rect.width) * 100;
        splitDivider.style.left = `${pct}%`;
        splitWrapper.style.width = `${pct}%`;
      });

      // Module 1 Change Listeners
      document.getElementById('m1_transformSelect').addEventListener('change', (e) => {
        const val = e.target.value;
        document.getElementById('m1_gamma_controls').style.display = val === 'gamma' ? 'flex' : 'none';
        document.getElementById('m1_log_controls').style.display = val === 'log' ? 'flex' : 'none';
        document.getElementById('m1_piecewise_controls').style.display = val === 'piecewise' ? 'flex' : 'none';
        document.getElementById('m1_distance_controls').style.display = val === 'distance_metric' ? 'flex' : 'none';
        this.updateFormulaDisplay();
        this.executeActivePipeline();
      });

      const m1Sliders = ['m1_gamma_slider', 'm1_log_c_slider', 'm1_r1_slider', 'm1_s1_slider', 'm1_r2_slider', 'm1_s2_slider'];
      m1Sliders.forEach(id => {
        const slider = document.getElementById(id);
        slider.addEventListener('input', () => {
          document.getElementById(id.replace('_slider', '_val')).textContent = Number(slider.value).toFixed(id.includes('gamma') || id.includes('c') ? 2 : 0);
          this.executeActivePipeline();
        });
      });

      // Module 2 Change Listeners
      document.getElementById('m2_filterSelect').addEventListener('change', (e) => {
        const val = e.target.value;
        document.getElementById('m2_highboost_controls').style.display = val === 'unsharp' ? 'flex' : 'none';
        document.getElementById('m2_minmax_controls').style.display = val === 'min_max' ? 'flex' : 'none';
        document.getElementById('m2_edge_display_row').style.display = val === 'sobel' ? 'flex' : 'none';
        this.updateFormulaDisplay();
        this.executeActivePipeline();
      });

      document.querySelectorAll('#m2_kernel_row .btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#m2_kernel_row .btn').forEach(b => b.classList.remove('btn-active'));
          btn.classList.add('btn-active');
          const sz = btn.getAttribute('data-ksize');
          document.getElementById('m2_kernel_val').textContent = `${sz} x ${sz}`;
          this.executeActivePipeline();
        });
      });

      document.getElementById('m2_boost_slider').addEventListener('input', (e) => {
        document.getElementById('m2_boost_val').textContent = Number(e.target.value).toFixed(2);
        this.executeActivePipeline();
      });

      document.querySelectorAll('#m2_minmax_controls .btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#m2_minmax_controls .btn').forEach(b => b.classList.remove('btn-active'));
          btn.classList.add('btn-active');
          this.executeActivePipeline();
        });
      });

      document.getElementById('m2_edgeModeSelect').addEventListener('change', () => this.executeActivePipeline());

      // Module 3 Change Listeners
      document.getElementById('m3_filterSelect').addEventListener('change', (e) => {
        const val = e.target.value;
        document.getElementById('m3_butterworth_row').style.display = (val === 'blpf' || val === 'bhpf') ? 'flex' : 'none';
        document.getElementById('m3_notch_row').style.display = (val === 'notch_reject' || val === 'notch_pass') ? 'flex' : 'none';
        this.updateFormulaDisplay();
        this.executeActivePipeline();
      });

      document.getElementById('m3_d0_slider').addEventListener('input', (e) => {
        document.getElementById('m3_d0_val').textContent = `${e.target.value} px`;
        this.executeActivePipeline();
      });
      document.getElementById('m3_order_slider').addEventListener('input', (e) => {
        document.getElementById('m3_order_val').textContent = e.target.value;
        this.executeActivePipeline();
      });
      document.getElementById('m3_notch_r_slider').addEventListener('input', (e) => {
        document.getElementById('m3_notch_r_val').textContent = `${e.target.value} px`;
        this.executeActivePipeline();
      });
      document.getElementById('m3_notch_w_slider').addEventListener('input', (e) => {
        document.getElementById('m3_notch_w_val').textContent = `${e.target.value} px`;
        this.executeActivePipeline();
      });

      document.querySelectorAll('#pane-module3 [data-m3view]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#pane-module3 [data-m3view]').forEach(b => b.classList.remove('btn-active'));
          btn.classList.add('btn-active');
          this.executeActivePipeline();
        });
      });

      // Module 4 Change Listeners
      document.getElementById('m4_opSelect').addEventListener('change', () => {
        this.updateFormulaDisplay();
        this.executeActivePipeline();
      });
      document.querySelectorAll('#m4_shape_group .btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#m4_shape_group .btn').forEach(b => b.classList.remove('btn-active'));
          btn.classList.add('btn-active');
          this.executeActivePipeline();
        });
      });
      document.getElementById('m4_radius_slider').addEventListener('input', (e) => {
        document.getElementById('m4_radius_val').textContent = `${e.target.value} px`;
        this.executeActivePipeline();
      });
      document.getElementById('m4_bin_thresh_slider').addEventListener('input', (e) => {
        document.getElementById('m4_bin_thresh_val').textContent = e.target.value;
        this.executeActivePipeline();
      });

      // Module 5 Change Listeners
      document.getElementById('m5_segSelect').addEventListener('change', (e) => {
        const val = e.target.value;
        document.getElementById('m5_otsu_info').style.display = val === 'otsu' ? 'block' : 'none';
        document.getElementById('m5_adaptive_controls').style.display = val === 'adaptive' ? 'flex' : 'none';
        document.getElementById('m5_regiongrow_controls').style.display = val === 'region_grow' ? 'flex' : 'none';
        document.getElementById('m5_splitmerge_controls').style.display = val === 'split_merge' ? 'flex' : 'none';
        this.updateFormulaDisplay();
        this.executeActivePipeline();
      });
      document.getElementById('m5_adap_w_slider').addEventListener('input', (e) => {
        document.getElementById('m5_adap_w_val').textContent = e.target.value;
        this.executeActivePipeline();
      });
      document.getElementById('m5_adap_c_slider').addEventListener('input', (e) => {
        document.getElementById('m5_adap_c_val').textContent = e.target.value;
        this.executeActivePipeline();
      });
      document.getElementById('m5_grow_tol_slider').addEventListener('input', (e) => {
        document.getElementById('m5_grow_tol_val').textContent = e.target.value;
        this.executeActivePipeline();
      });
      document.getElementById('m5_homo_slider').addEventListener('input', (e) => {
        document.getElementById('m5_homo_val').textContent = e.target.value;
        this.executeActivePipeline();
      });
      document.getElementById('m5_block_slider').addEventListener('input', (e) => {
        document.getElementById('m5_block_val').textContent = e.target.value;
        this.executeActivePipeline();
      });

      // Module 6 Change Listeners
      document.getElementById('m6_colorSelect').addEventListener('change', (e) => {
        const val = e.target.value;
        document.getElementById('m6_slice_controls').style.display = val === 'color_slice' ? 'flex' : 'none';
        this.updateFormulaDisplay();
        this.executeActivePipeline();
      });
      document.getElementById('m6_slice_hue_slider').addEventListener('input', (e) => {
        document.getElementById('m6_slice_hue_val').innerHTML = `${e.target.value}&deg;`;
        this.executeActivePipeline();
      });
      document.getElementById('m6_slice_tol_slider').addEventListener('input', (e) => {
        document.getElementById('m6_slice_tol_val').innerHTML = `${e.target.value}&deg;`;
        this.executeActivePipeline();
      });
      document.querySelectorAll('#m6_channel_group .btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#m6_channel_group .btn').forEach(b => b.classList.remove('btn-active'));
          btn.classList.add('btn-active');
          this.executeActivePipeline();
        });
      });
    }

    /**
     * Toggle View Mode (Side-by-Side vs Split Slider)
     */
    toggleViewMode() {
      this.isSplitView = !this.isSplitView;
      const dualContainer = document.querySelectorAll('.canvas-card');
      const splitContainer = document.getElementById('splitSliderContainer');
      const btnText = document.getElementById('viewModeText');

      if (this.isSplitView) {
        dualContainer.forEach(c => c.style.display = 'none');
        splitContainer.style.display = 'block';
        btnText.textContent = 'Side-by-Side';
        this.updateSplitCanvases();
      } else {
        dualContainer.forEach(c => c.style.display = 'flex');
        splitContainer.style.display = 'none';
        btnText.textContent = 'Split View';
      }
    }

    updateSplitCanvases() {
      if (!this.inputImageData || !this.outputImageData) return;
      this.splitBaseCtx.putImageData(this.outputImageData, 0, 0);
      this.splitOverlayCtx.putImageData(this.inputImageData, 0, 0);
    }

    /**
     * Update Gesture HUD
     */
    updateGestureHUD(name, desc, icon = '🖐️') {
      document.getElementById('gestureHudName').textContent = name;
      document.getElementById('gestureHudDesc').textContent = desc;
      document.getElementById('gestureIconBadge').textContent = icon;
      document.getElementById('gestureMetric').textContent = name;
    }

    /**
     * Map Gesture Actions to Active DIP Controls
     */
    handleGestureAction(gesture, elevation, pinch, indexTip) {
      const now = performance.now();

      // 1. Gesture Mode Switcher
      if (gesture === 'OPEN_PALM') {
        this.isFreezeFrame = false;
        this.updateGestureHUD('Open Palm: Live Stream Mode', 'Pass-through active. Move hand to modulate parameters.', '✋');
      } else if (gesture === 'FIST') {
        this.isFreezeFrame = true;
        this.updateGestureHUD('Fist: Freeze & Compute Pipeline', 'Pipeline locked on current frame specimen.', '✊');
      } else if (gesture === 'PEACE_SIGN') {
        if (now - this.gestureController.peaceToggleDebounce > 1200) {
          this.toggleViewMode();
          this.gestureController.peaceToggleDebounce = now;
        }
        this.updateGestureHUD('Peace Sign: View Toggle', 'Toggling side-by-side vs split-screen comparison slider.', '✌️');
      } else if (gesture === 'INDEX_POINT') {
        // Map 2D index tip (0-1) to canvas coordinates
        const px = Math.min(this.width - 1, Math.max(0, Math.round(indexTip.x * this.width)));
        const py = Math.min(this.height - 1, Math.max(0, Math.round(indexTip.y * this.height)));

        if (this.activeTab === 'module5') {
          this.seedCoord = { x: px, y: py };
          document.getElementById('m5_seed_coord').textContent = `(${px}, ${py})`;
        } else if (this.activeTab === 'module1') {
          this.p2 = { x: px, y: py };
        }
        this.updateGestureHUD('Index Pointing: Seed Tracking', `Target Seed: (${px}, ${py})`, '👆');
        this.executeActivePipeline();
      }

      // 2. Modulate Active Parameters via Hand Elevation (Y-Axis)
      if (this.activeTab === 'module1') {
        const transType = document.getElementById('m1_transformSelect').value;
        if (transType === 'gamma') {
          // Map elevation [0, 1] to Gamma [0.2, 4.0]
          const gamma = 0.2 + elevation * 3.8;
          document.getElementById('m1_gamma_slider').value = gamma.toFixed(2);
          document.getElementById('m1_gamma_val').textContent = gamma.toFixed(2);
        } else if (transType === 'piecewise') {
          // Map pinch to contrast stretch thresholds
          const r1 = Math.round(20 + pinch * 150);
          const r2 = Math.min(250, r1 + 80);
          document.getElementById('m1_r1_slider').value = r1;
          document.getElementById('m1_r1_val').textContent = r1;
          document.getElementById('m1_r2_slider').value = r2;
          document.getElementById('m1_r2_val').textContent = r2;
        }
      } else if (this.activeTab === 'module3') {
        // Map elevation to Cutoff Frequency D0 [10, 100]
        const d0 = Math.round(10 + elevation * 90);
        document.getElementById('m3_d0_slider').value = d0;
        document.getElementById('m3_d0_val').textContent = `${d0} px`;
      } else if (this.activeTab === 'module4') {
        // Map elevation to Structuring Element Radius r [1, 6]
        const r = Math.max(1, Math.min(6, Math.round(1 + elevation * 5)));
        document.getElementById('m4_radius_slider').value = r;
        document.getElementById('m4_radius_val').textContent = `${r} px`;
      } else if (this.activeTab === 'module5') {
        const seg = document.getElementById('m5_segSelect').value;
        if (seg === 'region_grow') {
          const tol = Math.round(5 + elevation * 60);
          document.getElementById('m5_grow_tol_slider').value = tol;
          document.getElementById('m5_grow_tol_val').textContent = tol;
        }
      }

      this.executeActivePipeline();
    }

    /**
     * Live KaTeX Formula Updater based on active tab and algorithm
     */
    updateFormulaDisplay() {
      const mathBox = document.getElementById('formulaMathBox');
      const notesBox = document.getElementById('formulaNotesBox');
      const unitTag = document.getElementById('formulaUnitTag');

      if (typeof katex === 'undefined') return;

      let eq = '';
      let notes = '';
      let unit = '';

      if (this.activeTab === 'module1') {
        unit = 'UNIT 1 & 2: SPATIAL TRANSFORMATIONS';
        const op = document.getElementById('m1_transformSelect').value;
        if (op === 'gamma') {
          eq = 's = c \\cdot r^\\gamma';
          notes = 'Power-Law (Gamma) transformation: $r$ is normalized pixel intensity in $[0,1]$. $\\gamma < 1$ expands dark levels, $\\gamma > 1$ expands bright levels.';
        } else if (op === 'log') {
          eq = 's = c \\cdot \\log(1 + r)';
          notes = 'Logarithmic Transformation: Maps narrow range of low gray-level values to wider dynamic range, compressing high values.';
        } else if (op === 'piecewise') {
          eq = 's = \\begin{cases} m_1 r & 0 \\le r < r_1 \\\\ m_2 (r - r_1) + s_1 & r_1 \\le r \\le r_2 \\\\ m_3 (r - r_2) + s_2 & r_2 < r \\le 255 \\end{cases}';
          notes = 'Piecewise-Linear Contrast Stretching: Expands intensity levels between $(r_1, s_1)$ and $(r_2, s_2)$ to enhance specimen contrast.';
        } else if (op === 'hist_eq') {
          eq = 's_k = T(r_k) = (L - 1) \\sum_{j=0}^k p_r(r_j) = (L - 1) \\cdot \\text{CDF}(r_k)';
          notes = 'Histogram Equalization: Flattens probability density function to maximize global image entropy and contrast.';
        } else {
          eq = 'D_E = \\sqrt{(x_1-x_2)^2 + (y_1-y_2)^2}, \\quad D_4 = |x_1-x_2| + |y_1-y_2|, \\quad D_8 = \\max(|x_1-x_2|, |y_1-y_2|)';
          notes = 'Standard Spatial Distance Metrics & $m$-path mixed adjacency graph validation across 4- and 8-neighborhoods.';
        }
      } else if (this.activeTab === 'module2') {
        unit = 'UNIT 2 & 5: SPATIAL FILTERING & GRADIENT';
        const op = document.getElementById('m2_filterSelect').value;
        if (op === 'gaussian') {
          eq = 'G(x, y) = \\frac{1}{2\\pi\\sigma^2} e^{-\\frac{x^2 + y^2}{2\\sigma^2}}';
          notes = 'Gaussian Spatial Filter: Rotationally symmetric smoothing filter minimizing spatial blur and high-frequency noise.';
        } else if (op === 'median') {
          eq = 'g(x,y) = \\text{median}_{(s,t) \\in S_{xy}} \\{ f(x+s, y+t) \\}';
          notes = 'Non-Linear Median Filter: Replaces center pixel with median of window, eliminating impulse (salt-and-pepper) noise without blurring step edges.';
        } else if (op === 'laplacian') {
          eq = '\\nabla^2 f = \\frac{\\partial^2 f}{\\partial x^2} + \\frac{\\partial^2 f}{\\partial y^2}, \\quad g(x,y) = f(x,y) - \\nabla^2 f(x,y)';
          notes = 'Laplacian 2D Second-Derivative Operator: Isotropic sharpening preserving fine clinical structures and zero-crossings.';
        } else if (op === 'unsharp') {
          eq = 'f_{\\text{hb}}(x,y) = A \\cdot f(x,y) - f_{\\text{smooth}}(x,y) = (A-1)f(x,y) + g_{\\text{mask}}(x,y)';
          notes = 'Unsharp Masking and High-Boost Filtering: $A \\ge 1.0$. When $A=1$, standard unsharp mask; when $A > 1$, high-boost amplification.';
        } else if (op === 'sobel') {
          eq = 'M(x,y) = \\sqrt{G_x^2 + G_y^2}, \\quad \\alpha(x,y) = \\arctan\\left(\\frac{G_y}{G_x}\\right)';
          notes = 'Sobel 2D First-Order Spatial Derivative Gradient Operator for edge detection and boundary vector estimation.';
        } else {
          eq = '\\text{LoG}(x,y) = -\\frac{1}{\\pi \\sigma^4} \\left(1 - \\frac{x^2+y^2}{2\\sigma^2}\\right) e^{-\\frac{x^2+y^2}{2\\sigma^2}}';
          notes = 'Laplacian of Gaussian (Marr-Hildreth): Gaussian smoothing followed by Laplacian second derivative for zero-crossing edge extraction.';
        }
      } else if (this.activeTab === 'module3') {
        unit = 'UNIT 3: 2D FREQUENCY DOMAIN (FFT)';
        const op = document.getElementById('m3_filterSelect').value;
        if (op === 'glpf' || op === 'ghpf') {
          eq = 'H_{\\text{GLPF}}(u,v) = e^{-\\frac{D^2(u,v)}{2 D_0^2}}, \\quad H_{\\text{GHPF}}(u,v) = 1 - H_{\\text{GLPF}}(u,v)';
          notes = 'Gaussian Low-Pass and High-Pass Frequency Filters: Smooth transfer function with zero ringing artifacts in spatial domain.';
        } else if (op === 'blpf' || op === 'bhpf') {
          eq = 'H_{\\text{BLPF}}(u,v) = \\frac{1}{1 + [D(u,v)/D_0]^{2n}}, \\quad H_{\\text{BHPF}}(u,v) = \\frac{1}{1 + [D_0/D(u,v)]^{2n}}';
          notes = 'Butterworth Filter of order $n$: Controlled transition between passband and stopband without abrupt discontinuities.';
        } else if (op === 'ilpf' || op === 'ihpf') {
          eq = 'H_{\\text{ILPF}}(u,v) = \\begin{cases} 1 & D(u,v) \\le D_0 \\\\ 0 & D(u,v) > D_0 \\end{cases}';
          notes = 'Ideal Low-Pass Filter: Cuts off all frequency components outside radius $D_0$, exhibiting sinc ringing in spatial domain.';
        } else {
          eq = 'H_{\\text{NR}}(u,v) = 1 - e^{-\\frac{(D(u,v) - D_0)^2}{2 W^2}}, \\quad s(u,v) = \\log(1 + |F(u,v)|)';
          notes = 'Notch / Band-Reject Filter & Centered 2D Fourier Magnitude Spectrum for periodic noise suppression.';
        }
      } else if (this.activeTab === 'module4') {
        unit = 'UNIT 4: MATHEMATICAL MORPHOLOGY';
        const op = document.getElementById('m4_opSelect').value;
        if (op === 'dilation') {
          eq = '(f \\oplus b)(x,y) = \\max_{(s,t) \\in B} \\{ f(x-s, y-t) \\}';
          notes = 'Morphological Dilation: Expands foreground boundaries and fills small interior concavities.';
        } else if (op === 'erosion') {
          eq = '(f \\ominus b)(x,y) = \\min_{(s,t) \\in B} \\{ f(x+s, y+t) \\}';
          notes = 'Morphological Erosion: Shrinks foreground structures and strips away isolated noise protrusions.';
        } else if (op === 'opening') {
          eq = 'f \\circ b = (f \\ominus b) \\oplus b';
          notes = 'Morphological Opening: Erosion followed by dilation. Eliminates thin protrusions and isolates connected objects.';
        } else if (op === 'closing') {
          eq = 'f \\bullet b = (f \\oplus b) \\ominus b';
          notes = 'Morphological Closing: Dilation followed by erosion. Fills narrow gaps and fuses small breaks in contours.';
        } else if (op === 'boundary') {
          eq = '\\beta(A) = A - (A \\ominus B)';
          notes = 'Morphological Boundary Extraction: Set subtraction of eroded object from original object.';
        } else {
          eq = 'A \\circledast B = (A \\ominus B_1) \\cap (A^c \\ominus B_2), \\quad A \\otimes B = A - (A \\circledast B)';
          notes = 'Hit-or-Miss Transformation and Zhang-Suen Iterative Thinning for topological skeletonization.';
        }
      } else if (this.activeTab === 'module5') {
        unit = 'UNIT 6: IMAGE SEGMENTATION';
        const op = document.getElementById('m5_segSelect').value;
        if (op === 'otsu') {
          eq = '\\sigma_b^2(k) = \\frac{[m_G P_1(k) - m(k)]^2}{P_1(k)[1 - P_1(k)]}, \\quad k^* = \\arg\\max_{0 \\le k < L} \\sigma_b^2(k)';
          notes = 'Otsu Optimum Binarization: Maximizes between-class variance to calculate the analytical threshold partition without heuristics.';
        } else if (op === 'adaptive') {
          eq = 'T(x,y) = \\frac{1}{W^2} \\sum_{s,t} f(x+s, y+t) - C';
          notes = 'Adaptive Local Thresholding: Window mean evaluation for images with non-uniform illumination and local gradient drift.';
        } else if (op === 'region_grow') {
          eq = 'R_{k+1} = R_k \\cup \\{ (x,y) \\mid |f(x,y) - f(x_0, y_0)| \\le T \\}';
          notes = 'Seeded Region Growing: Connected component aggregation based on local homogeneity criterion $\\Delta I \\le T$.';
        } else if (op === 'split_merge') {
          eq = 'P(R_i) = \\text{TRUE if } \\sigma_{R_i} \\le \\sigma_{\\max} \\text{, else Split into Quadtree}';
          notes = 'Region Splitting and Merging: Quadtree recursive decomposition with region boundary visualization.';
        } else {
          eq = '\\nabla f = (f \\oplus b) - (f \\ominus b), \\quad \\text{Watershed Basins Flooding}';
          notes = 'Marker-Driven Watershed: Simulates topographic rain flooding on gradient landscape to segment touching lesions.';
        }
      } else if (this.activeTab === 'module6') {
        unit = 'UNIT 7: COLOR IMAGE PROCESSING';
        const op = document.getElementById('m6_colorSelect').value;
        if (op === 'hsi_convert') {
          eq = '\\theta = \\arccos\\left( \\frac{\\frac{1}{2}[(R-G) + (R-B)]}{\\sqrt{(R-G)^2 + (R-B)(G-B)}} \\right), \\quad S = 1 - \\frac{3}{R+G+B}\\min(R,G,B)';
          notes = 'RGB to HSI Conversion: Decouples chromatic content (Hue, Saturation) from achromatic illumination (Intensity).';
        } else if (op === 'color_slice') {
          eq = 's(x,y) = \\begin{cases} f(x,y) & \\text{if } |H(x,y) - H_0| \\le \\Delta H \\\\ I(x,y) \\cdot 0.4 & \\text{otherwise} \\end{cases}';
          notes = 'HSI Color & Intensity Slicing: Highlights target chromatic features while attenuating extraneous tissue background.';
        } else if (op === 'color_edge') {
          eq = '\\lambda = \\sqrt{\\frac{1}{2}\\left( (g_{xx} + g_{yy}) + \\sqrt{(g_{xx} - g_{yy})^2 + 4 g_{xy}^2} \\right)}';
          notes = 'Di Zenzo Vector Gradient: Multi-spectral color edge detection across vector tensor fields.';
        } else {
          eq = '\\text{Colormap LUT: } [0, 255] \\to \\text{Jet / Rainbow Color Vector } (R, G, B)';
          notes = 'Diagnostic Pseudo-Coloring: Maps grayscale density values to visible light spectra for human perceptual enhancement.';
        }
      }

      unitTag.textContent = unit;
      notesBox.innerHTML = notes;
      try {
        katex.render(eq, mathBox, { displayMode: true, throwOnError: false });
      } catch (e) {
        mathBox.textContent = eq;
      }
    }

    /**
     * Master Pipeline Execution:
     * Dispatches current parameters to the corresponding DIP class algorithm
     */
    executeActivePipeline() {
      if (!this.inputImageData) return;

      const t0 = performance.now();
      const grayIn = DIPEngine.toGrayscaleArray(this.inputImageData);
      let outBuffer = null;

      // Update active operation badge
      document.getElementById('activeOpBadge').textContent = `${this.activeTab.toUpperCase()}`;

      // MODULE 1 PIPELINE
      if (this.activeTab === 'module1') {
        const transType = document.getElementById('m1_transformSelect').value;
        if (transType === 'gamma') {
          const gamma = parseFloat(document.getElementById('m1_gamma_slider').value);
          SpatialTransformations.gammaTransform(this.inputImageData, this.outputImageData, gamma);
        } else if (transType === 'log') {
          const c = parseFloat(document.getElementById('m1_log_c_slider').value);
          SpatialTransformations.logTransform(this.inputImageData, this.outputImageData, c);
        } else if (transType === 'piecewise') {
          const r1 = parseInt(document.getElementById('m1_r1_slider').value);
          const s1 = parseInt(document.getElementById('m1_s1_slider').value);
          const r2 = parseInt(document.getElementById('m1_r2_slider').value);
          const s2 = parseInt(document.getElementById('m1_s2_slider').value);
          SpatialTransformations.piecewiseContrastStretch(this.inputImageData, this.outputImageData, r1, s1, r2, s2);
        } else if (transType === 'hist_eq') {
          SpatialTransformations.histogramEqualization(this.inputImageData, this.outputImageData);
        } else if (transType === 'distance_metric') {
          // Pass-through image, draw distance annotations on overlay
          DIPEngine.grayscaleToImageData(grayIn, this.width, this.height, this.outputImageData);
          const metrics = SpatialTransformations.computeDistanceMetrics(this.p1, this.p2, grayIn, this.width);
          document.getElementById('m1_p1_coord').textContent = `(${this.p1.x}, ${this.p1.y})`;
          document.getElementById('m1_p2_coord').textContent = `(${this.p2.x}, ${this.p2.y})`;
          document.getElementById('m1_dist_euclid').textContent = metrics.euclidean;
          document.getElementById('m1_dist_city').textContent = metrics.cityBlock;
          document.getElementById('m1_dist_chess').textContent = metrics.chessboard;
          document.getElementById('m1_m_path_status').textContent = metrics.mPathValid;
        }
      }

      // MODULE 2 PIPELINE
      else if (this.activeTab === 'module2') {
        const filterType = document.getElementById('m2_filterSelect').value;
        const activeKSizeBtn = document.querySelector('#m2_kernel_row .btn.btn-active');
        const kSize = activeKSizeBtn ? parseInt(activeKSizeBtn.getAttribute('data-ksize')) : 3;

        if (filterType === 'gaussian') {
          outBuffer = SpatialFilters.gaussianBlur(grayIn, this.width, this.height, kSize);
        } else if (filterType === 'box_blur') {
          outBuffer = SpatialFilters.boxBlur(grayIn, this.width, this.height, kSize);
        } else if (filterType === 'median') {
          outBuffer = SpatialFilters.medianFilter(grayIn, this.width, this.height, kSize);
        } else if (filterType === 'min_max') {
          const modeBtn = document.querySelector('#m2_minmax_controls .btn.btn-active');
          const mode = modeBtn ? modeBtn.getAttribute('data-minmax') : 'min';
          outBuffer = SpatialFilters.minMaxFilter(grayIn, this.width, this.height, kSize, mode);
        } else if (filterType === 'laplacian') {
          outBuffer = SpatialFilters.laplacianSharpen(grayIn, this.width, this.height, true);
        } else if (filterType === 'unsharp') {
          const boostA = parseFloat(document.getElementById('m2_boost_slider').value);
          outBuffer = SpatialFilters.unsharpHighBoost(grayIn, this.width, this.height, boostA, kSize);
        } else if (filterType === 'sobel') {
          const mode = document.getElementById('m2_edgeModeSelect').value;
          outBuffer = SpatialFilters.sobelEdge(grayIn, this.width, this.height, mode);
        } else if (filterType === 'prewitt') {
          outBuffer = SpatialFilters.prewittEdge(grayIn, this.width, this.height);
        } else if (filterType === 'roberts') {
          outBuffer = SpatialFilters.robertsEdge(grayIn, this.width, this.height);
        } else if (filterType === 'log_filter') {
          outBuffer = SpatialFilters.logFilter(grayIn, this.width, this.height);
        }

        if (outBuffer) {
          DIPEngine.grayscaleToImageData(outBuffer, this.width, this.height, this.outputImageData);
        }
      }

      // MODULE 3 PIPELINE
      else if (this.activeTab === 'module3') {
        const filterType = document.getElementById('m3_filterSelect').value;
        const D0 = parseFloat(document.getElementById('m3_d0_slider').value);
        const order = parseInt(document.getElementById('m3_order_slider').value);
        const notchR = parseFloat(document.getElementById('m3_notch_r_slider').value);
        const notchW = parseFloat(document.getElementById('m3_notch_w_slider').value);

        const activeViewBtn = document.querySelector('#pane-module3 [data-m3view].btn-active');
        const viewMode = activeViewBtn ? activeViewBtn.getAttribute('data-m3view') : 'spatial';

        outBuffer = FrequencyDomain.processFrequencyFilter(grayIn, this.width, filterType, D0, order, notchR, notchW, viewMode);
        if (outBuffer) {
          DIPEngine.grayscaleToImageData(outBuffer, this.width, this.height, this.outputImageData);
        }
      }

      // MODULE 4 PIPELINE
      else if (this.activeTab === 'module4') {
        const op = document.getElementById('m4_opSelect').value;
        const activeShapeBtn = document.querySelector('#m4_shape_group .btn.btn-active');
        const shape = activeShapeBtn ? activeShapeBtn.getAttribute('data-shape') : 'disk';
        const radius = parseInt(document.getElementById('m4_radius_slider').value);
        const binThresh = parseInt(document.getElementById('m4_bin_thresh_slider').value);

        const se = MorphologyEngine.createStructuringElement(shape, radius);

        // Pre-binarize for binary morphology operations
        const binIn = new Float32Array(grayIn.length);
        for (let i = 0; i < grayIn.length; i++) {
          binIn[i] = grayIn[i] >= binThresh ? 255 : 0;
        }

        if (op === 'dilation') {
          outBuffer = MorphologyEngine.dilation(grayIn, this.width, this.height, se);
        } else if (op === 'erosion') {
          outBuffer = MorphologyEngine.erosion(grayIn, this.width, this.height, se);
        } else if (op === 'opening') {
          outBuffer = MorphologyEngine.opening(grayIn, this.width, this.height, se);
        } else if (op === 'closing') {
          outBuffer = MorphologyEngine.closing(grayIn, this.width, this.height, se);
        } else if (op === 'boundary') {
          outBuffer = MorphologyEngine.boundaryExtraction(binIn, this.width, this.height, se);
        } else if (op === 'hit_or_miss') {
          outBuffer = MorphologyEngine.hitOrMiss(binIn, this.width, this.height);
        } else if (op === 'thinning') {
          outBuffer = MorphologyEngine.thinning(binIn, this.width, this.height);
        } else if (op === 'thickening') {
          outBuffer = MorphologyEngine.thickening(binIn, this.width, this.height);
        } else if (op === 'hole_fill') {
          outBuffer = MorphologyEngine.holeFilling(binIn, this.width, this.height);
        }

        if (outBuffer) {
          DIPEngine.grayscaleToImageData(outBuffer, this.width, this.height, this.outputImageData);
        }
      }

      // MODULE 5 PIPELINE
      else if (this.activeTab === 'module5') {
        const seg = document.getElementById('m5_segSelect').value;

        if (seg === 'otsu') {
          const res = SegmentationEngine.otsuThreshold(grayIn);
          outBuffer = res.output;
          document.getElementById('m5_otsu_k_val').textContent = res.bestThreshold;
        } else if (seg === 'adaptive') {
          const w = parseInt(document.getElementById('m5_adap_w_slider').value);
          const c = parseInt(document.getElementById('m5_adap_c_slider').value);
          outBuffer = SegmentationEngine.adaptiveThreshold(grayIn, this.width, this.height, w, c);
        } else if (seg === 'region_grow') {
          const tol = parseInt(document.getElementById('m5_grow_tol_slider').value);
          outBuffer = SegmentationEngine.regionGrowing(grayIn, this.width, this.height, this.seedCoord.x, this.seedCoord.y, tol);
        } else if (seg === 'split_merge') {
          const maxStd = parseInt(document.getElementById('m5_homo_slider').value);
          const minBlock = parseInt(document.getElementById('m5_block_slider').value);
          outBuffer = SegmentationEngine.regionSplitMerge(grayIn, this.width, this.height, maxStd, minBlock);
        } else if (seg === 'watershed') {
          outBuffer = SegmentationEngine.watershedSegmentation(grayIn, this.width, this.height);
        }

        if (outBuffer) {
          DIPEngine.grayscaleToImageData(outBuffer, this.width, this.height, this.outputImageData);
        }
      }

      // MODULE 6 PIPELINE
      else if (this.activeTab === 'module6') {
        const colorOp = document.getElementById('m6_colorSelect').value;
        const activeChBtn = document.querySelector('#m6_channel_group .btn.btn-active');
        const ch = activeChBtn ? activeChBtn.getAttribute('data-channel') : 'composite';

        if (colorOp === 'color_slice') {
          const hue = parseInt(document.getElementById('m6_slice_hue_slider').value);
          const tol = parseInt(document.getElementById('m6_slice_tol_slider').value);
          ColorSpaces.colorSlice(this.inputImageData, this.outputImageData, hue, tol);
        } else if (colorOp === 'color_edge') {
          ColorSpaces.colorVectorEdge(this.inputImageData, this.outputImageData);
        } else if (colorOp === 'pseudo_rainbow') {
          ColorSpaces.pseudoColorRainbow(grayIn, this.outputImageData);
        } else if (colorOp === 'hsi_convert') {
          // Channel decomposition
          const src = this.inputImageData.data;
          const dst = this.outputImageData.data;
          for (let i = 0; i < src.length; i += 4) {
            const hsi = ColorSpaces.rgbToHsi(src[i] / 255, src[i + 1] / 255, src[i + 2] / 255);
            if (ch === 'ch1') { // Hue
              const hVal = Math.round((hsi.H / 360.0) * 255);
              dst[i] = hVal; dst[i + 1] = hVal; dst[i + 2] = hVal;
            } else if (ch === 'ch2') { // Saturation
              const sVal = Math.round(hsi.S * 255);
              dst[i] = sVal; dst[i + 1] = sVal; dst[i + 2] = sVal;
            } else if (ch === 'ch3') { // Intensity
              const iVal = Math.round(hsi.I * 255);
              dst[i] = iVal; dst[i + 1] = iVal; dst[i + 2] = iVal;
            } else {
              // Composite HSI mapped to RGB
              const rgb = ColorSpaces.hsiToRgb(hsi.H, hsi.S, hsi.I);
              dst[i] = rgb.R; dst[i + 1] = rgb.G; dst[i + 2] = rgb.B;
            }
            dst[i + 3] = 255;
          }
        } else if (colorOp === 'ycbcr_convert') {
          const src = this.inputImageData.data;
          const dst = this.outputImageData.data;
          for (let i = 0; i < src.length; i += 4) {
            const { Y, Cb, Cr } = ColorSpaces.rgbToYCbCr(src[i], src[i + 1], src[i + 2]);
            if (ch === 'ch1') {
              dst[i] = Y; dst[i + 1] = Y; dst[i + 2] = Y;
            } else if (ch === 'ch2') {
              dst[i] = Cb; dst[i + 1] = Cb; dst[i + 2] = Cb;
            } else if (ch === 'ch3') {
              dst[i] = Cr; dst[i + 1] = Cr; dst[i + 2] = Cr;
            } else {
              dst[i] = Y; dst[i + 1] = Cb; dst[i + 2] = Cr;
            }
            dst[i + 3] = 255;
          }
        } else if (colorOp === 'cmyk_convert') {
          const src = this.inputImageData.data;
          const dst = this.outputImageData.data;
          for (let i = 0; i < src.length; i += 4) {
            const { C, M, Y, K } = ColorSpaces.rgbToCmyk(src[i], src[i + 1], src[i + 2]);
            if (ch === 'ch1') {
              dst[i] = C; dst[i + 1] = C; dst[i + 2] = C;
            } else if (ch === 'ch2') {
              dst[i] = M; dst[i + 1] = M; dst[i + 2] = M;
            } else if (ch === 'ch3') {
              dst[i] = Y; dst[i + 1] = Y; dst[i + 2] = Y;
            } else {
              dst[i] = 255 - C; dst[i + 1] = 255 - M; dst[i + 2] = 255 - Y;
            }
            dst[i + 3] = 255;
          }
        }
      }

      // Put processed image to output canvas
      this.outputCtx.putImageData(this.outputImageData, 0, 0);

      // Update Split Canvases if in split view
      if (this.isSplitView) {
        this.updateSplitCanvases();
      }

      // Draw spatial overlays (landmarks, distances, seeds)
      this.renderOverlays();

      // Render Histograms
      const outGray = DIPEngine.toGrayscaleArray(this.outputImageData);
      const histIn = DIPEngine.computeHistogram(grayIn);
      const histOut = DIPEngine.computeHistogram(outGray);
      DIPEngine.renderHistogram(this.inputHistCanvas, histIn, '#8b5cf6');
      DIPEngine.renderHistogram(this.outputHistCanvas, histOut, '#06b6d4');

      const t1 = performance.now();
      this.processingTime = t1 - t0;
      document.getElementById('msMetric').textContent = `${this.processingTime.toFixed(2)} ms`;
    }

    /**
     * Render Canvas Overlays (Distance measurements, Seed point markers)
     */
    renderOverlays() {
      this.inputOverlayCtx.clearRect(0, 0, this.width, this.height);
      this.outputOverlayCtx.clearRect(0, 0, this.width, this.height);

      if (this.activeTab === 'module1' && document.getElementById('m1_transformSelect').value === 'distance_metric') {
        // Draw P1 and P2 markers and distance connecting line
        const ctx = this.inputOverlayCtx;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // P1
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(this.p1.x, this.p1.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Inter';
        ctx.fillText('P1', this.p1.x + 8, this.p1.y - 4);

        // P2
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.arc(this.p2.x, this.p2.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillText('P2', this.p2.x + 8, this.p2.y - 4);
      } else if (this.activeTab === 'module5' && document.getElementById('m5_segSelect').value === 'region_grow') {
        // Draw Seed marker
        const ctx = this.inputOverlayCtx;
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.seedCoord.x, this.seedCoord.y, 6, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.seedCoord.x - 9, this.seedCoord.y);
        ctx.lineTo(this.seedCoord.x + 9, this.seedCoord.y);
        ctx.moveTo(this.seedCoord.x, this.seedCoord.y - 9);
        ctx.lineTo(this.seedCoord.x, this.seedCoord.y + 9);
        ctx.stroke();
      }
    }

    /**
     * Main Animation & Render Loop
     */
    renderLoop(currentTime) {
      const delta = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;
      if (delta > 0) {
        const instantFps = 1000.0 / delta;
        this.fps = this.fps * 0.9 + instantFps * 0.1;
        document.getElementById('fpsMetric').textContent = this.fps.toFixed(1);
      }

      requestAnimationFrame((t) => this.renderLoop(t));
    }
  }

  // Application Entry Point
  window.addEventListener('DOMContentLoaded', () => {
    window.app = new UIController();
    console.log('Interactive Touchless DIP Laboratory initialized successfully.');
  });
  </script>
</body>
</html>
