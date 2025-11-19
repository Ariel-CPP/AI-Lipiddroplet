// app.js

// Dataset training disimpan di memori browser (selama halaman terbuka)
const trainImages = []; // array of tf.Tensor3D
const trainLabels = []; // array of number

// Elemen DOM
const tabTraining = document.getElementById("tab-training");
const tabAnalysis = document.getElementById("tab-analysis");
const trainingPanel = document.getElementById("training-panel");
const analysisPanel = document.getElementById("analysis-panel");

const trainImageInput = document.getElementById("train-image-input");
const trainLabelInput = document.getElementById("train-label-input");
const addTrainingSampleBtn = document.getElementById("add-training-sample");
const trainImagePreviewCanvas = document.getElementById("train-image-preview");
const trainDatasetInfo = document.getElementById("train-dataset-info");

const trainEpochsInput = document.getElementById("train-epochs-input");
const trainBatchSizeInput = document.getElementById("train-batch-size-input");
const trainModelBtn = document.getElementById("train-model-btn");
const saveModelBtn = document.getElementById("save-model-btn");
const loadModelBtn = document.getElementById("load-model-btn");
const trainLog = document.getElementById("train-log");

const analysisImageInput = document.getElementById("analysis-image-input");
const analysisImagePreviewCanvas = document.getElementById("analysis-image-preview");
const runAnalysisBtn = document.getElementById("run-analysis-btn");
const analysisResult = document.getElementById("analysis-result");

// Context canvas
const trainPreviewCtx = trainImagePreviewCanvas.getContext("2d");
const analysisPreviewCtx = analysisImagePreviewCanvas.getContext("2d");

// ------------------------ TAB SWITCHING ------------------------

tabTraining.addEventListener("click", () => {
  tabTraining.classList.add("active");
  tabAnalysis.classList.remove("active");
  trainingPanel.classList.add("active");
  analysisPanel.classList.remove("active");
});

tabAnalysis.addEventListener("click", () => {
  tabAnalysis.classList.add("active");
  tabTraining.classList.remove("active");
  analysisPanel.classList.add("active");
  trainingPanel.classList.remove("active");
});

// ------------------------ UTIL: READ & PREVIEW IMAGE ------------------------

function loadImageFileToCanvas(file, canvas, callback) {
  if (!file) return;

  const reader = new FileReader();
  const img = new Image();

  reader.onload = (e) => {
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      // clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // draw image terkecil dengan menjaga rasio
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;
      ctx.drawImage(img, x, y, w, h);

      if (callback) {
        callback(img);
      }
    };
    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

// ------------------------ TRAINING: ADD SAMPLE ------------------------

trainImageInput.addEventListener("change", () => {
  const file = trainImageInput.files[0];
  if (!file) return;

  loadImageFileToCanvas(file, trainImagePreviewCanvas, (img) => {
    // nothing else here; we actually create tensor only when "Tambah ke Dataset" ditekan
  });
});

addTrainingSampleBtn.addEventListener("click", () => {
  const file = trainImageInput.files[0];
  if (!file) {
    alert("Pilih gambar training terlebih dahulu.");
    return;
  }

  const label = parseFloat(trainLabelInput.value);
  if (isNaN(label) || label < 0 || label > 100) {
    alert("Masukkan persentase lipid droplet antara 0–100.");
    return;
  }

  // Baca lagi file untuk dibuat tensor
  const reader = new FileReader();
  const img = new Image();

  reader.onload = (e) => {
    img.onload = () => {
      const tensor = preprocessImageToTensor(img); // dari model.js
      trainImages.push(tensor);
      trainLabels.push(label);

      trainDatasetInfo.textContent = `Dataset: ${trainImages.length} sampel`;
      trainLabelInput.value = "";
      trainImageInput.value = "";
      trainPreviewCtx.clearRect(0, 0, trainImagePreviewCanvas.width, trainImagePreviewCanvas.height);
    };
    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
});

// ------------------------ TRAINING: RUN TRAINING ------------------------

trainModelBtn.addEventListener("click", async () => {
  if (trainImages.length < 3) {
    alert("Minimal butuh beberapa (≥3) sampel untuk mulai training.");
    return;
  }

  const epochs = parseInt(trainEpochsInput.value, 10) || 20;
  const batchSize = parseInt(trainBatchSizeInput.value, 10) || 8;

  const logLines = [];
  function log(text) {
    logLines.push(text);
    trainLog.textContent = logLines.join("\n");
    trainLog.scrollTop = trainLog.scrollHeight;
  }

  log("Menginisialisasi model...");
  await initModel();

  // Buat tensor X dan y dari array
  log("Menyiapkan dataset...");
  const xs = tf.stack(trainImages); // shape [N, H, W, 3]
  const ys = tf.tensor2d(trainLabels.map((v) => [v])); // shape [N, 1]

  log(`Mulai training: epochs=${epochs}, batchSize=${batchSize}, samples=${trainImages.length}`);

  try {
    await trainLipidModel(xs, ys, epochs, batchSize, (epoch, logs) => {
      log(
        `Epoch ${epoch + 1}/${epochs} - loss=${logs.loss?.toFixed(4)} - val_loss=${logs.val_loss?.toFixed(
          4
        )} - mae=${logs.mae?.toFixed(4)}`
      );
    });
    log("Training selesai.");
  } catch (err) {
    console.error(err);
    log("Terjadi error saat training: " + err.message);
  } finally {
    xs.dispose();
    ys.dispose();
  }
});

// ------------------------ TRAINING: SAVE / LOAD MODEL ------------------------

saveModelBtn.addEventListener("click", async () => {
  try {
    await saveLipidModel();
    alert("Model berhasil disimpan ke IndexedDB browser.");
  } catch (err) {
    console.error(err);
    alert("Gagal menyimpan model: " + err.message);
  }
});

loadModelBtn.addEventListener("click", async () => {
  try {
    await initModel();
    alert("Model berhasil diload (dari IndexedDB atau baru dibuat).");
  } catch (err) {
    console.error(err);
    alert("Gagal meload model: " + err.message);
  }
});

// ------------------------ ANALYSIS: IMAGE PREVIEW ------------------------

analysisImageInput.addEventListener("change", () => {
  const file = analysisImageInput.files[0];
  if (!file) return;

  loadImageFileToCanvas(file, analysisImagePreviewCanvas, (img) => {
    // Nothing else; tensor dibuat saat analisa
  });
});

// ------------------------ ANALYSIS: RUN PREDICTION ------------------------

runAnalysisBtn.addEventListener("click", async () => {
  const file = analysisImageInput.files[0];
  if (!file) {
    alert("Pilih gambar untuk dianalisa.");
    return;
  }

  // Pastikan model tersedia
  await initModel();

  const reader = new FileReader();
  const img = new Image();

  reader.onload = (e) => {
    img.onload = async () => {
      const tensor = preprocessImageToTensor(img);
      try {
        const pred = await predictLipidPercentage(tensor);
        analysisResult.textContent = `Perkiraan persentase lipid droplet: ${pred.toFixed(1)}%`;
      } catch (err) {
        console.error(err);
        analysisResult.textContent = "Terjadi error saat analisa: " + err.message;
      } finally {
        tensor.dispose();
      }
    };
    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
});

// ------------------------ INIT ------------------------

// Saat page load, coba inisialisasi model (akan create baru kalau belum ada)
window.addEventListener("load", () => {
  initModel().then(() => {
    console.log("Model siap digunakan.");
  });
});
