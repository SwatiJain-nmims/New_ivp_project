  // ==========================================
  // SYNTHETIC PHANTOM & PRESET IMAGE GENERATOR
  // Pure Canvas ImageData programmatic image synthesizers
  // ==========================================
  class TestPatternGenerator {
    /**
     * Medical Diagnostic Phantom:
     * Elliptical brain parenchyma, ventricles, high-contrast lesions, and subtle gray-scale structures
     */
    static createMedicalPhantom(width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Dark background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);

      // Skull boundary
      ctx.fillStyle = '#c8c8c8';
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, width * 0.42, height * 0.46, 0, 0, 2 * Math.PI);
      ctx.fill();

      // Brain parenchyma
      ctx.fillStyle = '#646464';
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, width * 0.38, height * 0.42, 0, 0, 2 * Math.PI);
      ctx.fill();

      // Ventricles (dark fluid)
      ctx.fillStyle = '#202020';
      ctx.beginPath();
      ctx.ellipse(width * 0.43, height * 0.48, width * 0.06, height * 0.16, -0.2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(width * 0.57, height * 0.48, width * 0.06, height * 0.16, 0.2, 0, 2 * Math.PI);
      ctx.fill();

      // Lesion 1 (Hyperintense bright tumor with diffuse edge)
      const grad = ctx.createRadialGradient(width * 0.32, height * 0.32, 2, width * 0.32, height * 0.32, width * 0.08);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.6, '#b0b0b0');
      grad.addColorStop(1, '#646464');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(width * 0.32, height * 0.32, width * 0.08, 0, 2 * Math.PI);
      ctx.fill();

      // Lesion 2 (Hypointense ischemic stroke area)
      ctx.fillStyle = '#323232';
      ctx.beginPath();
      ctx.arc(width * 0.65, height * 0.65, width * 0.06, 0, 2 * Math.PI);
      ctx.fill();

      // Fine vascular micro-calcifications
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        const ang = i * (Math.PI / 4);
        ctx.fillRect(width * 0.5 + Math.cos(ang) * 45, height * 0.72 + Math.sin(ang) * 15, 2, 2);
      }

      return ctx.getImageData(0, 0, width, height);
    }

    /**
     * Chest X-Ray Specimen Simulation
     */
    static createChestXRay(width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#101010';
      ctx.fillRect(0, 0, width, height);

      // Spine & Mediastinum
      ctx.fillStyle = '#8c8c8c';
      ctx.fillRect(width * 0.45, 0, width * 0.1, height);

      // Lungs (Radiolucent dark lobes)
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath();
      ctx.ellipse(width * 0.28, height * 0.48, width * 0.16, height * 0.35, -0.1, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(width * 0.72, height * 0.48, width * 0.16, height * 0.35, 0.1, 0, 2 * Math.PI);
      ctx.fill();

      // Rib Cage Arcs
      ctx.strokeStyle = '#505050';
      ctx.lineWidth = 3;
      for (let y = height * 0.2; y < height * 0.85; y += 22) {
        ctx.beginPath();
        ctx.ellipse(width * 0.5, y, width * 0.42, 12, 0, 0, Math.PI);
        ctx.stroke();
      }

      // Cardiac Silhouette
      ctx.fillStyle = '#787878';
      ctx.beginPath();
      ctx.ellipse(width * 0.52, height * 0.60, width * 0.14, height * 0.18, 0.35, 0, 2 * Math.PI);
      ctx.fill();

      return ctx.getImageData(0, 0, width, height);
    }

    /**
     * Retinal Vessel Tree
     */
    static createRetinalScan(width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Orange-red fundus background
      ctx.fillStyle = '#3b1208';
      ctx.fillRect(0, 0, width, height);
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, width * 0.45, 0, 2 * Math.PI);
      ctx.fillStyle = '#7a2810';
      ctx.fill();

      // Optic Disc
      ctx.fillStyle = '#e8a860';
      ctx.beginPath();
      ctx.arc(width * 0.35, height * 0.5, width * 0.08, 0, 2 * Math.PI);
      ctx.fill();

      // Blood vessel branches
      ctx.strokeStyle = '#380a02';
      ctx.lineWidth = 2.5;
      const startX = width * 0.35;
      const startY = height * 0.5;

      const angles = [0.2, -0.3, 0.8, -0.9, 1.4, -1.5, 2.5, -2.5];
      for (let ang of angles) {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        let cx = startX;
        let cy = startY;
        for (let step = 0; step < 5; step++) {
          cx += Math.cos(ang) * 18 + (Math.random() - 0.5) * 6;
          cy += Math.sin(ang) * 18 + (Math.random() - 0.5) * 6;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }

      return ctx.getImageData(0, 0, width, height);
    }

    /**
     * Morphological Test Shapes: Squares, Circles, Holes, Thin Lines
     */
    static createMorphShapes(width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#ffffff';
      // Solid rectangle
      ctx.fillRect(25, 25, 60, 50);

      // Circle with hollow hole
      ctx.beginPath();
      ctx.arc(180, 55, 35, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(180, 55, 15, 0, 2 * Math.PI);
      ctx.fill();

      // Cross shape
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(150, 160, 60, 18);
      ctx.fillRect(171, 140, 18, 60);

      // Thin lines & noisy dots
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(30, 150);
      ctx.lineTo(90, 220);
      ctx.stroke();

      for (let i = 0; i < 15; i++) {
        const rx = 30 + (i * 7) % 80;
        const ry = 140 + (i * 13) % 80;
        ctx.fillRect(rx, ry, 2, 2);
      }

      return ctx.getImageData(0, 0, width, height);
    }

    /**
     * Sinusoidal Periodic Noise Pattern
     */
    static createPeriodicNoise(width, height) {
      const imgData = TestPatternGenerator.createMedicalPhantom(width, height);
      const data = imgData.data;

      // Superimpose sinusoidal frequency noise: N(x,y) = A * sin(2*pi*u0*x/M + 2*pi*v0*y/N)
      const u0 = 24.0;
      const v0 = 16.0;
      const amp = 40.0;

      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          const noise = amp * Math.sin((2.0 * Math.PI * u0 * x) / width + (2.0 * Math.PI * v0 * y) / height);
          const idx = (row + x) * 4;
          const val = Math.min(255, Math.max(0, data[idx] + noise));
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
        }
      }
      return imgData;
    }

    /**
     * Color Space Calibration Chart
     */
    static createColorCalibrationChart(width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Multi-hue color wheel gradient
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - width / 2;
          const dy = y - height / 2;
          const r = Math.sqrt(dx * dx + dy * dy);
          if (r < width * 0.45) {
            let angle = Math.atan2(dy, dx) * (180 / Math.PI);
            if (angle < 0) angle += 360;
            const sat = Math.min(100, (r / (width * 0.45)) * 100);
            ctx.fillStyle = `hsl(${angle}, ${sat}%, 50%)`;
            ctx.fillRect(x, y, 1, 1);
          } else {
            ctx.fillStyle = '#111827';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }

      // Center color squares
      ctx.fillStyle = '#ff0000'; ctx.fillRect(20, 20, 30, 30);
      ctx.fillStyle = '#00ff00'; ctx.fillRect(60, 20, 30, 30);
      ctx.fillStyle = '#0000ff'; ctx.fillRect(100, 20, 30, 30);
      ctx.fillStyle = '#ffff00'; ctx.fillRect(20, 60, 30, 30);
      ctx.fillStyle = '#00ffff'; ctx.fillRect(60, 60, 30, 30);
      ctx.fillStyle = '#ff00ff'; ctx.fillRect(100, 60, 30, 30);

      return ctx.getImageData(0, 0, width, height);
    }
  }
