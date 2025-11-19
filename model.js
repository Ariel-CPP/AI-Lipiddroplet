// model.js

// Global model variable
let lipidModel = null;

// Konfigurasi input gambar
const IMG_WIDTH = 128;
const IMG_HEIGHT = 128;
const IMG_CHANNELS = 3;

// Membuat model baru (CNN kecil untuk regresi)
function createNewModel() {
  const model = tf.sequential();

  model.add(
    tf.layers.conv2d({
      inputShape: [IMG_HEIGHT, IMG_WIDTH, IMG_CHANNELS],
      filters: 16,
      kernelSize: 3,
      activation: "relu",
    })
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  model.add(
    tf.layers.conv2d({
      filters: 32,
      kernelSize: 3,
      activation: "relu",
    })
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  model.add(
    tf.layers.conv2d({
      filters: 64,
      kernelSize: 3,
      activation: "relu",
    })
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  model.add(tf.layers.flatten());

  model.add(
    tf.layers.dense({
      units: 64,
      activation: "relu",
    })
  );

  // Output 1 unit (persentase lipid droplet, 0–100)
  model.add(
    tf.layers.dense({
      units: 1,
      activation: "linear",
    })
  );

  model.compile({
    optimizer: tf.train.adam(0.0005),
    loss: "meanSquaredError",
    metrics: ["mae"],
  });

  return model;
}

// Inisialisasi model: coba load dari IndexedDB, kalau gagal buat baru
async function initModel() {
  if (lipidModel) return lipidModel;

  try {
    lipidModel = await tf.loadLayersModel("indexeddb:lipid-droplet-model");
    console.log("Model loaded from IndexedDB.");
  } catch (err) {
    console.log("No saved model found. Creating a new model.", err);
    lipidModel = createNewModel();
  }

  return lipidModel;
}

// Train model dengan dataset
async function trainLipidModel(trainXs, trainYs, epochs, batchSize, onBatchEndCb) {
  if (!lipidModel) {
    lipidModel = createNewModel();
  }

  const history = await lipidModel.fit(trainXs, trainYs, {
    epochs,
    batchSize,
    shuffle: true,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        if (onBatchEndCb) {
          onBatchEndCb(epoch, logs);
        }
        await tf.nextFrame();
      },
    },
  });

  return history;
}

// Prediksi persentase lipid droplet dari 1 tensor gambar [H,W,3]
async function predictLipidPercentage(imgTensor) {
  if (!lipidModel) {
    lipidModel = await initModel();
  }

  // bentuk tensor [1, H, W, 3]
  const input = imgTensor.expandDims(0); // add batch dimension

  const pred = lipidModel.predict(input);
  const value = (await pred.data())[0];

  input.dispose();
  pred.dispose();

  // clamp ke 0–100
  const clamped = Math.max(0, Math.min(100, value));
  return clamped;
}

// Simpan model ke IndexedDB
async function saveLipidModel() {
  if (!lipidModel) {
    throw new Error("Model belum dibuat.");
  }
  await lipidModel.save("indexeddb:lipid-droplet-model");
}

// Helper: preprocess image to [128,128,3], float32, 0-1
function preprocessImageToTensor(img) {
  return tf.tidy(() => {
    let tensor = tf.browser.fromPixels(img);
    tensor = tf.image.resizeBilinear(tensor, [IMG_HEIGHT, IMG_WIDTH]);
    tensor = tensor.toFloat().div(255.0);
    return tensor;
  });
}
