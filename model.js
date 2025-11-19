// model.js
// Simple neural-like regression model for lipid droplet percentage prediction.
// Uses 32x32 grayscale features (1024 inputs) and linear regression with
// gradient descent in the browser.

const NeuralModel = (function () {
  const IMAGE_SIZE = 32;
  const INPUT_SIZE = IMAGE_SIZE * IMAGE_SIZE;

  let weights = new Float32Array(INPUT_SIZE);
  let bias = 0;
  let learningRate = 0.01;
  let trainedSamples = 0;
  let initialized = false;

  function initialize() {
    if (initialized) return;
    for (let i = 0; i < INPUT_SIZE; i++) {
      // small random initialization
      weights[i] = (Math.random() - 0.5) * 0.01;
    }
    bias = 0;
    initialized = true;
  }

  function getConfig() {
    return {
      inputSize: INPUT_SIZE,
      imageSize: IMAGE_SIZE,
      learningRate,
      weights: Array.from(weights),
      bias,
      trainedSamples,
    };
  }

  function loadFromObject(obj) {
    if (!obj) return;
    if (obj.inputSize !== INPUT_SIZE) {
      console.warn(
        "NeuralModel: input size mismatch (expected " +
          INPUT_SIZE +
          ", got " +
          obj.inputSize +
          "). Ignoring imported model."
      );
      return;
    }
    weights = new Float32Array(obj.weights || []);
    if (weights.length !== INPUT_SIZE) {
      console.warn("NeuralModel: weight length mismatch. Reinitializing.");
      weights = new Float32Array(INPUT_SIZE);
      initialized = false;
      initialize();
    }
    bias = typeof obj.bias === "number" ? obj.bias : 0;
    learningRate =
      typeof obj.learningRate === "number" ? obj.learningRate : learningRate;
    trainedSamples =
      typeof obj.trainedSamples === "number" ? obj.trainedSamples : 0;
    initialized = true;
  }

  function predictFromFeatures(features) {
    initialize();
    if (!features || features.length !== INPUT_SIZE) {
      throw new Error(
        "NeuralModel: features size mismatch (expected " +
          INPUT_SIZE +
          ", got " +
          (features ? features.length : "null") +
          ")"
      );
    }
    let sum = bias;
    for (let i = 0; i < INPUT_SIZE; i++) {
      sum += weights[i] * features[i];
    }
    // Clamp to [0, 100] as % output
    const y = Math.max(0, Math.min(100, sum));
    return y;
  }

  function trainOnSample(features, targetPercent) {
    initialize();
    const y = predictFromFeatures(features);
    const error = y - targetPercent; // derivative of (y - t)^2
    const factor = 2 * learningRate * error;

    for (let i = 0; i < INPUT_SIZE; i++) {
      weights[i] -= factor * features[i];
    }
    bias -= factor;
    trainedSamples += 1;

    return { prediction: y, error };
  }

  function getTrainedSamples() {
    return trainedSamples;
  }

  function getImageSize() {
    return IMAGE_SIZE;
  }

  function describe() {
    return {
      imageSize: IMAGE_SIZE,
      inputSize: INPUT_SIZE,
      trainedSamples,
      learningRate,
    };
  }

  // Convert an image File into a Float32Array of grayscale features
  async function imageFileToFeatures(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = IMAGE_SIZE;
            canvas.height = IMAGE_SIZE;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
            const imageData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
            const data = imageData.data;
            const features = new Float32Array(INPUT_SIZE);

            for (let i = 0, j = 0; i < data.length; i += 4, j++) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const gray = (r + g + b) / (3 * 255); // normalized 0–1
              features[j] = gray;
            }
            resolve(features);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = (e) => reject(e);
        img.src = reader.result;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  return {
    getConfig,
    loadFromObject,
    predictFromFeatures,
    trainOnSample,
    getTrainedSamples,
    getImageSize,
    describe,
    imageFileToFeatures,
  };
})();
