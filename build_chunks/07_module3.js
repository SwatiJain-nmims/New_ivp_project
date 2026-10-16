  // ==========================================
  // MODULE 3: FREQUENCY DOMAIN FILTERING (Unit 3)
  // Raw 2D Radix-2 FFT and IFFT with Quadrant Zero-Frequency Centering
  // ==========================================
  class FrequencyDomain {
    /**
     * 1D In-place Cooley-Tukey Radix-2 FFT
     * real and imag are Float32Array of length N (N must be power of 2)
     * invert: false for forward FFT, true for IFFT
     */
    static fft1D(real, imag, invert = false) {
      const n = real.length;
      if ((n & (n - 1)) !== 0) {
        throw new Error("FFT size must be a power of 2");
      }

      // Bit reversal permutation
      let j = 0;
      for (let i = 0; i < n - 1; i++) {
        if (i < j) {
          let tr = real[i]; real[i] = real[j]; real[j] = tr;
          let ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
        }
        let k = n >> 1;
        while (k <= j) {
          j -= k;
          k >>= 1;
        }
        j += k;
      }

      // Cooley-Tukey butterflies
      for (let len = 2; len <= n; len <<= 1) {
        const half = len >> 1;
        const angle = (invert ? 2.0 : -2.0) * Math.PI / len;
        const wStepR = Math.cos(angle);
        const wStepI = Math.sin(angle);

        for (let i = 0; i < n; i += len) {
          let wR = 1.0;
          let wI = 0.0;
          for (let k = 0; k < half; k++) {
            const pos = i + k;
            const match = pos + half;

            const uR = real[pos];
            const uI = imag[pos];
            const vR = real[match] * wR - imag[match] * wI;
            const vI = real[match] * wI + imag[match] * wR;

            real[pos] = uR + vR;
            imag[pos] = uI + vI;
            real[match] = uR - vR;
            imag[match] = uI - vI;

            const nextWR = wR * wStepR - wI * wStepI;
            const nextWI = wR * wStepI + wI * wStepR;
            wR = nextWR;
            wI = nextWI;
          }
        }
      }

      if (invert) {
        for (let i = 0; i < n; i++) {
          real[i] /= n;
          imag[i] /= n;
        }
      }
    }

    /**
     * 2D Forward FFT on N x N matrix
     * Input: real2D (Float32Array), imag2D (Float32Array)
     * Automatically applies zero-frequency centering: f(x,y) * (-1)^(x+y)
     */
    static fft2D(real2D, imag2D, N, center = true) {
      // 1. Centering multiplier (-1)^(x+y)
      if (center) {
        for (let y = 0; y < N; y++) {
          const rowOffset = y * N;
          for (let x = 0; x < N; x++) {
            if ((x + y) % 2 !== 0) {
              real2D[rowOffset + x] = -real2D[rowOffset + x];
            }
          }
        }
      }

      // 2. Row-wise 1D FFT
      const rowR = new Float32Array(N);
      const rowI = new Float32Array(N);
      for (let y = 0; y < N; y++) {
        const rowOffset = y * N;
        for (let x = 0; x < N; x++) {
          rowR[x] = real2D[rowOffset + x];
          rowI[x] = imag2D[rowOffset + x];
        }
        FrequencyDomain.fft1D(rowR, rowI, false);
        for (let x = 0; x < N; x++) {
          real2D[rowOffset + x] = rowR[x];
          imag2D[rowOffset + x] = rowI[x];
        }
      }

      // 3. Column-wise 1D FFT
      const colR = new Float32Array(N);
      const colI = new Float32Array(N);
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          colR[y] = real2D[y * N + x];
          colI[y] = imag2D[y * N + x];
        }
        FrequencyDomain.fft1D(colR, colI, false);
        for (let y = 0; y < N; y++) {
          real2D[y * N + x] = colR[y];
          imag2D[y * N + x] = colI[y];
        }
      }
    }

    /**
     * 2D Inverse FFT on N x N matrix
     */
    static ifft2D(real2D, imag2D, N, uncenter = true) {
      // 1. Row-wise 1D IFFT
      const rowR = new Float32Array(N);
      const rowI = new Float32Array(N);
      for (let y = 0; y < N; y++) {
        const rowOffset = y * N;
        for (let x = 0; x < N; x++) {
          rowR[x] = real2D[rowOffset + x];
          rowI[x] = imag2D[rowOffset + x];
        }
        FrequencyDomain.fft1D(rowR, rowI, true);
        for (let x = 0; x < N; x++) {
          real2D[rowOffset + x] = rowR[x];
          imag2D[rowOffset + x] = rowI[x];
        }
      }

      // 2. Column-wise 1D IFFT
      const colR = new Float32Array(N);
      const colI = new Float32Array(N);
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          colR[y] = real2D[y * N + x];
          colI[y] = imag2D[y * N + x];
        }
        FrequencyDomain.fft1D(colR, colI, true);
        for (let y = 0; y < N; y++) {
          real2D[y * N + x] = colR[y];
          imag2D[y * N + x] = colI[y];
        }
      }

      // 3. Remove centering multiplier (-1)^(x+y)
      if (uncenter) {
        for (let y = 0; y < N; y++) {
          const rowOffset = y * N;
          for (let x = 0; x < N; x++) {
            if ((x + y) % 2 !== 0) {
              real2D[rowOffset + x] = -real2D[rowOffset + x];
            }
          }
        }
      }
    }

    /**
     * Compute Log Magnitude Spectrum: s(u,v) = c * log(1 + |F(u,v)|)
     */
    static computeMagnitudeSpectrum(real2D, imag2D, N) {
      const spectrum = new Float32Array(N * N);
      let maxMag = 0;

      for (let i = 0; i < N * N; i++) {
        const mag = Math.sqrt(real2D[i] * real2D[i] + imag2D[i] * imag2D[i]);
        const logMag = Math.log(1.0 + mag);
        spectrum[i] = logMag;
        if (logMag > maxMag) maxMag = logMag;
      }

      // Scale to [0, 255]
      const scale = maxMag > 0 ? 255.0 / maxMag : 1.0;
      const out = new Float32Array(N * N);
      for (let i = 0; i < N * N; i++) {
        out[i] = spectrum[i] * scale;
      }
      return out;
    }

    /**
     * Construct 2D Filter Transfer Functions H(u, v) centered at (N/2, N/2)
     * Distance D(u, v) = sqrt((u - M/2)^2 + (v - N/2)^2)
     */
    static createFilterTransferFunction(type, N, D0 = 40, order = 2, notchR = 50, notchW = 10) {
      const H = new Float32Array(N * N);
      const half = N / 2.0;

      for (let v = 0; v < N; v++) {
        const dv = v - half;
        const rowOffset = v * N;
        for (let u = 0; u < N; u++) {
          const du = u - half;
          const D = Math.sqrt(du * du + dv * dv);
          let hVal = 1.0;

          switch (type) {
            case 'glpf': // Gaussian Low-Pass: exp(-D^2 / (2*D0^2))
              hVal = Math.exp(-(D * D) / (2.0 * D0 * D0));
              break;
            case 'ghpf': // Gaussian High-Pass: 1 - exp(-D^2 / (2*D0^2))
              hVal = 1.0 - Math.exp(-(D * D) / (2.0 * D0 * D0));
              break;
            case 'ilpf': // Ideal Low-Pass
              hVal = D <= D0 ? 1.0 : 0.0;
              break;
            case 'ihpf': // Ideal High-Pass
              hVal = D > D0 ? 1.0 : 0.0;
              break;
            case 'blpf': // Butterworth Low-Pass: 1 / (1 + (D/D0)^(2n))
              hVal = 1.0 / (1.0 + Math.pow(D / Math.max(1, D0), 2 * order));
              break;
            case 'bhpf': // Butterworth High-Pass: 1 / (1 + (D0/D)^(2n))
              hVal = D === 0 ? 0.0 : 1.0 / (1.0 + Math.pow(D0 / D, 2 * order));
              break;
            case 'notch_reject': // Band-reject / Notch at radius notchR with width notchW
              {
                const distFromNotch = Math.abs(D - notchR);
                // Gaussian shaped notch band
                hVal = 1.0 - Math.exp(-(distFromNotch * distFromNotch) / (2.0 * notchW * notchW));
              }
              break;
            case 'notch_pass': // Band-pass
              {
                const distFromNotch = Math.abs(D - notchR);
                hVal = Math.exp(-(distFromNotch * distFromNotch) / (2.0 * notchW * notchW));
              }
              break;
            default:
              hVal = 1.0;
          }
          H[rowOffset + u] = hVal;
        }
      }
      return H;
    }

    /**
     * Complete 2D Frequency Filtering Pipeline
     * Spatial -> FFT -> Multiply H(u,v) -> IFFT -> Spatial Output
     */
    static processFrequencyFilter(grayIn, N, filterType, D0, order, notchR, notchW, returnView = 'spatial') {
      const real = new Float32Array(N * N);
      const imag = new Float32Array(N * N);
      for (let i = 0; i < N * N; i++) {
        real[i] = grayIn[i];
      }

      // Forward FFT with centering
      FrequencyDomain.fft2D(real, imag, N, true);

      // Generate Transfer Function H(u, v)
      const H = FrequencyDomain.createFilterTransferFunction(filterType, N, D0, order, notchR, notchW);

      if (returnView === 'spectrum') {
        return FrequencyDomain.computeMagnitudeSpectrum(real, imag, N);
      }
      if (returnView === 'filter') {
        const outH = new Float32Array(N * N);
        for (let i = 0; i < N * N; i++) outH[i] = H[i] * 255.0;
        return outH;
      }

      // Frequency filtering: G(u, v) = H(u, v) * F(u, v)
      for (let i = 0; i < N * N; i++) {
        real[i] *= H[i];
        imag[i] *= H[i];
      }

      // Inverse FFT
      FrequencyDomain.ifft2D(real, imag, N, true);

      // Output real spatial domain clamped to [0, 255]
      const outSpatial = new Float32Array(N * N);
      for (let i = 0; i < N * N; i++) {
        outSpatial[i] = Math.min(255, Math.max(0, real[i]));
      }
      return outSpatial;
    }
  }
