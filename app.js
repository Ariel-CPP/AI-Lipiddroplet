// app.js
// Connects UI, model.js, and storage.js into a working web application.

(function () {
  "use strict";

  // DOM elements
  let tabButtons;
  let trainingPanel;
  let analysisPanel;

  let trainImagesInput;
  let trainPreviewGrid;
  let addToDbBtn;
  let trainModelBtn;
  let trainCountSpan;
  let trainMessageDiv;

  let analysisImagesInput;
  let runAnalysisBtn;
  let analysisMessageDiv;
  let analysisResultsGrid;

  let downloadDbBtn;
  let uploadDbBtn;
  let uploadDbInput;

  // Internal state for current training batch (not yet stored)
  let pendingTrainingItems = []; // [{ features, dataUrl, filename }]

  document.addEventListener("DOMContentLoaded", initApp);

  function initApp() {
    // Tabs
    tabButtons = Array.from(document.querySelectorAll(".tab-button"));
    trainingPanel = document.getElementById("training-panel");
    analysisPanel = document.getElementById("analysis-panel");

    tabButtons.forEach((btn) =>
      btn.addEventListener("click", () => switchTab(btn.dataset.tab))
    );

    // Training elements
    trainImagesInput = document.getElementById("train-images-input");
    trainPreviewGrid = document.getElementById("train-preview-grid");
    addToDbBtn = document.getElementById("add-to-db-btn");
    trainModelBtn = document.getElementById("train-model-btn");
    trainCountSpan = document.getElementById("train-count");
    trainMessageDiv = document.getElementById("train-message");

    trainImagesInput.addEventListener("change", onTrainingFilesSelected);
    addToDbBtn.addEventListener("click", onAddToDatabase);
    trainModelBtn.addEventListener("click", onTrainModel);

    // Analysis elements
    analysisImagesInput = document.getElementById("analysis-images-input");
    runAnalysisBtn = document.getElementById("run-analysis-btn");
    analysisMessageDiv = document.getElementById("analysis-message");
    analysisResultsGrid = document.getElementById("analysis-results-grid");

    runAnalysisBtn.addEventListener("click", onRunAnalysis);

    // Database controls
    downloadDbBtn = document.getElementById("download-db-btn");
    uploadDbBtn = document.getElementById("upload-db-btn");
    uploadDbInput = document.getElementById("upload-db-input");

    downloadDbBtn.addEventListener("click", onDownloadDatabase);
    uploadDbBtn.addEventListener("click", () => uploadDbInput.click());
    uploadDbInput.addEventListener("change", onUploadDatabase);

    // Load database and model from localStorage
    LipidStorage.load();
    const savedState = LipidStorage.getModelState();
    if (savedState) {
      LipidModel.loadModelState(savedState);
    }
    updateTrainingCountDisplay();
  }

  function switchTab(tabName) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    trainingPanel.classList.toggle("active", tabName === "training");
    analysisPanel.classList.toggle("active", tabName === "analysis");
  }

  // -------- Training Logic --------

  async function onTrainingFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    pendingTrainingItems = [];
    trainPreviewGrid.innerHTML = "";
    clearMessage(trainMessageDiv);

    if (files.length === 0) return;

    for (const file of files) {
      try {
        const { features, dataUrl } = await extractFeaturesFromFile(file);
        const itemIndex = pendingTrainingItems.length;
        pendingTrainingItems.push({
          features,
          dataUrl,
          filename: file.name,
        });
        addTrainingCard(itemIndex, dataUrl, file.name);
      } catch (err) {
        console.error("Failed to process file:", file.name, err);
      }
    }

    if (pendingTrainingItems.length > 0) {
      setMessage(
        trainMessageDiv,
        `${pendingTrainingItems.length} image(s) ready to be added to the training database.`,
        "success"
      );
    }
  }

  function addTrainingCard(index, dataUrl, filename) {
    const card = document.createElement("div");
    card.className = "image-card";
    card.dataset.index = String(index);

    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = filename;

    const fileLabel = document.createElement("div");
    fileLabel.className = "filename";
    fileLabel.textContent = filename;

    const labelWrapper = document.createElement("label");
    labelWrapper.textContent = "Known lipid droplet (%)";

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "0.1";
    input.placeholder = "e.g. 35";

    labelWrapper.appendChild(input);

    card.appendChild(img);
    card.appendChild(fileLabel);
    card.appendChild(labelWrapper);

    trainPreviewGrid.appendChild(card);
  }

  function onAddToDatabase() {
    if (pendingTrainingItems.length === 0) {
      setMessage(
        trainMessageDiv,
        "No pending training images. Please select images first.",
        "error"
      );
      return;
    }

    const cards = Array.from(
      trainPreviewGrid.querySelectorAll(".image-card")
    );
    let added = 0;
    let skipped = 0;

    cards.forEach((card) => {
      const index = Number(card.dataset.index);
      const item = pendingTrainingItems[index];
      if (!item) return;

      const input = card.querySelector("input[type='number']");
      const value = parseFloat(input.value);

      if (isNaN(value) || value < 0 || value > 100) {
        skipped++;
        return;
      }

      LipidStorage.addSample({
        features: Array.from(item.features),
        labelPercent: value,
        filename: item.filename,
      });
      added++;
    });

    updateTrainingCountDisplay();

    if (added > 0) {
      setMessage(
        trainMessageDiv,
        `${added} image(s) added to the training database. ${skipped} image(s) skipped due to invalid percentage.`,
        "success"
      );
    } else {
      setMessage(
        trainMessageDiv,
        "No image was added. Please ensure each image has a valid percentage (0–100).",
        "error"
      );
    }

    // Clear current pending batch
    pendingTrainingItems = [];
    trainPreviewGrid.innerHTML = "";
    trainImagesInput.value = "";
  }

  function onTrainModel() {
    const samples = LipidStorage.getSamples();
    if (!samples || samples.length === 0) {
      setMessage(
        trainMessageDiv,
        "No samples in the training database. Please add labeled images first.",
        "error"
      );
      return;
    }

    setMessage(trainMessageDiv, "Training in progress…", "success");

    // In this simple implementation, training is synchronous and quick.
    LipidModel.train(samples, 250, 0.4);

    const state = LipidModel.getModelState();
    LipidStorage.setModelState(state);

    setMessage(
      trainMessageDiv,
      `Training finished using ${samples.length} image(s). Model state has been updated.`,
      "success"
    );
  }

  function updateTrainingCountDisplay() {
    if (trainCountSpan) {
      trainCountSpan.textContent = String(LipidStorage.getSampleCount());
    }
  }

  // -------- Analysis Logic --------

  async function onRunAnalysis() {
    clearMessage(analysisMessageDiv);
    analysisResultsGrid.innerHTML = "";

    const files = Array.from(analysisImagesInput.files || []);
    if (files.length === 0) {
      setMessage(
        analysisMessageDiv,
        "No images selected. Please select one or more images for analysis.",
        "error"
      );
      return;
    }

    const savedState = LipidStorage.getModelState();
    if (!savedState) {
      setMessage(
        analysisMessageDiv,
        "No trained model found. Please train the AI model first in the Training tab.",
        "error"
      );
      return;
    }

    // Ensure model in memory matches stored state
    LipidModel.loadModelState(savedState);

    let processed = 0;

    for (const file of files) {
      try {
        const { features, dataUrl } = await extractFeaturesFromFile(file);
        const predicted = LipidModel.predictPercentage(features);
        addAnalysisCard(dataUrl, file.name, predicted);
        processed++;
      } catch (err) {
        console.error("Failed to analyze file:", file.name, err);
      }
    }

    if (processed > 0) {
      setMessage(
        analysisMessageDiv,
        `Analysis completed for ${processed} image(s).`,
        "success"
      );
    } else {
      setMessage(
        analysisMessageDiv,
        "No image could be processed. Please check the files and try again.",
        "error"
      );
    }
  }

  function addAnalysisCard(dataUrl, filename, predictedPercent) {
    const card = document.createElement("div");
    card.className = "image-card";

    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = filename;

    const fileLabel = document.createElement("div");
    fileLabel.className = "filename";
    fileLabel.textContent = filename;

    const predictionLabel = document.createElement("div");
    predictionLabel.className = "prediction-value";
    const rounded = Math.round(predictedPercent * 10) / 10;
    predictionLabel.textContent = `Predicted lipid droplet: ${rounded.toFixed(
      1
    )} %`;

    card.appendChild(img);
    card.appendChild(fileLabel);
    card.appendChild(predictionLabel);

    analysisResultsGrid.appendChild(card);
  }

  // -------- Database Download / Upload --------

  function onDownloadDatabase() {
    const json = LipidStorage.exportToJsonString();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `lipid_ai_database_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onUploadDatabase(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const ok = LipidStorage.importFromJsonString(text);
      if (ok) {
        const state = LipidStorage.getModelState();
        if (state) {
          LipidModel.loadModelState(state);
        }
        updateTrainingCountDisplay();
        setMessage(
          trainMessageDiv,
          "Database imported successfully. Training samples and model state updated.",
          "success"
        );
      } else {
        setMessage(
          trainMessageDiv,
          "Failed to import database. Please check that the JSON file is valid.",
          "error"
        );
      }
      uploadDbInput.value = "";
    };
    reader.onerror = () => {
      setMessage(
        trainMessageDiv,
        "Error reading database file. Please try again.",
        "error"
      );
      uploadDbInput.value = "";
    };
    reader.readAsText(file);
  }

  // -------- Utilities --------

  /**
   * Read an image file, resize to 64x64, return features and preview data URL.
   * @param {File} file
   * @returns {Promise<{features: number[], dataUrl: string}>}
   */
  function extractFeaturesFromFile(file) {
    const TARGET_SIZE = 64;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = TARGET_SIZE;
            canvas.height = TARGET_SIZE;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, TARGET_SIZE, TARGET_SIZE);
            const imageData = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
            const features = LipidModel.extractFeaturesFromImageData(imageData);
            const dataUrl = canvas.toDataURL("image/png");
            resolve({ features, dataUrl });
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setMessage(element, text, type) {
    if (!element) return;
    element.textContent = text || "";
    element.classList.remove("success", "error");
    if (type === "success") {
      element.classList.add("success");
    } else if (type === "error") {
      element.classList.add("error");
    }
  }

  function clearMessage(element) {
    if (!element) return;
    element.textContent = "";
    element.classList.remove("success", "error");
  }
})();
