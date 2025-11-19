// app.js
// Page controller: detects whether we are on the training or analysis page
// and attaches appropriate event handlers.

document.addEventListener("DOMContentLoaded", () => {
  const pageType = document.body.getAttribute("data-page");
  const model = StorageAPI.loadModel();

  if (pageType === "training") {
    setupTrainingPage(model);
  } else if (pageType === "analysis") {
    setupAnalysisPage(model);
  }
});

/**
 * Utility: load an image file into ImageData with a fixed maximum size.
 */
function loadImageDataFromFile(file, maxSize = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");

        // keep aspect ratio but bound by maxSize
        const scale = Math.min(
          maxSize / img.width,
          maxSize / img.height,
          1.0
        );
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve({ imageData, canvas });
      };
      img.onerror = () =>
        reject(new Error("Failed to load image: " + file.name));
      img.src = reader.result;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* -------------------- Training page -------------------- */

function setupTrainingPage(model) {
  const fileInput = document.getElementById("training-files");
  const previewContainer = document.getElementById(
    "training-preview-container"
  );
  const trainButton = document.getElementById("train-button");
  const totalTrainedEl = document.getElementById("total-trained");
  const modelInfoEl = document.getElementById("model-info");
  const downloadDbButton = document.getElementById("download-db-button");
  const uploadDbInput = document.getElementById("upload-db-input");
  const uploadDbButton = document.getElementById("upload-db-button");
  const uploadDbStatus = document.getElementById("upload-db-status");

  updateTrainingStats(model, totalTrainedEl, modelInfoEl);

  let selectedFiles = [];

  fileInput.addEventListener("change", () => {
    selectedFiles = Array.from(fileInput.files || []);
    renderTrainingPreview(previewContainer, selectedFiles);
    trainButton.disabled = selectedFiles.length === 0;
  });

  trainButton.addEventListener("click", async () => {
    if (!selectedFiles.length) return;

    trainButton.disabled = true;
    trainButton.textContent = "Training...";

    // Read % inputs
    const rows = previewContainer.querySelectorAll(".preview-item");
    const tasks = [];

    selectedFiles.forEach((file, idx) => {
      const row = rows[idx];
      const percentInput = row.querySelector("input[type='number']");
      const rawPercent = Number(percentInput.value);

      if (Number.isNaN(rawPercent)) {
        return; // skip invalid
      }

      const clipped = Math.max(0, Math.min(100, rawPercent));
      percentInput.value = clipped;

      tasks.push(
        loadImageDataFromFile(file).then(({ imageData }) => {
          const features = window.lipidModelHelpers.extractFeatures(
            model,
            imageData
          );
          model.trainOnFeatures(features, clipped);
        })
      );
    });

    try {
      await Promise.all(tasks);
      StorageAPI.saveModel(model);
      updateTrainingStats(model, totalTrainedEl, modelInfoEl);
      trainButton.textContent = "Train model on selected images";
    } catch (err) {
      console.error(err);
      alert("Error during training: " + err.message);
      trainButton.textContent = "Train model on selected images";
    } finally {
      trainButton.disabled = selectedFiles.length === 0;
    }
  });

  downloadDbButton.addEventListener("click", () => {
    StorageAPI.downloadDatabase(model);
  });

  uploadDbButton.addEventListener("click", async () => {
    const file = uploadDbInput.files && uploadDbInput.files[0];
    if (!file) {
      uploadDbStatus.textContent = "Please choose a JSON file first.";
      return;
    }

    uploadDbStatus.textContent = "Loading database...";
    try {
      const importedModel = await StorageAPI.importDatabaseFromFile(file);
      Object.assign(model, importedModel); // shallow copy fields
      StorageAPI.saveModel(model);
      updateTrainingStats(model, totalTrainedEl, modelInfoEl);
      uploadDbStatus.textContent = "Database loaded successfully.";
    } catch (err) {
      console.error(err);
      uploadDbStatus.textContent =
        "Failed to load database: " + (err.message || err.toString());
    }
  });
}

