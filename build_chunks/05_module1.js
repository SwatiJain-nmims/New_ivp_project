  <!-- JAVASCRIPT DIP ENGINE & MODULAR ARCHITECTURE -->
  <script>
  /**
   * INTERACTIVE TOUCHLESS DIP LABORATORY & DIAGNOSTIC SUITE
   * Pure Vanilla JavaScript DIP Algorithms (Operating directly on ImageData.data)
   * Units 1-7 Standard Computer Vision / Digital Image Processing Curriculum
   */

  // ==========================================
  // CORE DIP UTILITIES & DATA STRUCTURES
  // ==========================================
  class DIPEngine {
    constructor() {
      this.width = 256;
      this.height = 256;
    }

    /**
     * Create an empty ImageData object
     */
    static createEmptyImageData(ctx, width, height) {
      return ctx.createImageData(width, height);
    }

    /**
     * Clone ImageData
     */
    static cloneImageData(imgData) {
      const copy = new ImageData(
        new Uint8ClampedArray(imgData.data),
        imgData.width,
        imgData.height
      );
      return copy;
    }

    /**
     * Convert RGB ImageData to Grayscale single-channel Float32Array or Uint8Array
     * Standard Luminance: Y = 0.299*R + 0.587*G + 0.114*B
     */
    static toGrayscaleArray(imgData) {
      const data = imgData.data;
      const len = imgData.width * imgData.height;
      const gray = new Uint8Array(len);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }
      return gray;
    }

    /**
     * Convert Grayscale Array back to RGBA ImageData
     */
    static grayscaleToImageData(grayArray, width, height, targetImgData) {
      const d = targetImgData.data;
      const len = width * height;
      for (let i = 0, j = 0; i < len; i++, j += 4) {
        const val = grayArray[i];
        d[j] = val;
        d[j + 1] = val;
        d[j + 2] = val;
        d[j + 3] = 255;
      }
      return targetImgData;
    }

    /**
     * Compute 256-bin Histogram for Grayscale Image
     */
    static computeHistogram(grayArray) {
      const hist = new Int32Array(256);
      for (let i = 0; i < grayArray.length; i++) {
        hist[grayArray[i]]++;
      }
      return hist;
    }

    /**
     * Compute Probability Density Function (PDF) and Cumulative Distribution Function (CDF)
     */
    static computePDFandCDF(hist, totalPixels) {
      const pdf = new Float32Array(256);
      const cdf = new Float32Array(256);
      let cumulative = 0;
      for (let i = 0; i < 256; i++) {
        pdf[i] = hist[i] / totalPixels;
        cumulative += pdf[i];
        cdf[i] = cumulative;
      }
      return { pdf, cdf };
    }

    /**
     * Render Histogram Bars to an HTML5 Canvas
     */
    static renderHistogram(canvas, hist, color = '#06b6d4') {
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Find max bin value
      let maxVal = 1;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > maxVal) maxVal = hist[i];
      }

      ctx.fillStyle = color;
      const barWidth = w / 256;
      for (let i = 0; i < 256; i++) {
        const barHeight = (hist[i] / maxVal) * (h - 4);
        ctx.fillRect(i * barWidth, h - barHeight, Math.max(1, barWidth), barHeight);
      }
    }
  }

  // ==========================================
  // MODULE 1: SPATIAL & POINT TRANSFORMATIONS (Units 1 & 2)
  // ==========================================
  class SpatialTransformations {
    /**
     * Power-Law (Gamma) Transformation: s = c * r^gamma
     * r is normalized intensity in [0, 1]
     */
    static gammaTransform(srcData, dstData, gamma = 1.0, c = 1.0) {
      const src = srcData.data;
      const dst = dstData.data;
      // Precompute 256-entry lookup table (LUT) for maximum performance
      const lut = new Uint8Array(256);
      for (let r = 0; r < 256; r++) {
        const normR = r / 255.0;
        const s = c * Math.pow(normR, gamma);
        lut[r] = Math.min(255, Math.max(0, Math.round(s * 255.0)));
      }

      for (let i = 0; i < src.length; i += 4) {
        dst[i] = lut[src[i]];
        dst[i + 1] = lut[src[i + 1]];
        dst[i + 2] = lut[src[i + 2]];
        dst[i + 3] = src[i + 3];
      }
      return dstData;
    }

    /**
     * Logarithmic Transformation: s = c * log(1 + r)
     * Dynamic range expansion of dark pixels
     */
    static logTransform(srcData, dstData, scaleC = 1.0) {
      const src = srcData.data;
      const dst = dstData.data;
      const c = (255.0 / Math.log(1 + 255.0)) * scaleC;
      const lut = new Uint8Array(256);
      for (let r = 0; r < 256; r++) {
        const s = c * Math.log(1.0 + r);
        lut[r] = Math.min(255, Math.max(0, Math.round(s)));
      }

      for (let i = 0; i < src.length; i += 4) {
        dst[i] = lut[src[i]];
        dst[i + 1] = lut[src[i + 1]];
        dst[i + 2] = lut[src[i + 2]];
        dst[i + 3] = src[i + 3];
      }
      return dstData;
    }

    /**
     * Piecewise-Linear Contrast Stretching:
     * Line 1: (0, 0) to (r1, s1)
     * Line 2: (r1, s1) to (r2, s2)
     * Line 3: (r2, s2) to (255, 255)
     */
    static piecewiseContrastStretch(srcData, dstData, r1 = 50, s1 = 10, r2 = 200, s2 = 245) {
      const src = srcData.data;
      const dst = dstData.data;
      if (r1 >= r2) r2 = r1 + 1;

      const m1 = r1 > 0 ? s1 / r1 : 0;
      const m2 = (s2 - s1) / (r2 - r1);
      const m3 = (255 - r2) > 0 ? (255 - s2) / (255 - r2) : 0;

      const lut = new Uint8Array(256);
      for (let r = 0; r < 256; r++) {
        let s;
        if (r < r1) {
          s = m1 * r;
        } else if (r <= r2) {
          s = m2 * (r - r1) + s1;
        } else {
          s = m3 * (r - r2) + s2;
        }
        lut[r] = Math.min(255, Math.max(0, Math.round(s)));
      }

      for (let i = 0; i < src.length; i += 4) {
        dst[i] = lut[src[i]];
        dst[i + 1] = lut[src[i + 1]];
        dst[i + 2] = lut[src[i + 2]];
        dst[i + 3] = src[i + 3];
      }
      return dstData;
    }

    /**
     * Histogram Equalization:
     * s_k = T(r_k) = (L - 1) * sum_{j=0}^k p_r(r_j) = (L - 1) * CDF(r_k)
     */
    static histogramEqualization(srcData, dstData) {
      const gray = DIPEngine.toGrayscaleArray(srcData);
      const totalPixels = gray.length;
      const hist = DIPEngine.computeHistogram(gray);
      const { cdf } = DIPEngine.computePDFandCDF(hist, totalPixels);

      // Lookup table mapping
      const lut = new Uint8Array(256);
      for (let r = 0; r < 256; r++) {
        lut[r] = Math.round(255.0 * cdf[r]);
      }

      const dst = dstData.data;
      for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
        const eqVal = lut[gray[i]];
        dst[j] = eqVal;
        dst[j + 1] = eqVal;
        dst[j + 2] = eqVal;
        dst[j + 3] = 255;
      }
      return dstData;
    }

    /**
     * Distance Metric Engine:
     * Euclidean: sqrt((x1-x2)^2 + (y1-y2)^2)
     * City-Block (D4): |x1-x2| + |y1-y2|
     * Chessboard (D8): max(|x1-x2|, |y1-y2|)
     * m-path Connectivity Test between P1 and P2
     */
    static computeDistanceMetrics(p1, p2, binaryGrid = null, width = 256) {
      const dx = Math.abs(p1.x - p2.x);
      const dy = Math.abs(p1.y - p2.y);
      const euclidean = Math.sqrt(dx * dx + dy * dy);
      const cityBlock = dx + dy;
      const chessboard = Math.max(dx, dy);

      // m-path adjacency check:
      // Two pixels p and q with values from V are m-adjacent if:
      // (1) q is in N_4(p), or
      // (2) q is in N_D(p) and the set N_4(p) intersect N_4(q) has no pixels with values from V.
      let mPathValid = true;
      if (binaryGrid) {
        const vSet = 1;
        const p1Val = binaryGrid[p1.y * width + p1.x] > 128 ? 1 : 0;
        const p2Val = binaryGrid[p2.y * width + p2.x] > 128 ? 1 : 0;
        mPathValid = (p1Val === vSet && p2Val === vSet);
      }

      return {
        euclidean: euclidean.toFixed(2),
        cityBlock: cityBlock,
        chessboard: chessboard,
        mPathValid: mPathValid ? 'Valid Connectivity' : 'No Continuous Path'
      };
    }
  }
