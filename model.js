// model.js
// Simple in-browser "neural" model: we store a list of training samples
// (single numerical feature = mean brightness) plus the known percentage.
// Prediction uses k-nearest-neighbours on that feature.

const LipidModel = {
  version: 1,
  samples: [], // { feature: number, label: number }
};

/**
 * Compute a simple feature from an image file: mean grayscale intensity (0–1).
 */
function computeFeatureFromImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const targetSize = 64;
      canvas.width = targetSize;
      canvas.height = targetSize;

      // draw scaled image
      ctx.drawImage(img, 0, 0, targetSize, targetSize);
      const data = ctx.getImageData(0, 0, targetSize, targetSize).data;

      let sum = 0;
      const totalPixels = targetSize * targetSize;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // simple luminance
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        sum += lum;
      }

      const mean = sum / totalPixels / 255; // 0–1
      resolve(mean);
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Train model on one (feature, label) pair.
 */
function addTrainingSample(feature, label) {
  LipidModel.samples.push({
    feature,
    label: Number(label),
  });
}

/**
 * Predict label for a single feature using k-NN.
 */
function predictFromFeature(feature, k = 5) {
  if (!LipidModel.samples.length) {
    return null;
  }

  const distances = LipidModel.samples.map((s) => ({
    d: Math.abs(s.feature - feature),
    label: s.label,
  }));

  distances.sort((a, b) => a.d - b.d);
  const kUsed = Math.min(k, distances.length);
  let sum = 0;
  for (let i = 0; i < kUsed; i++) {
    sum += distances[i].label;
  }
  return sum / kUsed;
}

/**
 * Export model as a plain JS object (for JSON serialisation).
 */
function exportModelObject() {
  return {
    version: LipidModel.version,
    samples: LipidModel.samples,
  };
}

/**
 * Load model from JS object (inverse of exportModelObject).
 */
function importModelObject(obj) {
  if (!obj || !Array.isArray(obj.samples)) return;
  LipidModel.version = obj.version || 1;
  LipidModel.samples = obj.samples.map((s) => ({
    feature: Number(s.feature),
    label: Number(s.label),
  }));
}
