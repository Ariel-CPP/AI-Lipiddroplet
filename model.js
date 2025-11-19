// model.js
// Simple neural-network–like model to map image features -> lipid droplet percentage.
//
// The "AI" here is a single-layer sigmoid unit (logistic regression) trained
// with gradient descent on hand-crafted image features (brightness histogram).

const LipidModel = (function () {
  "use strict";

  const FEATURE_BINS = 16; // Number of histogram bins (fixed)
  let weights = new Array(FEATURE_BINS).fill(0);
  let bias = 0;
  let initialized = false;

  function init() {
    if (!initialized) {
      // Small random initialization to break symmetry
      for (let i = 0; i < FEATURE_BINS; i++) {
        weights[i] = (Math.random() - 0.5) * 0.1;
      }
      bias = 0;
      initialized = true;
    }
  }

  function sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
  }

  /**
   * Extract simple grayscale intensity histogram from ImageData.
   * @param {ImageData} imageData
   * @returns {number[]} features of length FEATURE_BINS
   */
  function extractFeaturesFromImageData(imageData) {
    init();
    const data = imageData.data;
    const totalPixels = imageData.width * imageData.height;
    const bins = new Array(FEATURE_BINS).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Standard grayscale conversion
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      let binIndex = Math.floor((gray / 256) * FEATURE_BINS);
      if (binIndex < 0) binIndex = 0;
      if (binIndex >= FEATURE_BINS) binIndex = FEATURE_BINS - 1;
      bins[binIndex] += 1;
    }

    // Normalize to [0,1]
    for (let i = 0; i < FEATURE_BINS; i++) {
      bins[i] = bins[i] / totalPixels;
    }

    return bins;
  }

  /**
   * Predict lipid droplet fraction (0–1) from feature vector.
   * @param {number[]} features - length FEATURE_BINS
   * @returns {number} predicted fraction (0–1)
   */
  function predictFraction(features) {
    init();
    if (!features || features.length !== FEATURE_BINS) {
      console.warn("Feature vector length mismatch.");
      return 0;
    }

    let z = bias;
    for (let i = 0; i < FEATURE_BINS; i++) {
      z += weights[i] * features[i];
    }
    const y = sigmoid(z);
    return y;
  }

  /**
   * Predict lipid droplet percentage (0–100).
   * @param {number[]} features
   * @returns {number} predicted percentage
   */
  function predictPercentage(features) {
    const fraction = predictFraction(features);
    return fraction * 100;
  }

  /**
   * Train model on samples: [{ features: number[], labelPercent: number }, ...]
   * labelPercent is assumed in [0, 100].
   */
  function train(samples, epochs = 200, learningRate = 0.5) {
    init();
    if (!samples || samples.length === 0) {
      console.warn("No samples provided for training.");
      return;
    }

    // Basic stochastic gradient descent over multiple epochs.
    for (let e = 0; e < epochs; e++) {
      for (let s = 0; s < samples.length; s++) {
        const sample = samples[s];
        if (
          !sample.features ||
          sample.features.length !== FEATURE_BINS ||
          typeof sample.labelPercent !== "number"
        ) {
          continue;
        }

        const x = sample.features;
        const targetFraction = Math.min(
          1,
          Math.max(0, sample.labelPercent / 100)
        );

        let z = bias;
        for (let i = 0; i < FEATURE_BINS; i++) {
          z += weights[i] * x[i];
        }
        const y = sigmoid(z);
        const error = y - targetFraction;

        // Gradient for sigmoid with MSE loss: dL/dz = (y - t) * y * (1 - y)
        const dL_dz = error * y * (1 - y);

        for (let i = 0; i < FEATURE_BINS; i++) {
          const grad_w = dL_dz * x[i];
          weights[i] -= learningRate * grad_w;
        }
        bias -= learningRate * dL_dz;
      }
    }
  }

  /**
   * Get current model state for saving.
   */
  function getModelState() {
    init();
    return {
      type: "simple_sigmoid_histogram_v1",
      featureBins: FEATURE_BINS,
      weights: Array.from(weights),
      bias: bias,
    };
  }

  /**
   * Load model state from stored object.
   * @param {Object} state
   */
  function loadModelState(state) {
    if (
      !state ||
      state.type !== "simple_sigmoid_histogram_v1" ||
      !Array.isArray(state.weights) ||
      state.weights.length !== FEATURE_BINS
    ) {
      console.warn("Invalid model state, using fresh initialization.");
      init();
      return;
    }
    for (let i = 0; i < FEATURE_BINS; i++) {
      weights[i] = Number(state.weights[i]) || 0;
    }
    bias = Number(state.bias) || 0;
    initialized = true;
  }

  return {
    extractFeaturesFromImageData,
    predictFraction,
    predictPercentage,
    train,
    getModelState,
    loadModelState,
  };
})();
