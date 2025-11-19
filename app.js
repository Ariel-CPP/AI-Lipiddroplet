// app.js
// Menghubungkan UI, Storage, dan Model

document.addEventListener("DOMContentLoaded", () => {
  // --- ELEMEN DOM ---
  const sampleCountEl = document.getElementById("sample-count");

  // Tabs
  const tabButtons = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".panel");

  // Training
  const trainingFilesInput = document.getElementById("training-files");
  const trainingPreviewContainer = document.getElementById("training-preview-container");
  const trainButton = document.getElementById("train-button");
  const trainingStatus = document.getElementById("training-status");

  // Analysis
  const analysisFilesInput = document.getElementById("analysis-files");
  const analyzeButton = document.getElementById("analyze-button");
  const analysisStatus = document.getElementById("analysis-status");
  const analysisResultsContainer = document.getElementById("analysis-results");

  // --- STATE ---
  let trainingFiles = []; // { id, file }
  let analysisFiles = []; // { id, file }

  // --- INIT: load dataset dari storage ---
  const initialSamples = LipidStorage.loadSamples();
  LipidModel.setSamples(initialSamples);
  updateSampleCountDisplay();

  // --- FUNGSI UTILITAS UI ---

  function updateSampleCountDisplay() {
    const count = LipidStorage.getSampleCount();
    sampleCountEl.textContent = count;
  }

  function clearChildren(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function switchTab(targetId) {
    panels.forEach((p) => {
      p.classList.toggle("active", p.id === targetId);
    });
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === targetId);
    });
  }

  // --- RENDER TRAINING PREVIEW ---

  function renderTrainingPreview() {
    clearChildren(trainingPreviewContainer);
    if (trainingFiles.length === 0) return;

    trainingFiles.forEach((item) => {
      const card = document.createElement("div");
      card.className = "image-card";
      card.dataset.id = item.id;

      const thumbWrapper = document.createElement("div");
      thumbWrapper.className = "image-thumb-wrapper";

      const img = document.createElement("img");
      img.className = "image-thumb";
      img.alt = item.file.name;

      // Preview image
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.readAsDataURL(item.file);

      thumbWrapper.appendChild(img);

      const filename = document.createElement("div");
      filename.className = "image-filename";
      filename.textContent = item.file.name;

      const meta = document.createElement("div");
      meta.className = "image-meta";

      const label = document.createElement("label");
      label.textContent = "Lipid droplet (%)";

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "100";
      input.step = "0.1";
      input.placeholder = "misal 35.2";
      input.dataset.percentFor = item.id;

      meta.appendChild(label);
      meta.appendChild(input);

      card.appendChild(thumbWrapper);
      card.appendChild(filename);
      card.appendChild(meta);

      trainingPreviewContainer.appendChild(card);
    });
  }

  // --- EVENT: perubahan file training ---

  trainingFilesInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    trainingFiles = files.map((f, idx) => ({
      id: `train_${Date.now()}_${idx}`,
      file: f,
    }));
    renderTrainingPreview();
    trainingStatus.textContent = files.length
      ? `Dipilih ${files.length} gambar untuk training. Isi persentase masing-masing lalu klik "Simpan & Latih Model".`
      : "";
  });

  // --- PROSES TRAINING ---

  async function handleTraining() {
    if (trainingFiles.length === 0) {
      trainingStatus.textContent = "Tidak ada gambar untuk training.";
      return;
    }

    // Reset error UI
    document
      .querySelectorAll("#training-preview-container input[type='number']")
      .forEach((inp) => inp.classList.remove("error"));

    // Ambil persentase per gambar
    const entries = [];
    let hasError = false;

    trainingFiles.forEach((item) => {
      const input = document.querySelector(
        `input[data-percent-for="${item.id}"]`
      );
      if (!input) return;

      const valueStr = input.value.trim();
      const value = parseFloat(valueStr);

      if (
        !valueStr ||
        Number.isNaN(value) ||
        value < 0 ||
        value > 100
      ) {
        input.classList.add("error");
        hasError = true;
      } else {
        entries.push({ item, percent: value });
      }
    });

    if (hasError) {
      trainingStatus.textContent =
        "Beberapa gambar belum diisi persentase dengan benar (0–100%).";
      return;
    }

    trainingStatus.textContent = "Memproses gambar dan menyimpan ke dataset...";
    trainButton.disabled = true;

    try {
      const newSamples = [];

      for (const entry of entries) {
        const features = await LipidModel.extractFeaturesFromFile(
          entry.item.file
        );
        newSamples.push({
          features,
          label: entry.percent,
        });
      }

      // Simpan ke storage dan update model
      const merged = LipidStorage.appendSamples(newSamples);
      LipidModel.setSamples(merged);
      updateSampleCountDisplay();

      trainingStatus.textContent = `Berhasil menambahkan ${newSamples.length} sampel ke dataset.`;
      // Opsional: reset pilihan training
      trainingFiles = [];
      trainingFilesInput.value = "";
      clearChildren(trainingPreviewContainer);
    } catch (err) {
      console.error(err);
      trainingStatus.textContent =
        "Terjadi kesalahan saat memproses gambar. Periksa console log.";
    } finally {
      trainButton.disabled = false;
    }
  }

  trainButton.addEventListener("click", () => {
    handleTraining();
  });

  // --- ANALISA ---

  analysisFilesInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    analysisFiles = files.map((f, idx) => ({
      id: `analysis_${Date.now()}_${idx}`,
      file: f,
    }));

    analysisStatus.textContent = files.length
      ? `Dipilih ${files.length} gambar untuk analisa.`
      : "";
    clearChildren(analysisResultsContainer);
  });

  async function handleAnalysis() {
    if (!LipidModel.hasSamples()) {
      analysisStatus.textContent =
        "Belum ada dataset training. Silakan lakukan training terlebih dahulu.";
      return;
    }

    if (analysisFiles.length === 0) {
      analysisStatus.textContent = "Tidak ada gambar untuk dianalisa.";
      return;
    }

    analysisStatus.textContent = "Memproses dan menganalisa gambar...";
    analyzeButton.disabled = true;
    clearChildren(analysisResultsContainer);

    try {
      for (const item of analysisFiles) {
        const features = await LipidModel.extractFeaturesFromFile(item.file);
        const predicted = LipidModel.predictSingle(features, 5);

        const card = document.createElement("div");
        card.className = "image-card";

        const thumbWrapper = document.createElement("div");
        thumbWrapper.className = "image-thumb-wrapper";
        const img = document.createElement("img");
        img.className = "image-thumb";
        img.alt = item.file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.readAsDataURL(item.file);
        thumbWrapper.appendChild(img);

        const filename = document.createElement("div");
        filename.className = "image-filename";
        filename.textContent = item.file.name;

        const meta = document.createElement("div");
        meta.className = "image-meta";

        const resultBadge = document.createElement("span");
        resultBadge.className = "result-badge";
        if (predicted == null) {
          resultBadge.textContent = "Model belum terlatih";
        } else {
          const rounded = Math.round(predicted * 10) / 10;
          resultBadge.textContent = `Prediksi: ${rounded.toFixed(
            1
          )} % lipid`;
        }

        meta.appendChild(resultBadge);

        const note = document.createElement("div");
        note.className = "result-note";
        note.textContent =
          "Nilai ini merupakan estimasi berbasis kemiripan citra terhadap dataset training (KNN).";

        card.appendChild(thumbWrapper);
        card.appendChild(filename);
        card.appendChild(meta);
        card.appendChild(note);

        analysisResultsContainer.appendChild(card);
      }

      analysisStatus.textContent = "Analisa selesai.";
    } catch (err) {
      console.error(err);
      analysisStatus.textContent =
        "Terjadi kesalahan saat analisa gambar. Periksa console log.";
    } finally {
      analyzeButton.disabled = false;
    }
  }

  analyzeButton.addEventListener("click", () => {
    handleAnalysis();
  });

  // --- TAB NAVIGATION ---

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      if (!target) return;
      switchTab(target);
    });
  });
});
