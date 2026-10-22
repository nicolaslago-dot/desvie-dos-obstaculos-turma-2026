window.Jogo.identificarGesto = function (pontos) {
  const indices = [11, 12, 15, 16];
  if (!pontos || !indices.every(i => {
    const p = pontos[i];
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.visibility >= 0.6;
  })) return null;

  const [ombroE, ombroD, pulsoE, pulsoD] = indices.map(i => pontos[i]);
  const largura = Math.abs(ombroE.x - ombroD.x);
  if (largura < 0.08) return null;
  const topo = Math.min(ombroE.y, ombroD.y);
  if (pulsoE.y < topo - largura * 0.6 && pulsoD.y < topo - largura * 0.6) return 'pular';

  const pulsos = [pulsoE, pulsoD];
  const lateral = p => Math.abs(p.y - (ombroE.y + ombroD.y) / 2) < largura * 0.65;
  const esquerda = pulsos.some(p => lateral(p) && p.x > Math.max(ombroE.x, ombroD.x) + largura * 0.65);
  const direita = pulsos.some(p => lateral(p) && p.x < Math.min(ombroE.x, ombroD.x) - largura * 0.65);
  if (esquerda && !direita) return 'esquerda';
  if (direita && !esquerda) return 'direita';
  if (pulsos.every(p => p.y > Math.max(ombroE.y, ombroD.y) + largura * 0.5)) return 'neutro';
  return 'aguardar';
};

window.Jogo.criarLeitorGestos = function () {
  let anterior = null;
  let desde = 0;
  let armado = false;
  return function (gesto, agora, habilitado) {
    if (!habilitado || gesto === null) {
      anterior = null;
      armado = false;
      return null;
    }
    if (gesto !== anterior) {
      anterior = gesto;
      desde = agora;
    }
    if (gesto === 'neutro' && agora - desde >= 180) armado = true;
    if (armado && ['esquerda', 'direita', 'pular'].includes(gesto) && agora - desde >= 140) {
      armado = false;
      return gesto;
    }
    return null;
  };
};

window.Jogo.criarDetectorPose = async function () {
  const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
  const { FilesetResolver, PoseLandmarker } = await import(base + '/vision_bundle.mjs');
  const arquivos = await FilesetResolver.forVisionTasks(base + '/wasm');
  return PoseLandmarker.createFromOptions(arquivos, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.6,
    minPosePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6
  });
};

