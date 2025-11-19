// app.js
// Connects the UI for both Training and Analysis pages with NeuralModel and Storage.

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "train") {
    initTrainingPage();
  } else if (page === "analyze") {
    initAnalysisPage();
  }
});

/* ===========================
   Training page
   =========================== */

function initTrainingPage() {
  let db = Storage.load();
  if (db.model) {
    NeuralModel.loadFromObject(db.model);
  }

  const trainImagesInput = document.getElementById("train-images");
  const trainingList = document.getElementById("training-list");
  const trainButton = document.getElementById("train-button");
  const trainStatus = document.getElementById("train-status");
  const trainFileCount = document.getElementById("train-file-count");
  const trainedCountEl = document.getElementById("trained-count");
  const dbInfoEl = document.getElementById("db-info");
  const downloadDbBtn = document.getElementById("download-db");
  const uploadDbInput = document.getElementById("upload-db");
  const uploadDbStatus = document.getElementById("upload-db-status");

  function updateStats() {
    const stats = db.stats || { totalSamples: 0 };
    trainedCountEl.textContent = stats.totalSamples || 0;

    const desc = NeuralModel.describe();
    dbInfoEl.textContent =
      "Image size " +
      desc.imageSize +
      "×" +
      desc.imageSize +
      ", trained samples: " +
      desc.trainedSamples;
  }

  updateStats();

  trainImagesInput.addEventListener("change", () => {
    const files = Array.from(trainImagesInput.files || []);
    trainingList.innerHTML = "";
    if (!files.length) {
      trainFileCount.textContent = "No files selected.";
      return;
    }
    trainFileCount.textContent = files.length + " file(s) selected.";

    files.forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "training-item";

      const header = document.createElement("div");
      header.className = "training-item-header";

      const img = document.createElement("img");
      img.className = "training-thumb";
      img.alt = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result;
      };
      reader.readAsDataURL(file);

      const meta = document.createElement("div");
      meta.className = "training-meta";

      const filename = document.createElement("div");
      filename.className = "training-filename";
      filename.textContent = file.name;

      const size = document.createElement("div");
      size.className = "training-size";
      size.textContent = Math.round(file.size / 1024) + " KB";

      meta.appendChild(filename);
      meta.appendChild(size);

      header.appendChild(img);
      header.appendChild(meta);

      const inputRow = document.createElement("div");
      inputRow.className = "training-input-row";

      const label = document.createElement("label");
      label.textContent = "Lipid droplets (%)";

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "100";
      input.step = "0.1";
      input.className = "percent-input";
      input.placeholder = "e.g. 35";

      // attach index for later
      input.dataset.fileIndex = String(index);

      inputRow.appendChild(label);
      inputRow.appendChild(input);

      item.appendChild(header);
      item.appendChild(inputRow);

      trainingList.appendChild(item);
    });
  });

  trainButton.addEventListener("click", async () => {
    const files = Array.from(trainImagesInput.files || []);
    if (!files.length) {
      trainStatus.textContent = "No images selected for training.";
      trainStatus.className = "status-text error";
      return;
    }

    // Collect label inputs
    const inputs = trainingList.querySelectorAll(".percent-input");
    const samples = [];

    inputs.forEach((input) => {
      const idx = Number(input.dataset.fileIndex);
      const value = parseFloat(input.value);
      if (!Number.isNaN(value) && idx >= 0 && idx < files.length) {
        samples.push({ file: files[idx], label: value });
      }
    });

    if (!samples.length) {
      trainStatus.textContent =
        "No valid percentage values entered. Please fill in the fields.";
      trainStatus.className = "status-text error";
      return;
    }

    trainStatus.textContent = "Training model on " + samples.length + " image(s)...";
    trainStatus.className = "status-text";

    let processed = 0;
    let totalAbsError = 0;

    for (const sample of samples) {
      try {
        const features = await NeuralModel.imageFileToFeatures(sample.file);
        const { prediction, error } = NeuralModel.trainOnSample(
          features,
          sample.label
        );
        processed += 1;
        totalAbsError += Math.abs(error);
      } catch (err) {
        console.error("Error training on sample:", err);
      }
    }

    const meanAbsError =
      processed > 0 ? (totalAbsError / processed).toFixed(2) : "n/a";

    db.model = NeuralModel.getConfig();
    db.stats = db.stats || { totalSamples: 0 };
    db.stats.totalSamples =
      (db.stats.totalSamples || 0) + processed;
    Storage.save(db);

    updateStats();

    trainStatus.textContent =
      "Training completed for " +
      processed +
      " image(s). Approximate mean absolute error: " +
      meanAbsError +
      " %.";
    trainStatus.className = "status-text success";
  });

  downloadDbBtn.addEventListener("click", () => {
    const blob = Storage.exportToBlob(db);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lipid_droplet_ai_database.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  uploadDbInput.addEventListener("change", async () => {
    const file = uploadDbInput.files && uploadDbInput.files[0];
    if (!file) return;
    uploadDbStatus.textContent = "Importing database...";
    uploadDbStatus.className = "status-text";

    try {
      const imported = await Storage.importFromFile(file);
      db = imported;
      if (db.model) {
        NeuralModel.loadFromObject(db.model);
      }
      updateStats();
      uploadDbStatus.textContent = "Database imported successfully.";
      uploadDbStatus.className = "status-text success";
    } catch (err) {
      console.error(err);
      uploadDbStatus.textContent =
        "Failed to import database: " + (err.message || "Unknown error");
      uploadDbStatus.className = "status-text error";
    } finally {
      uploadDbInput.value = "";
    }
  });
}

/* ===========================
   Analysis page
   =========================== */

function initAnalysisPage() {
  const db = Storage.load();
  if (db.model) {
    NeuralModel.loadFromObject(db.model);
  }

  const modelStatusEl = document.getElementById("analysis-model-status");
  const analysisImagesInput = document.getElementById("analysis-images");
  const analysisFileCount = document.getElementById("analysis-file-count");
  const analyzeButton = document.getElementById("analyze-button");
  const analysisStatus = document.getElementById("analysis-status");
  const analysisResults = document.getElementById("analysis-results");

  const desc = NeuralModel.describe();
  if (db.model && desc.trainedSamples > 0) {
    modelStatusEl.textContent =
      "Loaded model with " + desc.trainedSamples + " trained samples.";
  } else {
    modelStatusEl.textContent =
      "No trained model found. Predictions may not be meaningful until training is performed or a database is imported.";
  }

  analysisImagesInput.addEventListener("change", () => {
    const files = Array.from(analysisImagesInput.files || []);
    if (!files.length) {
      analysisFileCount.textContent = "No files selected.";
      return;
    }
    analysisFileCount.textContent = files.length + " file(s) selected.";
  });

  analyzeButton.addEventListener("click", async () => {
    const files = Array.from(analysisImagesInput.files || []);
    if (!files.length) {
      analysisStatus.textContent = "No images selected for analysis.";
      analysisStatus.className = "status-text error";
      return;
    }

    analysisResults.innerHTML = "";
    analysisStatus.textContent = "Running analysis on " + files.length + " image(s)...";
    analysisStatus.className = "status-text";

    let index = 0;
    for (const file of files) {
      index += 1;
      try {
        const features = await NeuralModel.imageFileToFeatures(file);
        const prediction = NeuralModel.predictFromFeatures(features);
        appendResultRow(analysisResults, index, file, prediction);
      } catch (err) {
        console.error("Analysis error for file", file.name, err);
        appendResultRow(analysisResults, index, file, NaN, err);
      }
    }

    analysisStatus.textContent = "Analysis completed for " + files.length + " image(s).";
    analysisStatus.className = "status-text success";
  });
}

function appendResultRow(tbody, index, file, prediction, error) {
  const tr = document.createElement("tr");

  // index
  const tdIdx = document.createElement("td");
  tdIdx.textContent = String(index);
  tr.appendChild(tdIdx);

  // preview
  const tdPreview = document.createElement("td");
  const img = document.createElement("img");
  img.className = "results-thumb";
  img.alt = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  tdPreview.appendChild(img);
  tr.appendChild(tdPreview);

  // file name
  const tdName = document.createElement("td");
  tdName.textContent = file.name;
  tr.appendChild(tdName);

  // prediction
  const tdPred = document.createElement("td");
  if (Number.isNaN(prediction) || error) {
    tdPred.textContent = "Error";
    tdPred.style.color = "#d9534f";
  } else {
    tdPred.textContent = prediction.toFixed(2) + " %";
  }
  tr.appendChild(tdPred);

  tbody.appendChild(tr);
}
