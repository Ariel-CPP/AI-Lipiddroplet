// storage.js

const STORAGE_KEY = "cpprima_lipid_model_v1";

/**
 * Save current model to localStorage.
 */
function saveModelToLocalStorage() {
  try {
    const obj = exportModelObject();
    const json = JSON.stringify(obj);
    window.localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    console.error("Failed to save model:", e);
  }
}

/**
 * Load model from localStorage (if exists).
 */
function loadModelFromLocalStorage() {
  try {
    const json = window.localStorage.getItem(STORAGE_KEY);
    if (!json) return false;
    const obj = JSON.parse(json);
    importModelObject(obj);
    return true;
  } catch (e) {
    console.error("Failed to load model:", e);
    return false;
  }
}

/**
 * Trigger download of current model as JSON file.
 */
function downloadModelAsJson() {
  const obj = exportModelObject();
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "lipid_model_database.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Import model from a JSON File object.
 */
function importModelFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        importModelObject(obj);
        saveModelToLocalStorage();
        resolve(true);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