window.Jogo.desenharEsqueleto = function (pincel, pontos, largura, altura) {
  pincel.clearRect(0, 0, largura, altura);
  if (!pontos) return;
  const conexoes = [
    [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
    [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
    [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]
  ];
  const visivel = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.visibility >= 0.5 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  pincel.strokeStyle = '#00ffd0';
  pincel.lineWidth = Math.max(4, largura / 100);
  pincel.lineCap = 'round';
  pincel.beginPath();
  for (const [a, b] of conexoes) {
    if (!visivel(pontos[a]) || !visivel(pontos[b])) continue;
    pincel.moveTo(pontos[a].x * largura, pontos[a].y * altura);
    pincel.lineTo(pontos[b].x * largura, pontos[b].y * altura);
  }
  pincel.stroke();
  for (const ponto of pontos) {
    if (!visivel(ponto)) continue;
    pincel.beginPath();
    pincel.arc(ponto.x * largura, ponto.y * altura, Math.max(5, largura / 80), 0, Math.PI * 2);
    pincel.fillStyle = '#ffffff';
    pincel.fill();
  }
};

window.Jogo.configurarCamera = function (estado, pausar) {
  const botao = document.getElementById('botao-camera');
  const video = document.getElementById('video-camera');
  const status = document.getElementById('status-camera');
  const previa = document.getElementById('previa-camera');
  const esqueleto = document.getElementById('esqueleto-camera');
  const pincel = esqueleto.getContext('2d');
  let fluxo = null;
  let detector = null;
  let quadro = null;
  let sessao = 0;
  let ligado = false;

  function avisar(texto) {
    if (status.textContent !== texto) status.textContent = texto;
  }

  function desligar(mensagem = 'Câmera desligada. Use as setas ou ative novamente.') {
    sessao++;
    ligado = false;
    if (quadro !== null) cancelAnimationFrame(quadro);
    quadro = null;
    if (fluxo) fluxo.getTracks().forEach(trilha => trilha.stop());
    fluxo = null;
    if (detector) detector.close();
    detector = null;
    video.srcObject = null;
    video.hidden = true;
    previa.hidden = true;
    window.Jogo.desenharEsqueleto(pincel, null, esqueleto.width, esqueleto.height);
    botao.textContent = 'Ativar câmera';
    botao.setAttribute('aria-pressed', 'false');
    avisar(mensagem);
  }
  window.Jogo.desligarCamera = desligar;

  botao.addEventListener('click', async () => {
    if (ligado) {
      pausar(true);
      desligar();
      return;
    }
    if (estado.acabou) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      avisar('Para usar a câmera, abra o jogo em localhost ou HTTPS num navegador compatível.');
      return;
    }
    pausar(true);
    ligado = true;
    const atual = ++sessao;
    botao.textContent = 'Cancelar câmera';
    botao.setAttribute('aria-pressed', 'true');
    avisar('Autorize a câmera. A corrida está pausada.');
    try {
      const novoFluxo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      if (atual !== sessao) {
        novoFluxo.getTracks().forEach(trilha => trilha.stop());
        return;
      }
      fluxo = novoFluxo;
      for (const trilha of fluxo.getVideoTracks()) {
        trilha.addEventListener('ended', () => {
          if (atual !== sessao) return;
          pausar(true);
          desligar('A câmera foi desconectada. Conecte e ative novamente.');
        });
      }
      video.srcObject = fluxo;
      video.hidden = false;
      previa.hidden = false;
      await video.play();
      if (atual !== sessao) return;
      avisar('Preparando os controles. Aguarde o carregamento.');
      const novoDetector = await window.Jogo.criarDetectorPose();
      if (atual !== sessao) {
        novoDetector.close();
        return;
      }
      detector = novoDetector;
      botao.textContent = 'Desligar câmera';
      const lerGesto = window.Jogo.criarLeitorGestos();
      let ultimaLeitura = -Infinity;
      let ultimoVideo = -1;
      let ultimaPresenca = performance.now();
      function observar(agora) {
        if (atual !== sessao) return;
        if (estado.acabou) { desligar(); return; }
        try {
          if (!document.hidden && video.readyState >= 2 && video.currentTime !== ultimoVideo && agora - ultimaLeitura >= 66) {
            ultimaLeitura = agora;
            ultimoVideo = video.currentTime;
            const resultado = detector.detectForVideo(video, agora);
            if (esqueleto.width !== video.videoWidth || esqueleto.height !== video.videoHeight) {
              esqueleto.width = video.videoWidth;
              esqueleto.height = video.videoHeight;
            }
            const pontos = resultado.landmarks[0];
            window.Jogo.desenharEsqueleto(pincel, pontos, esqueleto.width, esqueleto.height);
            const gesto = window.Jogo.identificarGesto(pontos);
            if (gesto !== null) ultimaPresenca = agora;
            const comando = lerGesto(gesto, agora, !estado.pausado && !estado.acabou && !estado.contagem);
            if (comando === 'pular') window.Jogo.pular(estado);
            if (comando === 'esquerda') window.Jogo.mover(estado, -1);
            if (comando === 'direita') window.Jogo.mover(estado, 1);
            if (gesto === null) avisar('Afaste-se até os ombros e as duas mãos aparecerem na câmera.');
            else if (estado.pausado) avisar('Câmera pronta! Clique em CONTINUAR e abaixe os braços para começar.');
            else if (estado.contagem > 0) avisar('Prepare-se! Abaixe os braços durante a contagem.');
            else avisar('Controle ativo. Abaixe os braços entre movimentos.');
          }
          if (agora - ultimaPresenca > 1000) {
            pausar(true);
            lerGesto(null, agora, false);
            avisar('Sem leitura dos braços. Mostre ombros e mãos e clique em CONTINUAR.');
          }
          quadro = requestAnimationFrame(observar);
        } catch (erro) {
          pausar(true);
          desligar('Não foi possível ler os movimentos. Ative a câmera para tentar novamente.');
        }
      }
      quadro = requestAnimationFrame(observar);
    } catch (erro) {
      if (atual !== sessao) return;
      const mensagens = {
        NotAllowedError: 'Câmera bloqueada. Permita o acesso nas configurações do navegador e tente novamente.',
        NotFoundError: 'Nenhuma câmera encontrada. Conecte uma câmera e tente novamente.',
        NotReadableError: 'A câmera está ocupada. Feche outros aplicativos que a estejam usando.'
      };
      desligar(mensagens[erro.name] || 'Não foi possível iniciar a câmera. Confira a internet e tente novamente.');
    }
  });
  window.addEventListener('pagehide', () => desligar());
};