function renderTrainingPreview(container, files) {
  container.innerHTML = "";
  if (!files.length) {
    container.textContent = "No images selected.";
    return;
  }

  files.forEach((file) => {
    const row = document.createElement("div");
    row.className = "preview-item";

    const img = document.createElement("img");
    img.className = "preview-thumb";
    img.alt = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result;
    };
    reader.readAsDataURL(file);

    const textBox = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.className = "preview-filename";
    nameEl.textContent = file.name;

    const extra = document.createElement("div");
    extra.className = "preview-extra";
    extra.textContent = "Ground truth lipid droplet (%)";

    textBox.appendChild(nameEl);
    textBox.appendChild(extra);

    const inputBox = document.createElement("div");
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "0.1";
    input.placeholder = "0–100";
    input.className = "cp-input-number";
    inputBox.appendChild(input);

    row.appendChild(img);
    row.appendChild(textBox);
    row.appendChild(inputBox);
    container.appendChild(row);
  });
}

function updateTrainingStats(model, totalEl, infoEl) {
  totalEl.textContent = String(model.trainedSamples || 0);
  if (!model.trainedSamples) {
    infoEl.textContent = "Not trained yet – please add training images.";
  } else {
    const dateStr = model.lastUpdated
      ? new Date(model.lastUpdated).toLocaleString()
      : "unknown time";
    infoEl.textContent = `Version ${model.version}, learning rate ${
      model.learningRate
    }, last updated ${dateStr}`;
  }
}

/* -------------------- Analysis page -------------------- */

function setupAnalysisPage(model) {
  const fileInput = document.getElementById("analysis-files");
  const analyzeButton = document.getElementById("analyze-button");
  const resultsContainer = document.getElementById("analysis-results");
  const modelStatus = document.getElementById("analysis-model-status");

  updateAnalysisModelStatus(model, modelStatus);

  let selectedFiles = [];

  fileInput.addEventListener("change", () => {
    selectedFiles = Array.from(fileInput.files || []);
    analyzeButton.disabled = selectedFiles.length === 0;
  });

  analyzeButton.addEventListener("click", async () => {
    if (!selectedFiles.length) return;
    if (!model.trainedSamples) {
      alert(
        "The model has not been trained yet. Please train or import a database on the Training page first."
      );
      return;
    }

    analyzeButton.disabled = true;
    analyzeButton.textContent = "Analysing...";

    const tasks = selectedFiles.map((file) =>
      loadImageDataFromFile(file).then(({ imageData }) => {
        const features = window.lipidModelHelpers.extractFeatures(
          model,
          imageData
        );
        const pred = model.predictFromFeatures(features);
        return { file, prediction: pred };
      })
    );

    try {
      const results = await Promise.all(tasks);
      renderAnalysisResults(resultsContainer, results);
      analyzeButton.textContent = "Run analysis";
    } catch (err) {
      console.error(err);
      alert("Error during analysis: " + err.message);
      analyzeButton.textContent = "Run analysis";
    } finally {
      analyzeButton.disabled = selectedFiles.length === 0;
    }
  });
}

function updateAnalysisModelStatus(model, el) {
  if (!model.trainedSamples) {
    el.textContent =
      "Model not trained yet. Please perform training or load a database on the Training page.";
  } else {
    el.textContent = `Model ready – trained on ${model.trainedSamples} image(s).`;
  }
}

function renderAnalysisResults(container, results) {
  if (!results.length) {
    container.innerHTML = "<p>No images analysed.</p>";
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");

  ["Preview", "Filename", "Predicted lipid droplet (%)"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const tbody = document.createElement("tbody");

  results.forEach(({ file, prediction }) => {
    const tr = document.createElement("tr");

    const tdImg = document.createElement("td");
    const img = document.createElement("img");
    img.className = "results-thumb";
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    tdImg.appendChild(img);

    const tdName = document.createElement("td");
    tdName.textContent = file.name;

    const tdPred = document.createElement("td");
    tdPred.textContent = prediction.toFixed(1);

    tr.appendChild(tdImg);
    tr.appendChild(tdName);
    tr.appendChild(tdPred);

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.innerHTML = "";
  container.appendChild(table);
}

/* -------------------- Shared helpers -------------------- */

window.lipidModelHelpers = {
  extractFeatures(model, imageData) {
    return model.extractFeaturesFromImageData(imageData);
  }
};
