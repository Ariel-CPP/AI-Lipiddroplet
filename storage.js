// storage.js
// Handles persistence of the LipidModel and JSON import/export.

const LIPID_MODEL_STORAGE_KEY = "cp_lipid_model_db_v1";

const StorageAPI = {
  /**
   * Load model from localStorage, or create a fresh one.
   */
  loadModel() {
    try {
      const raw = localStorage.getItem(LIPID_MODEL_STORAGE_KEY);
      if (!raw) {
        return new LipidModel();
      }
      const json = JSON.parse(raw);
      return LipidModel.fromJSON(json);
    } catch (err) {
      console.error("Failed to load model from storage:", err);
      return new LipidModel();
    }
  },

  /**
   * Save model to localStorage.
   */
  saveModel(model) {
    try {
      const json = JSON.stringify(model.toJSON());
      localStorage.setItem(LIPID_MODEL_STORAGE_KEY, json);
    } catch (err) {
      console.error("Failed to save model to storage:", err);
    }
  },

  /**
   * Trigger a download of the current model database as JSON.
   */
  downloadDatabase(model) {
    const json = JSON.stringify(model.toJSON(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "lipid_model_database.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Read a JSON file and return a Promise<LipidModel>.
   */
  importDatabaseFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result);
          const model = LipidModel.fromJSON(json);
          resolve(model);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, "utf-8");
    });
  }
};
