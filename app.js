// js/app.js
// Menghubungkan UI dengan storage & model

document.addEventListener("DOMContentLoaded", () => {
  const statSampleCount = document.getElementById("stat-sample-count");
  const statModelStatus = document.getElementById("stat-model-status");

  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  const trainImagesInput = document.getElementById("train-images");
  const trainLabelInput = document.getElementById("train-label");
  const btnAddToDataset = document.getElementById("btn-add-to-dataset");
  const trainAddStatus = document.getElementById("train-add-status");
  const datasetSummary = document.getElementById("dataset-summary");

  const epochsInput = document.getElementById("epochs");
  const batchSizeInput = document.getElementById("batch-size");
  const btnTrainModel = document.getElementById("btn-train-model");
  const trainingLog = document.getElementById("training-log");

  const btnClearDataset = document.getElementById("btn-clear-dataset");
  const clearStatus = document.getElementById("clear-status");

  const analysisImagesInput = document.getElementById("analysis-images");
  const btnRunAnalysis = document.getElementById("btn-run-analysis");
  const analysisStatus = document.getElementById("analysis-status");
  const analysisResultsBody = document.getElementById("analysis-results-body");

  let currentModel = null;

  // === Tabs handling ===
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      tabContents.forEach((c) => {
        c.classList.toggle("active", c.id === targetId);
      });
    });
  });

  // === Stats ===
  function refreshStats() {
    const stats = window.LipidStorage.getStats();
    statSampleCount.textContent = stats.count;

    if (currentModel) {
      statModelStatus.textContent = "Model tersedia di browser";
    } else {
      statModelStatus.textContent = "Belum ada model";
    }

    updateDatasetSummary();
  }

  function updateDatasetSummary() {
    const dataset = window.LipidStorage.loadDataset();
    if (dataset.length === 0) {
      datasetSummary.textContent = "Belum ada sampel training tersimpan.";
      return;
    }

    const first = dataset[0];
    const last = dataset[dataset.length - 1];

    const labels = dataset.map((d) => Number(d.label));
    const minLabel = Math.min(...labels);
    const maxLabel = Math.max(...labels);

    datasetSummary.innerHTML = `
      <p>Total sampel: <strong>${dataset.length}</strong></p>
      <p>Rentang label lipid droplet: <strong>${minLabel.toFixed(
        1
      )}% – ${maxLabel.toFixed(1)}%</strong></p>
      <p>Contoh file pertama: <code>${first.name}</code></p>
      <p>Contoh file terakhir: <code>${last.name}</code></p>
    `;
  }

  // === Load model jika ada ===
  async function tryLoadModel() {
    currentModel = await window.LipidModel.loadExistingModel();
    refreshStats();
  }

  // === Helper: baca file gambar jadi dataURL ===
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // === Tambah batch gambar ke dataset ===
  btnAddToDataset.addEventListener("click", async () => {
    const files = Array.from(trainImagesInput.files || []);
    const labelValue = Number(trainLabelInput.value);

    if (files.length === 0) {
      trainAddStatus.textContent = "Silakan pilih minimal satu gambar.";
      return;
    }
    if (isNaN(labelValue) || labelValue < 0 || labelValue > 100) {
      trainAddStatus.textContent =
        "Label persentase lipid droplet harus antara 0–100.";
      return;
    }

    btnAddToDataset.disabled = true;
    trainAddStatus.textContent = "Membaca file dan menyimpan ke dataset...";

    const samples = [];
    for (let i = 0; i < files.length; i++) {
      /* eslint-disable no-await-in-loop */
      const dataUrl = await fileToDataUrl(files[i]);
      /* eslint-enable no-await-in-loop */
      samples.push({
        id: Date.now().toString() + "_" + i,
        name: files[i].name,
        label: labelValue,
        dataUrl,
      });
    }

    const newCount = window.LipidStorage.addSamples(samples);
    trainAddStatus.textContent = `Berhasil menambah ${samples.length} sampel. Total sampel sekarang: ${newCount}.`;

    trainImagesInput.value = "";
    refreshStats();
    btnAddToDataset.disabled = false;
  });

  // === Training model ===
  btnTrainModel.addEventListener("click", async () => {
    const dataset = window.LipidStorage.loadDataset();
    if (dataset.length === 0) {
      trainingLog.textContent =
        "Dataset kosong. Tambahkan sampel training terlebih dahulu.";
      return;
    }

    const epochs = Math.max(
      1,
      Math.min(200, Number(epochsInput.value) || 20)
    );
    const batchSize = Math.max(
      1,
      Math.min(64, Number(batchSizeInput.value) || 8)
    );

    btnTrainModel.disabled = true;
    trainingLog.textContent = "";
    appendLog(`Mulai training dengan ${dataset.length} sampel...`);
    appendLog(`Epoch: ${epochs}, batch size: ${batchSize}`);

    try {
      const model = await window.LipidModel.trainOnDataset(
        dataset,
        epochs,
        batchSize,
        (msg) => appendLog(msg)
      );
      currentModel = model;
      appendLog("Training selesai. Model tersimpan di IndexedDB.");
    } catch (err) {
      console.error(err);
      appendLog("Terjadi error saat training: " + err.message);
    } finally {
      btnTrainModel.disabled = false;
      refreshStats();
    }
  });

  function appendLog(message) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    trainingLog.textContent += `[${timeStr}] ${message}\n`;
    trainingLog.scrollTop = trainingLog.scrollHeight;
  }

  // === Clear dataset ===
  btnClearDataset.addEventListener("click", () => {
    if (
      !confirm(
        "Yakin ingin menghapus semua sampel training yang tersimpan di browser ini?"
      )
    ) {
      return;
    }
    window.LipidStorage.clearDataset();
    clearStatus.textContent = "Dataset lokal sudah dihapus.";
    refreshStats();
  });

  // === Analisa (batch gambar) ===
  btnRunAnalysis.addEventListener("click", async () => {
    const files = Array.from(analysisImagesInput.files || []);
    if (files.length === 0) {
      analysisStatus.textContent =
        "Silakan pilih minimal satu gambar untuk dianalisa.";
      return;
    }

    if (!currentModel) {
      analysisStatus.textContent =
        "Model belum ada. Silakan training model terlebih dahulu di tab Training.";
      return;
    }

    btnRunAnalysis.disabled = true;
    analysisStatus.textContent =
      "Mengolah gambar dan menjalankan prediksi...";

    analysisResultsBody.innerHTML = "";

    for (let i = 0; i < files.length; i++) {
      /* eslint-disable no-await-in-loop */
      const file = files[i];
      const dataUrl = await fileToDataUrl(file);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const prediction = await window.LipidModel.predictOnImageElement(
        currentModel,
        img
      );
      const clamped = Math.max(0, Math.min(100, prediction));
      const rounded = clamped.toFixed(1);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${i + 1}</td>
        <td><img src="${dataUrl}" class="preview-img" /></td>
        <td>${file.name}</td>
        <td><strong>${rounded}</strong> %</td>
      `;
      analysisResultsBody.appendChild(row);
      /* eslint-enable no-await-in-loop */
    }

    analysisStatus.textContent = "Analisa selesai.";
    btnRunAnalysis.disabled = false;
  });

  // Init
  tryLoadModel();
  refreshStats();
});
