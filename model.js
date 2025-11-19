// model.js
// Model AI sederhana untuk estimasi persentase lipid droplet
// - Ekstraksi fitur dari gambar menggunakan canvas offscreen
// - KNN (k-nearest neighbors) untuk prediksi

const LipidModel = (() => {
  let samples = []; // { features: [f1, f2, ...], label: number }

  function setSamples(newSamples) {
    samples = Array.isArray(newSamples) ? newSamples : [];
  }

  function getSamples() {
    return samples;
  }

  function addSamples(newSamples) {
    if (!Array.isArray(newSamples)) return;
    samples = samples.concat(newSamples);
  }

  function hasSamples() {
    return samples.length > 0;
  }

  // --- Ekstraksi fitur citra sederhana ---
  // Fitur: [meanBrightness, brightFraction]
  function extractFeaturesFromImageElement(img, maxSize = 64) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Resize menjaga rasio
    const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let sumBrightness = 0;
    let brightCount = 0;
    const totalPixels = w * h;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3; // 0–255
      sumBrightness += brightness;
      if (brightness > 170) {
        brightCount++;
      }
    }

    const meanBrightness = totalPixels > 0 ? sumBrightness / totalPixels : 0;
    const brightFraction = totalPixels > 0 ? brightCount / totalPixels : 0;

    return [meanBrightness, brightFraction];
  }

  // Convert File -> Image -> fitur
  function extractFeaturesFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const features = extractFeaturesFromImageElement(img);
            resolve(features);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = (err) => reject(err);
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  // Euclidean distance antara dua vektor fitur
  function distance(a, b) {
    const len = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const d = (a[i] || 0) - (b[i] || 0);
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  // Prediksi satu vektor fitur
  function predictSingle(features, k = 5) {
    if (!hasSamples()) {
      return null;
    }
    const dists = samples.map((s) => ({
      label: s.label,
      dist: distance(s.features, features),
    }));

    dists.sort((a, b) => a.dist - b.dist);
    const kEff = Math.min(k, dists.length);
    let numZero = dists.findIndex((d) => d.dist === 0);

    // Jika ada sampel identik, langsung gunakan labelnya
    if (numZero !== -1) {
      return dists[numZero].label;
    }

    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < kEff; i++) {
      const d = dists[i].dist;
      const w = 1 / (d + 1e-6); // bobot kebalikan jarak
      weightedSum += dists[i].label * w;
      weightTotal += w;
    }

    if (weightTotal === 0) return dists[0].label;
    return weightedSum / weightTotal;
  }

  // Prediksi batch
  function predictBatch(featuresArray, k = 5) {
    return featuresArray.map((f) => predictSingle(f, k));
  }

  return {
    setSamples,
    getSamples,
    addSamples,
    hasSamples,
    extractFeaturesFromFile,
    predictSingle,
    predictBatch,
  };
})();
