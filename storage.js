// storage.js
// Handles persistence of the model "database" in localStorage and
// supports export/import as a static JSON file.

const Storage = (function () {
  const KEY = "lipid-droplet-ai-db-v1";

  function createEmpty() {
    const now = new Date().toISOString();
    return {
      version: 1,
      createdAt: now,
      updatedAt: now,
      model: null,
      stats: {
        totalSamples: 0,
      },
    };
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) {
        const empty = createEmpty();
        save(empty);
        return empty;
      }
      const parsed = JSON.parse(raw);
      // ensure basic shape
      if (!parsed.stats) {
        parsed.stats = { totalSamples: 0 };
      }
      if (!parsed.version) {
        parsed.version = 1;
      }
      return parsed;
    } catch (err) {
      console.warn("Storage: error loading database, resetting.", err);
      const empty = createEmpty();
      save(empty);
      return empty;
    }
  }

  function save(db) {
    db.updatedAt = new Date().toISOString();
    window.localStorage.setItem(KEY, JSON.stringify(db));
  }

  function exportToBlob(db) {
    const json = JSON.stringify(db, null, 2);
    return new Blob([json], { type: "application/json" });
  }

  async function importFromFile(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);

    // very light validation
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid database file.");
    }
    if (!parsed.version) {
      parsed.version = 1;
    }
    if (!parsed.stats) {
      parsed.stats = { totalSamples: 0 };
    }
    save(parsed);
    return parsed;
  }

  return {
    load,
    save,
    createEmpty,
    exportToBlob,
    importFromFile,
  };
})();
