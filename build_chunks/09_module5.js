  // ==========================================
  // MODULE 5: IMAGE SEGMENTATION & THRESHOLDING (Unit 6)
  // Otsu's Binarization, Adaptive Windowing, Seed Region Growing, Quadtree Split-Merge, Watershed
  // ==========================================
  class SegmentationEngine {
    /**
     * Otsu's Optimum Global Thresholding:
     * Minimizes within-class variance \sigma_w^2(k)
     * Maximizes between-class variance: \sigma_b^2(k) = \frac{[\mu_T \omega(k) - \mu(k)]^2}{\omega(k)[1 - \omega(k)]}
     */
    static otsuThreshold(grayIn) {
      const hist = DIPEngine.computeHistogram(grayIn);
      const total = grayIn.length;

      let sumTotal = 0;
      for (let i = 0; i < 256; i++) {
        sumTotal += i * hist[i];
      }

      let sumBackground = 0;
      let weightBackground = 0;
      let maxVariance = 0;
      let bestThreshold = 128;

      for (let k = 0; k < 256; k++) {
        weightBackground += hist[k];
        if (weightBackground === 0) continue;

        const weightForeground = total - weightBackground;
        if (weightForeground === 0) break;

        sumBackground += k * hist[k];
        const meanBackground = sumBackground / weightBackground;
        const meanForeground = (sumTotal - sumBackground) / weightForeground;

        // Between class variance \sigma_b^2 = \omega_0 * \omega_1 * (\mu_0 - \mu_1)^2
        const meanDiff = meanBackground - meanForeground;
        const betweenClassVariance = weightBackground * weightForeground * meanDiff * meanDiff;

        if (betweenClassVariance > maxVariance) {
          maxVariance = betweenClassVariance;
          bestThreshold = k;
        }
      }

      // Apply threshold
      const output = new Float32Array(total);
      for (let i = 0; i < total; i++) {
        output[i] = grayIn[i] >= bestThreshold ? 255 : 0;
      }

      return { output, bestThreshold };
    }

    /**
     * Adaptive Local Thresholding:
     * T(x, y) = mean_{W \times W}(x, y) - C
     */
    static adaptiveThreshold(grayIn, width, height, windowSize = 15, C = 5) {
      const half = Math.floor(windowSize / 2);
      const output = new Float32Array(width * height);

      // Fast 2D Integral Image for constant time O(1) box sum
      const integral = new Float64Array((width + 1) * (height + 1));
      for (let y = 0; y < height; y++) {
        let rowSum = 0;
        for (let x = 0; x < width; x++) {
          rowSum += grayIn[y * width + x];
          integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + rowSum;
        }
      }

      for (let y = 0; y < height; y++) {
        const y0 = Math.max(0, y - half);
        const y1 = Math.min(height, y + half + 1);
        for (let x = 0; x < width; x++) {
          const x0 = Math.max(0, x - half);
          const x1 = Math.min(width, x + half + 1);
          const count = (x1 - x0) * (y1 - y0);

          const sum = integral[y1 * (width + 1) + x1] -
                      integral[y0 * (width + 1) + x1] -
                      integral[y1 * (width + 1) + x0] +
                      integral[y0 * (width + 1) + x0];

          const localMean = sum / count;
          const thresh = localMean - C;
          output[y * width + x] = grayIn[y * width + x] > thresh ? 255 : 0;
        }
      }
      return output;
    }

    /**
     * Seeded Region Growing:
     * Aggregates neighboring pixels if |I(x,y) - I(seed)| <= T
     */
    static regionGrowing(grayIn, width, height, seedX = 128, seedY = 128, tolerance = 25) {
      const sx = Math.min(width - 1, Math.max(0, Math.round(seedX)));
      const sy = Math.min(height - 1, Math.max(0, Math.round(seedY)));
      const seedVal = grayIn[sy * width + sx];

      const visited = new Uint8Array(width * height);
      const output = new Float32Array(width * height);
      const queue = [sy * width + sx];
      visited[sy * width + sx] = 1;
      output[sy * width + sx] = 255;

      let head = 0;
      while (head < queue.length) {
        const idx = queue[head++];
        const cx = idx % width;
        const cy = Math.floor(idx / width);

        const neighbors = [
          { nx: cx + 1, ny: cy },
          { nx: cx - 1, ny: cy },
          { nx: cx, ny: cy + 1 },
          { nx: cx, ny: cy - 1 }
        ];

        for (let n of neighbors) {
          if (n.nx >= 0 && n.nx < width && n.ny >= 0 && n.ny < height) {
            const nIdx = n.ny * width + n.nx;
            if (!visited[nIdx]) {
              visited[nIdx] = 1;
              const diff = Math.abs(grayIn[nIdx] - seedVal);
              if (diff <= tolerance) {
                output[nIdx] = 255;
                queue.push(nIdx);
              }
            }
          }
        }
      }
      return output;
    }

    /**
     * Quadtree Region Splitting and Merging:
     * Recursively subdivides blocks until stdDev <= maxStdDev or size <= minBlockSize
     */
    static regionSplitMerge(grayIn, width, height, maxStdDev = 12, minBlockSize = 8) {
      const output = new Float32Array(width * height);

      function processBlock(x, y, size) {
        // Calculate mean & variance
        let sum = 0;
        let sumSq = 0;
        const count = size * size;

        for (let dy = 0; dy < size; dy++) {
          const rowOffset = (y + dy) * width;
          for (let dx = 0; dx < size; dx++) {
            const val = grayIn[rowOffset + (x + dx)];
            sum += val;
            sumSq += val * val;
          }
        }

        const mean = sum / count;
        const variance = Math.max(0, (sumSq / count) - (mean * mean));
        const stdDev = Math.sqrt(variance);

        // Homogeneity criterion
        if (stdDev <= maxStdDev || size <= minBlockSize) {
          // Homogeneous block: fill with mean intensity and draw outline
          for (let dy = 0; dy < size; dy++) {
            const rowOffset = (y + dy) * width;
            for (let dx = 0; dx < size; dx++) {
              // Quadtree outline grid effect
              if (dx === 0 || dy === 0) {
                output[rowOffset + (x + dx)] = 255; // highlight quad boundaries
              } else {
                output[rowOffset + (x + dx)] = mean;
              }
            }
          }
        } else {
          // Split into 4 quadrants
          const half = size >> 1;
          processBlock(x, y, half);
          processBlock(x + half, y, half);
          processBlock(x, y + half, half);
          processBlock(x + half, y + half, half);
        }
      }

      processBlock(0, 0, width);
      return output;
    }

    /**
     * Marker-Driven Watershed Segmentation:
     * Uses topological gradient landscape and flood basins to identify catchment boundaries
     */
    static watershedSegmentation(grayIn, width, height) {
      // 1. Calculate Morphological Gradient: G = (f \oplus b) - (f \ominus b)
      const se = MorphologyEngine.createStructuringElement('cross', 1);
      const dilated = MorphologyEngine.dilation(grayIn, width, height, se);
      const eroded = MorphologyEngine.erosion(grayIn, width, height, se);
      const gradient = new Float32Array(width * height);
      for (let i = 0; i < gradient.length; i++) {
        gradient[i] = dilated[i] - eroded[i];
      }

      // 2. Local Minima Detection as Markers
      const labels = new Int32Array(width * height).fill(0);
      let nextLabel = 1;

      // Find local minima in gradient
      for (let y = 2; y < height - 2; y += 4) {
        for (let x = 2; x < width - 2; x += 4) {
          const idx = y * width + x;
          if (gradient[idx] < 15 && labels[idx] === 0) {
            labels[idx] = nextLabel++;
          }
        }
      }

      // Priority queue flood simulation (sorted gradient buckets 0-255)
      const buckets = Array.from({ length: 256 }, () => []);
      for (let i = 0; i < gradient.length; i++) {
        const gVal = Math.min(255, Math.max(0, Math.round(gradient[i])));
        buckets[gVal].push(i);
      }

      const output = new Float32Array(width * height);
      // Flood catchment basins and draw watershed ridges
      for (let g = 0; g < 256; g++) {
        const bucket = buckets[g];
        for (let i = 0; i < bucket.length; i++) {
          const idx = bucket[i];
          const x = idx % width;
          const y = Math.floor(idx / width);

          // Check neighbors' labels
          let neighborLabel = 0;
          let isRidge = false;

          const neighbors = [
            y > 0 ? (y - 1) * width + x : -1,
            y < height - 1 ? (y + 1) * width + x : -1,
            x > 0 ? y * width + (x - 1) : -1,
            x < width - 1 ? y * width + (x + 1) : -1
          ];

          for (let n of neighbors) {
            if (n !== -1 && labels[n] > 0) {
              if (neighborLabel === 0) {
                neighborLabel = labels[n];
              } else if (neighborLabel !== labels[n]) {
                isRidge = true;
              }
            }
          }

          if (isRidge) {
            labels[idx] = -1; // Watershed dam/ridge line
            output[idx] = 255;
          } else if (neighborLabel > 0) {
            labels[idx] = neighborLabel;
            output[idx] = (neighborLabel * 47) % 200 + 40; // False color basin
          }
        }
      }

      return output;
    }
  }
