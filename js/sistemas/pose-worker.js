// A análise do corpo roda fora da animação para não travar os quadros do jogo.
let detector = null;

self.onmessage = async function ({ data }) {
  try {
    if (data.tipo === 'iniciar') {
      const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
      const { FilesetResolver, PoseLandmarker } = await import(base + '/vision_bundle.mjs');
      const arquivos = await FilesetResolver.forVisionTasks(base + '/wasm');
      detector = await PoseLandmarker.createFromOptions(arquivos, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
        },
        canvas: new OffscreenCanvas(1, 1),
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false
      });
      self.postMessage({ tipo: 'pronto' });
    } else if (data.tipo === 'detectar') {
      const resultado = detector.detectForVideo(data.imagem, data.agora);
      self.postMessage({ tipo: 'resultado', landmarks: resultado.landmarks });
    }
  } catch (erro) {
    self.postMessage({ tipo: 'erro', mensagem: erro.message });
  } finally {
    data.imagem?.close();
  }
};
