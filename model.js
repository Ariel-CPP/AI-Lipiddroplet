// model.js
// Lightweight image-based regression model for lipid droplet percentage.
// All math is done directly in JS; no external libraries are used.

class LipidModel {
  constructor() {
    // two simple features: mean intensity and standard deviation of intensity
    this.inputSize = 2;

    // weights and bias initialisation
    this.weights = new Array(this.inputSize).fill(0);
    this.bias = 0;

    // training statistics
    this.trainedSamples = 0;
    this.lastUpdated = null;
    this.learningRate = 0.02;
    this.version = "1.0.0";
  }

  /**
   * Extracts simple features from ImageData.
   * Features:
   *  0 - mean grayscale intensity (0–1)
   *  1 - standard deviation of intensity
   */
  extractFeaturesFromImageData(imageData) {
    const data = imageData.data;
    const n = data.length / 4;

    if (n === 0) return [0, 0];

    let sum = 0;
    let sumSq = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // simple grayscale conversion
      const gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
      sum += gray;
      sumSq += gray * gray;
    }

    const mean = sum / n;
    const variance = Math.max(sumSq / n - mean * mean, 0);
    const std = Math.sqrt(variance);

    return [mean, std];
  }

  /**
   * Predicts lipid droplet percentage from feature vector.
   */
  predictFromFeatures(features) {
    let z = this.bias;
    for (let i = 0; i < this.inputSize; i++) {
      z += this.weights[i] * (features[i] ?? 0);
    }

    // clamp output to 0–100
    const y = Math.max(0, Math.min(100, z));
    return y;
  }

  /**
   * Online gradient-descent training for one sample.
   * target: known lipid droplet percentage (0–100).
   */
  trainOnFeatures(features, target) {
    const yPred = this.predictFromRaw(features);
    const error = yPred - target;

    // gradient of MSE w.r.t weights and bias
    for (let i = 0; i < this.inputSize; i++) {
      this.weights[i] -= this.learningRate * error * (features[i] ?? 0);
    }
    this.bias -= this.learningRate * error;

    this.trainedSamples += 1;
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Internal prediction without clamping (for GD).
   */
  predictFromRaw(features) {
    let z = this.bias;
    for (let i = 0; i < this.inputSize; i++) {
      z += this.weights[i] * (features[i] ?? 0);
    }
    return z;
  }

  /**
   * Serialise the model as a plain JSON object.
   */
  toJSON() {
    return {
      inputSize: this.inputSize,
      weights: this.weights,
      bias: this.bias,
      trainedSamples: this.trainedSamples,
      lastUpdated: this.lastUpdated,
      learningRate: this.learningRate,
      version: this.version
    };
  }

  /**
   * Replace model parameters from a JSON object.
   */
  static fromJSON(json) {
    const model = new LipidModel();
    if (!json) return model;

    model.inputSize = json.inputSize ?? model.inputSize;
    model.weights = Array.isArray(json.weights)
      ? json.weights.slice()
      : model.weights;
    model.bias = typeof json.bias === "number" ? json.bias : model.bias;
    model.trainedSamples =
      typeof json.trainedSamples === "number" ? json.trainedSamples : 0;
    model.lastUpdated = json.lastUpdated ?? null;
    model.learningRate =
      typeof json.learningRate === "number"
        ? json.learningRate
        : model.learningRate;
    model.version = json.version ?? model.version;

    return model;
  }
}
