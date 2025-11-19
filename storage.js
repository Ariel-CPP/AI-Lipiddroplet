// storage.js
// Menangani penyimpanan dataset training di localStorage

const LipidStorage = (() => {
  const STORAGE_KEY = "lipidDropletDataset_v1";

  function loadSamples() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.samples)) {
        return parsed.samples;
      }
      return [];
    } catch (err) {
      console.error("Gagal membaca localStorage:", err);
      return [];
    }
  }

  function saveSamples(samples) {
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      samples: samples || [],
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("Gagal menyimpan ke localStorage:", err);
    }
  }

  function appendSamples(newSamples) {
    const existing = loadSamples();
    const merged = existing.concat(newSamples || []);
    saveSamples(merged);
    return merged;
  }

  function getSampleCount() {
    return loadSamples().length;
  }

  return {
    loadSamples,
    saveSamples,
    appendSamples,
    getSampleCount,
  };
})();
