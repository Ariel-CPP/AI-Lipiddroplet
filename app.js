// app.js

document.addEventListener("DOMContentLoaded", () => {
  // Saat load, coba ambil model dari localStorage
  const hasModel = loadModelFromLocalStorage();

  const page = document.body.getAttribute("data-page");
  if (page === "training") {
    initTrainingPage(hasModel);
  } else if (page === "analysis") {
    initAnalysisPage(hasModel);
  }
});

/* --------------------- Training page --------------------- */

function initTrainingPage(hasModel) {
  const totalTrainedEl = document.getElementById("totalTrainedImages");
  const modelStatusEl = document.getElementById("modelStatus");
  const trainImagesInput = document.getElementById("trainImagesInput");
  const trainImagesLabel = document.getElementById("trainImagesLabel");
  const trainButton = document.getElementById("trainButton");
  const downloadDbButton = document.getElementById("downloadDbButton");
  const uploadDbInput = document.getElementById("uploadDbInput");
  const uploadDbLabel = document.getElementById("uploadDbLabel");
  const trainingLog = document.getElementById("trainingLog");

  function updateStats() {
    totalTrainedEl.textContent = LipidModel.samples.length.toString();
    if (LipidModel.samples.length === 0) {
      modelStatusEl.textContent = "Not trained";
      modelStatusEl.style.backgroundColor = "#fee2e2";
      modelStatusEl.style.color = "#b91c1c";
    } else {
      modelStatusEl.textContent = "Trained";
      modelStatusEl.style.backgroundColor = "#dcfce7";
      modelStatusEl.style.color = "#166534";
    }
  }

  updateStats();

  if (hasModel) {
    appendLog(trainingLog, "Model loaded from previous session.");
    updateStats();
  }

  trainImagesInput.addEventListener("change", () => {
    if (!trainImagesInput.files || !trainImagesInput.files.length) {
      trainImagesLabel.textContent = "No files selected";
    } else {
      trainImagesLabel.textContent = `${trainImagesInput.files.length} file(s) selected`;
    }
  });

  uploadDbInput.addEventListener("change", () => {
    if (!uploadDbInput.files || !uploadDbInput.files.length) {
      uploadDbLabel.textContent = "No file selected";
    } else {
      uploadDbLabel.textContent = uploadDbInput.files[0].name;
    }
  });

  trainButton.addEventListener("click", async () => {
    const files = trainImagesInput.files;
    if (!files || !files.length) {
      alert("Please choose training images first.");
      return;
    }

    for (const file of files) {
      // Minta persentase ground-truth per gambar
      let label = prompt(
        `Ground-truth lipid droplet percentage (0–100) for:\n${file.name}`
      );
      if (label === null) {
        appendLog(trainingLog, `Skipped ${file.name}`);
        continue;
      }
      label = Number(label);
      if (Number.isNaN(label) || label < 0 || label > 100) {
        alert("Please input a number between 0 and 100.");
        appendLog(trainingLog, `Invalid label for ${file.name}, skipped.`);
        continue;
      }

      appendLog(trainingLog, `Processing ${file.name} ...`);
      try {
        const feature = await computeFeatureFromImageFile(file);
        addTrainingSample(feature, label);
        appendLog(
          trainingLog,
          `Trained on ${file.name} (feature=${feature.toFixed(
            3
          )}, label=${label}%).`
        );
      } catch (e) {
        console.error(e);
        appendLog(trainingLog, `Failed on ${file.name}: ${e.message}`);
      }
    }

    saveModelToLocalStorage();
    updateStats();
    trainImagesInput.value = "";
    trainImagesLabel.textContent = "No files selected";
  });

  downloadDbButton.addEventListener("click", () => {
    if (!LipidModel.samples.length) {
      const proceed = confirm(
        "Model has no training data yet. Download empty database anyway?"
      );
      if (!proceed) return;
    }
    downloadModelAsJson();
  });

  uploadDbInput.addEventListener("change", async () => {
    const file = uploadDbInput.files?.[0];
    if (!file) return;

    try {
      await importModelFromFile(file);
      appendLog(trainingLog, `Database loaded from ${file.name}.`);
      updateStats();
    } catch (e) {
      console.error(e);
      alert("Failed to import JSON database. Please check the file.");
    }
  });
}

/* --------------------- Analysis page --------------------- */

function initAnalysisPage(hasModel) {
  const analysisImagesInput = document.getElementById("analysisImagesInput");
  const analysisImagesLabel = document.getElementById("analysisImagesLabel");
  const runAnalysisButton = document.getElementById("runAnalysisButton");
  const resultsBody = document.getElementById("resultsTableBody");
  const analysisStatus = document.getElementById("analysisStatus");

  if (!hasModel || LipidModel.samples.length === 0) {
    analysisStatus.textContent =
      "Model not trained yet. Please train or load a JSON database on the Training page.";
    analysisStatus.style.color = "#b91c1c";
  } else {
    analysisStatus.textContent =
      "Model loaded. You can now analyse multiple images.";
  }

  analysisImagesInput.addEventListener("change", () => {
    if (!analysisImagesInput.files || !analysisImagesInput.files.length) {
      analysisImagesLabel.textContent = "No files selected";
    } else {
      analysisImagesLabel.textContent = `${analysisImagesInput.files.length} file(s) selected`;
    }
  });

  runAnalysisButton.addEventListener("click", async () => {
    const files = analysisImagesInput.files;
    if (!files || !files.length) {
      alert("Please choose images to analyse first.");
      return;
    }

    if (LipidModel.samples.length === 0) {
      alert("Model is not trained yet. Go to Training page first.");
      return;
    }

    resultsBody.innerHTML = "";
    analysisStatus.textContent = "Running analysis...";
    analysisStatus.style.color = "#6b7280";

    let index = 1;
    for (const file of files) {
      try {
        const feature = await computeFeatureFromImageFile(file);
        const pred = predictFromFeature(feature);
        const row = document.createElement("tr");

        const cellIdx = document.createElement("td");
        const cellName = document.createElement("td");
        const cellPred = document.createElement("td");

        cellIdx.textContent = index.toString();
        cellName.textContent = file.name;
        cellPred.textContent =
          pred == null ? "N/A" : `${pred.toFixed(1)} % (est.)`;

        row.appendChild(cellIdx);
        row.appendChild(cellName);
        row.appendChild(cellPred);
        resultsBody.appendChild(row);
        index++;
      } catch (e) {
        console.error(e);
      }
    }

    analysisStatus.textContent = "Analysis completed.";
    analysisStatus.style.color = "#166534";

    analysisImagesInput.value = "";
    analysisImagesLabel.textContent = "No files selected";
  });
}

/* --------------------- Helpers --------------------- */

function appendLog(container, text) {
  const p = document.createElement("div");
  p.textContent = text;
  container.appendChild(p);
  container.scrollTop = container.scrollHeight;
}
