  // ==========================================
  // MODULE 6: COLOR IMAGE PROCESSING (Unit 7)
  // RGB <-> HSI, RGB <-> YCbCr, RGB <-> CMYK, Color Slicing, Color Vector Edge Detection
  // ==========================================
  class ColorSpaces {
    /**
     * RGB to HSI Conversion:
     * \theta = \arccos \left( \frac{\frac{1}{2}[(R-G) + (R-B)]}{\sqrt{(R-G)^2 + (R-B)(G-B)}} \right)
     * H = \theta if B <= G else 360 - \theta
     * S = 1 - \frac{3}{R+G+B} \min(R,G,B)
     * I = \frac{R+G+B}{3}
     */
    static rgbToHsi(rNorm, gNorm, bNorm) {
      const num = 0.5 * ((rNorm - gNorm) + (rNorm - bNorm));
      const den = Math.sqrt((rNorm - gNorm) * (rNorm - gNorm) + (rNorm - bNorm) * (gNorm - bNorm)) + 1e-6;
      let theta = Math.acos(Math.min(1.0, Math.max(-1.0, num / den))) * (180.0 / Math.PI);

      let H = bNorm <= gNorm ? theta : (360.0 - theta);
      const sum = rNorm + gNorm + bNorm;
      let S = 0;
      if (sum > 1e-6) {
        const minVal = Math.min(rNorm, Math.min(gNorm, bNorm));
        S = 1.0 - (3.0 / sum) * minVal;
      }
      const I = sum / 3.0;

      return { H, S, I };
    }

    /**
     * HSI to RGB Conversion:
     * Inverse mapping across sectors [0, 120), [120, 240), [240, 360)
     */
    static hsiToRgb(H, S, I) {
      let r = 0, g = 0, b = 0;
      let hRad;

      if (H < 120) {
        hRad = (H * Math.PI) / 180.0;
        b = I * (1.0 - S);
        r = I * (1.0 + (S * Math.cos(hRad)) / Math.cos((60.0 * Math.PI) / 180.0 - hRad));
        g = 3.0 * I - (r + b);
      } else if (H < 240) {
        const hShift = H - 120.0;
        hRad = (hShift * Math.PI) / 180.0;
        r = I * (1.0 - S);
        g = I * (1.0 + (S * Math.cos(hRad)) / Math.cos((60.0 * Math.PI) / 180.0 - hRad));
        b = 3.0 * I - (r + g);
      } else {
        const hShift = H - 240.0;
        hRad = (hShift * Math.PI) / 180.0;
        g = I * (1.0 - S);
        b = I * (1.0 + (S * Math.cos(hRad)) / Math.cos((60.0 * Math.PI) / 180.0 - hRad));
        r = 3.0 * I - (g + b);
      }

      return {
        R: Math.min(255, Math.max(0, Math.round(r * 255.0))),
        G: Math.min(255, Math.max(0, Math.round(g * 255.0))),
        B: Math.min(255, Math.max(0, Math.round(b * 255.0)))
      };
    }

    /**
     * RGB to YCbCr:
     * Y  =  0.299*R + 0.587*G + 0.114*B
     * Cb = -0.168736*R - 0.331264*G + 0.5*B + 128
     * Cr =  0.5*R - 0.418688*G - 0.081312*B + 128
     */
    static rgbToYCbCr(R, G, B) {
      const Y = 0.299 * R + 0.587 * G + 0.114 * B;
      const Cb = -0.168736 * R - 0.331264 * G + 0.5 * B + 128;
      const Cr = 0.5 * R - 0.418688 * G - 0.081312 * B + 128;
      return { Y, Cb, Cr };
    }

    /**
     * RGB to CMYK Subtractive:
     * K = 1 - max(R', G', B')
     * C = (1 - R' - K) / (1 - K)
     */
    static rgbToCmyk(R, G, B) {
      const r = R / 255.0;
      const g = G / 255.0;
      const b = B / 255.0;
      const k = 1.0 - Math.max(r, Math.max(g, b));
      if (k >= 0.999) return { C: 0, M: 0, Y: 0, K: 255 };

      const c = (1.0 - r - k) / (1.0 - k);
      const m = (1.0 - g - k) / (1.0 - k);
      const y = (1.0 - b - k) / (1.0 - k);

      return {
        C: Math.round(c * 255),
        M: Math.round(m * 255),
        Y: Math.round(y * 255),
        K: Math.round(k * 255)
      };
    }

    /**
     * HSI Color Slicing:
     * Highlights pixels within a specified range in Hue space, attenuating outside pixels
     */
    static colorSlice(srcData, dstData, centerHue = 30, tolerance = 35) {
      const src = srcData.data;
      const dst = dstData.data;

      for (let i = 0; i < src.length; i += 4) {
        const rNorm = src[i] / 255.0;
        const gNorm = src[i + 1] / 255.0;
        const bNorm = src[i + 2] / 255.0;

        const { H, S, I } = ColorSpaces.rgbToHsi(rNorm, gNorm, bNorm);

        // Compute circular angular distance in Hue [0, 360]
        let diff = Math.abs(H - centerHue);
        if (diff > 180) diff = 360 - diff;

        if (diff <= tolerance && S > 0.15) {
          // In range: retain or accentuate original color
          dst[i] = src[i];
          dst[i + 1] = src[i + 1];
          dst[i + 2] = src[i + 2];
        } else {
          // Out of range: desaturate to grayscale background
          const gray = Math.round(I * 255.0 * 0.4);
          dst[i] = gray;
          dst[i + 1] = gray;
          dst[i + 2] = gray;
        }
        dst[i + 3] = 255;
      }
      return dstData;
    }

    /**
     * Color Edge Detection (Di Zenzo Multi-Spectral Gradient Vector Calculation):
     * u = \partial c / \partial x, v = \partial c / \partial y
     * g_xx = |u|^2, g_yy = |v|^2, g_xy = u \cdot v
     * Maximum rate of change: \lambda = \frac{1}{2}[(g_xx + g_yy) + \sqrt{(g_xx - g_yy)^2 + 4 g_xy^2}]
     */
    static colorVectorEdge(srcData, dstData) {
      const src = srcData.data;
      const dst = dstData.data;
      const w = srcData.width;
      const h = srcData.height;

      // Extract RGB channels
      const R = new Float32Array(w * h);
      const G = new Float32Array(w * h);
      const B = new Float32Array(w * h);

      for (let i = 0, j = 0; i < src.length; i += 4, j++) {
        R[j] = src[i];
        G[j] = src[i + 1];
        B[j] = src[i + 2];
      }

      // Sobel kernel for derivatives
      const kGx = new Float32Array([-1, 0, 1, -2, 0, 2, -1, 0, 1]);
      const kGy = new Float32Array([-1, -2, -1, 0, 0, 0, 1, 2, 1]);

      const rx = SpatialFilters.convolve2D(R, w, h, kGx, 3, 1.0);
      const ry = SpatialFilters.convolve2D(R, w, h, kGy, 3, 1.0);
      const gx = SpatialFilters.convolve2D(G, w, h, kGx, 3, 1.0);
      const gy = SpatialFilters.convolve2D(G, w, h, kGy, 3, 1.0);
      const bx = SpatialFilters.convolve2D(B, w, h, kGx, 3, 1.0);
      const by = SpatialFilters.convolve2D(B, w, h, kGy, 3, 1.0);

      for (let i = 0, j = 0; i < w * h; i++, j += 4) {
        const gxx = rx[i] * rx[i] + gx[i] * gx[i] + bx[i] * bx[i];
        const gyy = ry[i] * ry[i] + gy[i] * gy[i] + by[i] * by[i];
        const gxy = rx[i] * ry[i] + gx[i] * gy[i] + bx[i] * by[i];

        // Eigenvalue calculation for gradient magnitude
        const trace = gxx + gyy;
        const diff = gxx - gyy;
        const root = Math.sqrt(diff * diff + 4.0 * gxy * gxy);
        const lambda = Math.sqrt(Math.max(0, 0.5 * (trace + root)));

        const edgeVal = Math.min(255, Math.round(lambda));
        dst[j] = edgeVal;
        dst[j + 1] = edgeVal;
        dst[j + 2] = edgeVal;
        dst[j + 3] = 255;
      }
      return dstData;
    }

    /**
     * Pseudo-Color Jet / Rainbow Colormap LUT
     */
    static pseudoColorRainbow(grayIn, dstData) {
      const dst = dstData.data;
      for (let i = 0, j = 0; i < grayIn.length; i++, j += 4) {
        const val = grayIn[i] / 255.0; // [0, 1]
        // Jet-like rainbow mapping
        let r = Math.min(1.0, Math.max(0.0, 1.5 - Math.abs(val * 4.0 - 3.0)));
        let g = Math.min(1.0, Math.max(0.0, 1.5 - Math.abs(val * 4.0 - 2.0)));
        let b = Math.min(1.0, Math.max(0.0, 1.5 - Math.abs(val * 4.0 - 1.0)));

        dst[j] = Math.round(r * 255);
        dst[j + 1] = Math.round(g * 255);
        dst[j + 2] = Math.round(b * 255);
        dst[j + 3] = 255;
      }
      return dstData;
    }
  }
