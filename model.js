// js/model.js
// Namespace global untuk model TensorFlow.js

window.LipidModel = (function () {
  const MODEL_NAME = "lipid-droplet-model-v1";
  const IMAGE_SIZE = 128;

  function buildModel() {
    const model = tf.sequential();
    model.add(
      tf.layers.conv2d({
        inputShape: [IMAGE_SIZE, IMAGE_SIZE, 3],
        filters: 16,
        kernelSize: 3,
        activation: "relu",
      })
    );
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    model.add(
      tf.layers.conv2d({
        filters: 32,
        kernelSize: 3,
        activation: "relu",
      })
    );
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    model.add(
      tf.layers.conv2d({
        filters: 64,
        kernelSize: 3,
        activation: "relu",
      })
    );
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    model.add(tf.layers.flatten());
    model.add(
      tf.layers.dense({
        units: 64,
        activation: "relu",
      })
    );
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(
      tf.layers.dense({
        units: 1,
        activation: "linear", // output nilai 0–1 (skala %/100)
      })
    );

    model.compile({
      optimizer: tf.train.adam(0.0005),
      loss: "meanSquaredError",
      metrics: ["mae"],
    });

    return model;
  }

  async function loadExistingModel() {
    try {
      const model = await tf.loadLayersModel(
        "indexeddb://" + MODEL_NAME
      );
      return model;
    } catch (e) {
      console.warn("Tidak menemukan model tersimpan:", e.message);
      return null;
    }
  }

  async function saveModel(model) {
    await model.save("indexeddb://" + MODEL_NAME);
  }

  function imageDataUrlToTensor(dataUrl) {
    return tf.tidy(() => {
      const image = new Image();
      image.src = dataUrl;

      // Catatan: kita tidak bisa synchronous menunggu image onload di sini,
      // jadi fungsi ini tidak dipakai untuk DataURL langsung di training.
      // Di training kita lewat <img> yang sudah onload.
      return null;
    });
  }

  async function htmlImageToTensor(imgElement) {
    return tf.tidy(() => {
      const tensor = tf.browser.fromPixels(imgElement);
      const resized = tf.image.resizeBilinear(
        tensor,
        [IMAGE_SIZE, IMAGE_SIZE]
      );
      const normalized = resized.div(255.0);
      return normalized;
    });
  }

  async function trainOnDataset(dataset, epochs, batchSize, onLog) {
    if (!dataset || dataset.length === 0) {
      throw new Error("Dataset kosong, tidak bisa training.");
    }

    // Siapkan elemen <img> untuk diisi satu per satu (agar bisa jadi tensor)
    const tempImg = document.createElement("img");

    const xsArray = [];
    const ysArray = [];

    // Konversi dataset ke tensor
    for (let i = 0; i < dataset.length; i++) {
      const sample = dataset[i];
      const { label, dataUrl } = sample;

      // Pastikan label 0–100 → skala 0–1
      const yVal = Math.max(0, Math.min(100, Number(label))) / 100.0;

      // Load sinkron-ish: kita bungkus dalam Promise
      /* eslint-disable no-await-in-loop */
      await new Promise((resolve, reject) => {
        tempImg.onload = () => {
          const xTensor = tf.tidy(() => {
            const fromPixels = tf.browser.fromPixels(tempImg);
            const resized = tf.image.resizeBilinear(
              fromPixels,
              [IMAGE_SIZE, IMAGE_SIZE]
            );
            const normalized = resized.div(255.0);
            return normalized;
          });
          xsArray.push(xTensor);
          ysArray.push(yVal);
          resolve();
        };
        tempImg.onerror = reject;
        tempImg.src = dataUrl;
      });
      /* eslint-enable no-await-in-loop */
    }

    const xs = tf.stack(xsArray); // [N, H, W, 3]
    const ys = tf.tensor1d(ysArray);

    xsArray.forEach((t) => t.dispose());

    let model = await loadExistingModel();
    if (!model) {
      model = buildModel();
    }

    await model.fit(xs, ys, {
      epochs,
      batchSize,
      shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          if (onLog) {
            const loss = logs.loss?.toFixed(4);
            const mae = logs.mae?.toFixed(4);
            onLog(
              `Epoch ${epoch + 1}/${epochs} — loss: ${loss}, mae: ${mae}`
            );
          }
          await tf.nextFrame();
        },
      },
    });

    xs.dispose();
    ys.dispose();

    await saveModel(model);
    return model;
  }

  async function predictOnImageElement(model, imgElement) {
    return tf.tidy(() => {
      const tensor = tf.browser.fromPixels(imgElement);
      const resized = tf.image.resizeBilinear(
        tensor,
        [IMAGE_SIZE, IMAGE_SIZE]
      );
      const normalized = resized.div(255.0);
      const batched = normalized.expandDims(0); // [1, H, W, 3]

      const pred = model.predict(batched);
      const value = pred.dataSync()[0]; // dalam skala 0–1
      return value * 100.0;
    });
  }

  return {
    buildModel,
    loadExistingModel,
    saveModel,
    trainOnDataset,
    predictOnImageElement,
  };
})();
