  // ==========================================
  // MODULE 4: MATHEMATICAL MORPHOLOGY (Unit 4)
  // Binary & Grayscale Morphology with Custom Structuring Elements
  // ==========================================
  class MorphologyEngine {
    /**
     * Create Structuring Element B (offsets array from origin)
     * shape: 'disk', 'square', 'cross'
     * radius: r
     */
    static createStructuringElement(shape = 'disk', radius = 2) {
      const offsets = [];
      const r = Math.max(1, radius);

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          let include = false;
          if (shape === 'square') {
            include = true;
          } else if (shape === 'cross') {
            include = (dx === 0 || dy === 0);
          } else { // disk / circle
            include = (dx * dx + dy * dy <= r * r);
          }
          if (include) {
            offsets.push({ dx, dy });
          }
        }
      }
      return offsets;
    }

    /**
     * Grayscale / Binary Dilation:
     * (f \oplus b)(x,y) = max_{(s,t) \in B} { f(x-s, y-t) }
     */
    static dilation(grayIn, width, height, seOffsets) {
      const output = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let maxVal = 0;
          for (let k = 0; k < seOffsets.length; k++) {
            const px = Math.min(width - 1, Math.max(0, x - seOffsets[k].dx));
            const py = Math.min(height - 1, Math.max(0, y - seOffsets[k].dy));
            const v = grayIn[py * width + px];
            if (v > maxVal) maxVal = v;
          }
          output[y * width + x] = maxVal;
        }
      }
      return output;
    }

    /**
     * Grayscale / Binary Erosion:
     * (f \ominus b)(x,y) = min_{(s,t) \in B} { f(x+s, y+t) }
     */
    static erosion(grayIn, width, height, seOffsets) {
      const output = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let minVal = 255;
          for (let k = 0; k < seOffsets.length; k++) {
            const px = Math.min(width - 1, Math.max(0, x + seOffsets[k].dx));
            const py = Math.min(height - 1, Math.max(0, y + seOffsets[k].dy));
            const v = grayIn[py * width + px];
            if (v < minVal) minVal = v;
          }
          output[y * width + x] = minVal;
        }
      }
      return output;
    }

    /**
     * Morphological Opening: (f \circ b) = (f \ominus b) \oplus b
     */
    static opening(grayIn, width, height, seOffsets) {
      const eroded = MorphologyEngine.erosion(grayIn, width, height, seOffsets);
      return MorphologyEngine.dilation(eroded, width, height, seOffsets);
    }

    /**
     * Morphological Closing: (f \bullet b) = (f \oplus b) \ominus b
     */
    static closing(grayIn, width, height, seOffsets) {
      const dilated = MorphologyEngine.dilation(grayIn, width, height, seOffsets);
      return MorphologyEngine.erosion(dilated, width, height, seOffsets);
    }

    /**
     * Morphological Boundary Extraction:
     * \beta(A) = A - (A \ominus B)
     */
    static boundaryExtraction(grayIn, width, height, seOffsets) {
      const eroded = MorphologyEngine.erosion(grayIn, width, height, seOffsets);
      const output = new Float32Array(width * height);
      for (let i = 0; i < output.length; i++) {
        output[i] = Math.max(0, grayIn[i] - eroded[i]);
      }
      return output;
    }

    /**
     * Hit-or-Miss Transformation:
     * A \circledast B = (A \ominus B1) \cap (A^c \ominus B2)
     */
    static hitOrMiss(binIn, width, height) {
      // Standard corner/isolated structural element:
      // B1 (foreground hit), B2 (background miss)
      const b1 = [{ dx: 0, dy: 0 }];
      const b2 = [
        { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
        { dx: -1, dy:  0 },                    { dx: 1, dy:  0 }
      ];

      // Complement A^c
      const comp = new Float32Array(width * height);
      for (let i = 0; i < comp.length; i++) comp[i] = binIn[i] > 128 ? 0 : 255;

      const hit = MorphologyEngine.erosion(binIn, width, height, b1);
      const miss = MorphologyEngine.erosion(comp, width, height, b2);

      const output = new Float32Array(width * height);
      for (let i = 0; i < output.length; i++) {
        output[i] = (hit[i] > 128 && miss[i] > 128) ? 255 : 0;
      }
      return output;
    }

    /**
     * Morphological Thinning & Skeletonization:
     * Zhang-Suen Iterative Thinning Algorithm (academic standard for topology-preserving skeletonization)
     */
    static thinning(binIn, width, height, maxIters = 25) {
      // Create binary grid 0 and 1
      const grid = new Uint8Array(width * height);
      for (let i = 0; i < grid.length; i++) {
        grid[i] = binIn[i] > 128 ? 1 : 0;
      }

      let hasChanged = true;
      let iter = 0;

      while (hasChanged && iter < maxIters) {
        hasChanged = false;
        iter++;

        // Step 1
        const toDeleteStep1 = [];
        for (let y = 1; y < height - 1; y++) {
          const row = y * width;
          for (let x = 1; x < width - 1; x++) {
            if (grid[row + x] === 0) continue;

            const p2 = grid[(y - 1) * width + x];
            const p3 = grid[(y - 1) * width + (x + 1)];
            const p4 = grid[y * width + (x + 1)];
            const p5 = grid[(y + 1) * width + (x + 1)];
            const p6 = grid[(y + 1) * width + x];
            const p7 = grid[(y + 1) * width + (x - 1)];
            const p8 = grid[y * width + (x - 1)];
            const p9 = grid[(y - 1) * width + (x - 1)];

            const bNeighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
            if (bNeighbors < 2 || bNeighbors > 6) continue;

            // Count 0 -> 1 transitions in sequence p2, p3, ..., p9, p2
            const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
            let aTransitions = 0;
            for (let k = 0; k < 8; k++) {
              if (seq[k] === 0 && seq[k + 1] === 1) aTransitions++;
            }
            if (aTransitions !== 1) continue;

            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;

            toDeleteStep1.push(row + x);
          }
        }

        if (toDeleteStep1.length > 0) {
          hasChanged = true;
          for (let idx of toDeleteStep1) grid[idx] = 0;
        }

        // Step 2
        const toDeleteStep2 = [];
        for (let y = 1; y < height - 1; y++) {
          const row = y * width;
          for (let x = 1; x < width - 1; x++) {
            if (grid[row + x] === 0) continue;

            const p2 = grid[(y - 1) * width + x];
            const p3 = grid[(y - 1) * width + (x + 1)];
            const p4 = grid[y * width + (x + 1)];
            const p5 = grid[(y + 1) * width + (x + 1)];
            const p6 = grid[(y + 1) * width + x];
            const p7 = grid[(y + 1) * width + (x - 1)];
            const p8 = grid[y * width + (x - 1)];
            const p9 = grid[(y - 1) * width + (x - 1)];

            const bNeighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
            if (bNeighbors < 2 || bNeighbors > 6) continue;

            const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
            let aTransitions = 0;
            for (let k = 0; k < 8; k++) {
              if (seq[k] === 0 && seq[k + 1] === 1) aTransitions++;
            }
            if (aTransitions !== 1) continue;

            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;

            toDeleteStep2.push(row + x);
          }
        }

        if (toDeleteStep2.length > 0) {
          hasChanged = true;
          for (let idx of toDeleteStep2) grid[idx] = 0;
        }
      }

      const output = new Float32Array(width * height);
      for (let i = 0; i < grid.length; i++) {
        output[i] = grid[i] === 1 ? 255 : 0;
      }
      return output;
    }

    /**
     * Morphological Thickening:
     * A \odot B = A \cup (A \circledast B)
     */
    static thickening(binIn, width, height) {
      const hitMiss = MorphologyEngine.hitOrMiss(binIn, width, height);
      const output = new Float32Array(width * height);
      for (let i = 0; i < output.length; i++) {
        output[i] = (binIn[i] > 128 || hitMiss[i] > 128) ? 255 : 0;
      }
      return output;
    }

    /**
     * Morphological Hole Filling:
     * X_k = (X_{k-1} \oplus B) \cap A^c
     * Flood-fills background from outer border and inverts to isolate filled holes
     */
    static holeFilling(binIn, width, height) {
      const filled = new Uint8Array(width * height);
      // Copy binary: 1 for foreground, 0 for background
      for (let i = 0; i < binIn.length; i++) {
        filled[i] = binIn[i] > 128 ? 1 : 0;
      }

      // Breadth-First Flood fill from image boundary pixels that are 0
      const queue = [];
      const visited = new Uint8Array(width * height);

      // Seed borders
      for (let x = 0; x < width; x++) {
        const top = x;
        const bottom = (height - 1) * width + x;
        if (filled[top] === 0 && !visited[top]) { visited[top] = 1; queue.push(top); }
        if (filled[bottom] === 0 && !visited[bottom]) { visited[bottom] = 1; queue.push(bottom); }
      }
      for (let y = 0; y < height; y++) {
        const left = y * width;
        const right = y * width + (width - 1);
        if (filled[left] === 0 && !visited[left]) { visited[left] = 1; queue.push(left); }
        if (filled[right] === 0 && !visited[right]) { visited[right] = 1; queue.push(right); }
      }

      // 4-neighborhood BFS
      let head = 0;
      while (head < queue.length) {
        const idx = queue[head++];
        const x = idx % width;
        const y = Math.floor(idx / width);

        const neighbors = [
          { nx: x + 1, ny: y },
          { nx: x - 1, ny: y },
          { nx: x, ny: y + 1 },
          { nx: x, ny: y - 1 }
        ];

        for (let n of neighbors) {
          if (n.nx >= 0 && n.nx < width && n.ny >= 0 && n.ny < height) {
            const nIdx = n.ny * width + n.nx;
            if (filled[nIdx] === 0 && visited[nIdx] === 0) {
              visited[nIdx] = 1;
              queue.push(nIdx);
            }
          }
        }
      }

      // Any pixel that is 0 and NOT visited by boundary flood is an interior hole!
      const output = new Float32Array(width * height);
      for (let i = 0; i < filled.length; i++) {
        // If it was already foreground OR it is an unreached background hole, set to 255
        output[i] = (filled[i] === 1 || visited[i] === 0) ? 255 : 0;
      }
      return output;
    }
  }
