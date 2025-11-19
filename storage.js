// storage.js
// Handling the local "database" of training samples and model state.
//
// Structure:
// {
//   version: 1,
//   createdAt: "...",
//   samples: [{ features: [...], labelPercent: number, filename: string }, ...],
//   modelState: { ... from LipidModel.getModelState() ... }
// }

const LipidStorage = (function () {
  "use strict";

  const DB_KEY = "lipid_ai_database_v1";
  let db = {
    version: 1,
    createdAt: new Date().toISOString(),
    samples: [],
    modelState: null,
  };
  let loaded = false;

  function load() {
    if (loaded) return;
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.samples)) {
          db = parsed;
        }
      } catch (e) {
        console.warn("Failed to parse stored database, resetting.", e);
      }
    }
    loaded = true;
  }

  function persist() {
    try {
      window.localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn("Failed to save database to localStorage.", e);
    }
  }

  function getSamples() {
    load();
    return db.samples;
  }

  function addSample(sample) {
    load();
    db.samples.push(sample);
    persist();
  }

  function clearSamples() {
    load();
    db.samples = [];
    persist();
  }

  function getModelState() {
    load();
    return db.modelState;
  }

  function setModelState(state) {
    load();
    db.modelState = state;
    persist();
  }

  function getSampleCount() {
    load();
    return db.samples.length;
  }

  function exportToJsonString() {
    load();
    return JSON.stringify(db, null, 2);
  }

  function importFromJsonString(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || !Array.isArray(parsed.samples)) {
        throw new Error("Invalid database format.");
      }
      db = parsed;
      loaded = true;
      persist();
      return true;
    } catch (e) {
      console.error("Failed to import database:", e);
      return false;
    }
  }

  return {
    load,
    getSamples,
    addSample,
    clearSamples,
    getModelState,
    setModelState,
    getSampleCount,
    exportToJsonString,
    importFromJsonString,
  };
})();
