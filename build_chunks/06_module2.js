  // ==========================================
  // MODULE 2: SPATIAL FILTERING & CONVOLUTION (Units 2 & 5)
  // ==========================================
  class SpatialFilters {
    /**
     * Discrete 2D Spatial Convolution with custom kernel matrix
     * Handles symmetric zero-padding / border replication at image boundaries
     */
    static convolve2D(grayIn, width, height, kernel, kSize, normalizeFactor = 1.0, offset = 0) {
      const output = new Float32Array(width * height);
      const half = Math.floor(kSize / 2);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0;
          for (let ky = -half; ky <= half; ky++) {
            const py = Math.min(height - 1, Math.max(0, y + ky));
            const rowOffset = py * width;
            const kRowOffset = (ky + half) * kSize;
            for (let kx = -half; kx <= half; kx++) {
              const px = Math.min(width - 1, Math.max(0, x + kx));
              const weight = kernel[kRowOffset + (kx + half)];
              sum += grayIn[rowOffset + px] * weight;
            }
          }
          output[y * width + x] = (sum * normalizeFactor) + offset;
        }
      }
      return output;
    }

    /**
     * Box / Mean Smoothing Filter (3x3, 5x5, 7x7)
     */
    static boxBlur(grayIn, width, height, kSize = 3) {
      const len = kSize * kSize;
      const kernel = new Float32Array(len).fill(1.0);
      const norm = 1.0 / len;
      return SpatialFilters.convolve2D(grayIn, width, height, kernel, kSize, norm);
    }

    /**
     * Gaussian Smoothing Kernel Generation:
     * G(x, y) = (1 / (2*pi*sigma^2)) * exp(-(x^2 + y^2) / (2*sigma^2))
     */
    static gaussianBlur(grayIn, width, height, kSize = 3) {
      const half = Math.floor(kSize / 2);
      const sigma = kSize / 3.0;
      const kernel = new Float32Array(kSize * kSize);
      let sum = 0;
      for (let y = -half; y <= half; y++) {
        for (let x = -half; x <= half; x++) {
          const g = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
          kernel[(y + half) * kSize + (x + half)] = g;
          sum += g;
        }
      }
      return SpatialFilters.convolve2D(grayIn, width, height, kernel, kSize, 1.0 / sum);
    }

    /**
     * Non-Linear Median Filter:
     * Manual window sorting to eliminate salt-and-pepper noise while preserving edges
     */
    static medianFilter(grayIn, width, height, kSize = 3) {
      const output = new Float32Array(width * height);
      const half = Math.floor(kSize / 2);
      const windowLen = kSize * kSize;
      const window = new Uint8Array(windowLen);
      const mid = Math.floor(windowLen / 2);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let idx = 0;
          for (let ky = -half; ky <= half; ky++) {
            const py = Math.min(height - 1, Math.max(0, y + ky));
            const rowOffset = py * width;
            for (let kx = -half; kx <= half; kx++) {
              const px = Math.min(width - 1, Math.max(0, x + kx));
              window[idx++] = grayIn[rowOffset + px];
            }
          }
          // Sort window array in-place
          window.sort();
          output[y * width + x] = window[mid];
        }
      }
      return output;
    }

    /**
     * Non-Linear Min / Max Filter
     */
    static minMaxFilter(grayIn, width, height, kSize = 3, mode = 'min') {
      const output = new Float32Array(width * height);
      const half = Math.floor(kSize / 2);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let extreme = mode === 'min' ? 255 : 0;
          for (let ky = -half; ky <= half; ky++) {
            const py = Math.min(height - 1, Math.max(0, y + ky));
            const rowOffset = py * width;
            for (let kx = -half; kx <= half; kx++) {
              const px = Math.min(width - 1, Math.max(0, x + kx));
              const val = grayIn[rowOffset + px];
              if (mode === 'min') {
                if (val < extreme) extreme = val;
              } else {
                if (val > extreme) extreme = val;
              }
            }
          }
          output[y * width + x] = extreme;
        }
      }
      return output;
    }

    /**
     * Laplacian Operator:
     * Standard discrete approximation: [0 1 0; 1 -4 1; 0 1 0] or [1 1 1; 1 -8 1; 1 1 1]
     * Sharpened: g(x,y) = f(x,y) - \nabla^2 f(x,y)
     */
    static laplacianSharpen(grayIn, width, height, diagonal = true) {
      const kernel = diagonal ?
        new Float32Array([1, 1, 1, 1, -8, 1, 1, 1, 1]) :
        new Float32Array([0, 1, 0, 1, -4, 1, 0, 1, 0]);

      const laplacian = SpatialFilters.convolve2D(grayIn, width, height, kernel, 3, 1.0);
      const output = new Float32Array(width * height);
      for (let i = 0; i < output.length; i++) {
        // Subtract laplacian if center is negative
        const sharpened = grayIn[i] - laplacian[i];
        output[i] = Math.min(255, Math.max(0, sharpened));
      }
      return output;
    }

    /**
     * Unsharp Masking & High-Boost Filtering:
     * f_hb(x,y) = A * f(x,y) - f_smooth(x,y) = (A - 1)*f(x,y) + (f(x,y) - f_smooth(x,y))
     */
    static unsharpHighBoost(grayIn, width, height, A = 1.5, kSize = 3) {
      const smooth = SpatialFilters.gaussianBlur(grayIn, width, height, kSize);
      const output = new Float32Array(width * height);
      for (let i = 0; i < output.length; i++) {
        const mask = grayIn[i] - smooth[i];
        const val = A * grayIn[i] - smooth[i];
        output[i] = Math.min(255, Math.max(0, val));
      }
      return output;
    }

    /**
     * Sobel Gradient Operators:
     * Gx = [-1 0 1; -2 0 2; -1 0 1], Gy = [-1 -2 -1; 0 0 0; 1 2 1]
     * Magnitude: |G| = sqrt(Gx^2 + Gy^2), Direction: theta = atan2(Gy, Gx)
     */
    static sobelEdge(grayIn, width, height, mode = 'magnitude') {
      const kGx = new Float32Array([-1, 0, 1, -2, 0, 2, -1, 0, 1]);
      const kGy = new Float32Array([-1, -2, -1, 0, 0, 0, 1, 2, 1]);

      const gx = SpatialFilters.convolve2D(grayIn, width, height, kGx, 3, 1.0);
      const gy = SpatialFilters.convolve2D(grayIn, width, height, kGy, 3, 1.0);

      const len = width * height;
      const output = new Float32Array(len);

      if (mode === 'gx') {
        for (let i = 0; i < len; i++) output[i] = Math.min(255, Math.max(0, Math.abs(gx[i])));
      } else if (mode === 'gy') {
        for (let i = 0; i < len; i++) output[i] = Math.min(255, Math.max(0, Math.abs(gy[i])));
      } else if (mode === 'direction') {
        // Map angle [-pi, pi] to [0, 255]
        for (let i = 0; i < len; i++) {
          const theta = Math.atan2(gy[i], gx[i]); // radians [-pi, pi]
          output[i] = ((theta + Math.PI) / (2 * Math.PI)) * 255.0;
        }
      } else {
        // Magnitude
        for (let i = 0; i < len; i++) {
          const mag = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
          output[i] = Math.min(255, Math.max(0, mag));
        }
      }
      return output;
    }

    /**
     * Prewitt Edge Operator:
     * Gx = [-1 0 1; -1 0 1; -1 0 1], Gy = [-1 -1 -1; 0 0 0; 1 1 1]
     */
    static prewittEdge(grayIn, width, height) {
      const kGx = new Float32Array([-1, 0, 1, -1, 0, 1, -1, 0, 1]);
      const kGy = new Float32Array([-1, -1, -1, 0, 0, 0, 1, 1, 1]);
      const gx = SpatialFilters.convolve2D(grayIn, width, height, kGx, 3, 1.0);
      const gy = SpatialFilters.convolve2D(grayIn, width, height, kGy, 3, 1.0);
      const output = new Float32Array(width * height);
      for (let i = 0; i < output.length; i++) {
        output[i] = Math.min(255, Math.max(0, Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i])));
      }
      return output;
    }

    /**
     * Roberts Cross Gradient Operator (2x2 kernel):
     * Gx = [1 0; 0 -1], Gy = [0 1; -1 0]
     */
    static robertsEdge(grayIn, width, height) {
      const output = new Float32Array(width * height);
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
          const p00 = grayIn[y * width + x];
          const p11 = grayIn[(y + 1) * width + (x + 1)];
          const p01 = grayIn[y * width + (x + 1)];
          const p10 = grayIn[(y + 1) * width + x];
          const gx = p00 - p11;
          const gy = p01 - p10;
          output[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
        }
      }
      return output;
    }

    /**
     * Laplacian of Gaussian (LoG) Filter (5x5 kernel):
     * LoG(x,y) = -(1 / (pi * sigma^4)) * [1 - (x^2 + y^2)/(2*sigma^2)] * exp(-(x^2 + y^2)/(2*sigma^2))
     */
    static logFilter(grayIn, width, height) {
      const kernel = new Float32Array([
         0,  0, -1,  0,  0,
         0, -1, -2, -1,  0,
        -1, -2, 16, -2, -1,
         0, -1, -2, -1,  0,
         0,  0, -1,  0,  0
      ]);
      const conv = SpatialFilters.convolve2D(grayIn, width, height, kernel, 5, 1.0);
      const output = new Float32Array(width * height);
      for (let i = 0; i < output.length; i++) {
        output[i] = Math.min(255, Math.max(0, Math.abs(conv[i])));
      }
      return output;
    }
  }
