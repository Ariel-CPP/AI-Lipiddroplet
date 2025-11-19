// js/storage.js
// Namespace global untuk penyimpanan dataset training

window.LipidStorage = (function () {
  const DATASET_KEY = "lipid_dataset_v1";

  function loadDataset() {
    const raw = localStorage.getItem(DATASET_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.error("Gagal parse dataset dari localStorage:", e);
      return [];
    }
  }

  function saveDataset(dataset) {
    localStorage.setItem(DATASET_KEY, JSON.stringify(dataset));
  }

  function addSamples(samples) {
    // samples: array of { id, name, label, dataUrl }
    const dataset = loadDataset();
    const merged = dataset.concat(samples);
    saveDataset(merged);
    return merged.length;
  }

  function clearDataset() {
    localStorage.removeItem(DATASET_KEY);
  }

  function getStats() {
    const ds = loadDataset();
    return {
      count: ds.length,
    };
  }

  return {
    loadDataset,
    saveDataset,
    addSamples,
    clearDataset,
    getStats,
  };
})();
