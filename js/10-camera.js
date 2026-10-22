// Compara cada braço com seu próprio ombro, nas coordenadas da prévia espelhada.
window.Jogo.identificarGesto = function (pontos, proporcao = 4 / 3) {
  if (!pontos) return null;
  if (!Number.isFinite(proporcao) || proporcao <= 0) proporcao = 4 / 3;
  function lerPonto(indice) {
    const p = pontos[indice];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.visibility < 0.45 ||
      !Number.isFinite(p.visibility) || (p.presence ?? 1) < 0.45 ||
      p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return null;
    // Corrige também a diferença entre a largura e a altura do vídeo.
    return { x: 1 - p.x, y: p.y / proporcao };
  }
  function lerBraco(ombro, cotovelo, pulso, dedos) {
    let mao = lerPonto(pulso);
    if (!mao) {
      const visiveis = dedos.map(lerPonto).filter(Boolean);
      if (visiveis.length) mao = {
        x: visiveis.reduce((soma, p) => soma + p.x, 0) / visiveis.length,
        y: visiveis.reduce((soma, p) => soma + p.y, 0) / visiveis.length
      };
    }
    return { ombro: lerPonto(ombro), cotovelo: lerPonto(cotovelo), mao };
  }
  const bracos = [
    lerBraco(11, 13, 15, [17, 19, 21]),
    lerBraco(12, 14, 16, [18, 20, 22])
  ];
  if (bracos.some(b => !b.ombro)) return null;
  bracos.sort((a, b) => a.ombro.x - b.ombro.x);
  const [bracoE, bracoD] = bracos;
  const largura = bracoD.ombro.x - bracoE.ombro.x;
  if (largura < 0.06) return null;
  const topo = Math.min(bracoE.ombro.y, bracoD.ombro.y);
  // Pular continua exigindo as duas mãos; um cotovelo sozinho não inicia um salto.
  if (bracos.every(b => b.mao && b.mao.y < topo - largura * 0.6)) return 'pular';

  function lateral(braco, direcao) {
    const ponto = braco.mao || braco.cotovelo;
    if (!ponto) return false;
    const alcance = braco.mao ? 0.35 : 0.45;
    const alturaMaxima = braco.mao ? 1 : 0.6;
    return (ponto.x - braco.ombro.x) * direcao > largura * alcance &&
      ponto.y < braco.ombro.y + largura * alturaMaxima;
  }
  const esquerda = lateral(bracoE, -1);
  const direita = lateral(bracoD, 1);
  if (esquerda && !direita) return 'esquerda';
  if (direita && !esquerda) return 'direita';
  if (esquerda && direita) return 'aguardar';
  const visiveis = bracos.filter(b => b.mao || b.cotovelo);
  if (!visiveis.length) return null;
  if (visiveis.every(b => {
    const ponto = b.mao || b.cotovelo;
    return ponto.y > b.ombro.y + largura * 0.35 && Math.abs(ponto.x - b.ombro.x) < largura * 0.55;
  })) return 'neutro';
  return 'aguardar';
};

window.Jogo.criarLeitorGestos = function () {
  let anterior = null;
  let desde = 0;
  let armado = true;
  let ultimoValido = null;
  let ultimoComando = null;
  return function (gesto, agora, habilitado) {
    if (!habilitado) {
      anterior = null;
      armado = true;
      ultimoValido = ultimoComando = null;
      return null;
    }
    // Uma falha curta da câmera não apaga a preparação do gesto.
    if (ultimoValido !== null && agora - ultimoValido > 300) {
      anterior = null;
      armado = true;
      ultimoComando = null;
    }
    if (gesto === null) {
      anterior = null;
      return null;
    }
    ultimoValido = agora;
    if (gesto !== anterior) {
      anterior = gesto;
      desde = agora;
    }
    if (gesto === 'neutro' && agora - desde >= 140) {
      armado = true;
      ultimoComando = null;
    }
    const novoComando = armado || (ultimoComando !== null && gesto !== ultimoComando);
    if (novoComando && ['esquerda', 'direita', 'pular'].includes(gesto) && agora - desde >= 140) {
      armado = false;
      ultimoComando = gesto;
      return gesto;
    }
    return null;
  };
};

// A posição central é aprendida uma vez; voltar para ela devolve o robô ao meio.
window.Jogo.criarLeitorCorpo = function () {
  let referencia = null;
  let preparacao = null;
  let centroFiltrado = null;
  let ultimoQuadro = null;
  let pista = 0;
  let candidata = 0;
  let desde = 0;

  function centralizar() {
    referencia = preparacao = centroFiltrado = ultimoQuadro = null;
    pista = candidata = 0;
    desde = 0;
  }

  function ler(pontos, agora) {
    const ombros = [pontos?.[11], pontos?.[12]];
    const presentes = ombros.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.visibility >= 0.45 && (p.presence ?? 1) >= 0.45 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
    const largura = presentes ? Math.abs(ombros[0].x - ombros[1].x) : 0;
    if (!presentes || largura < 0.06) {
      preparacao = null;
      ultimoQuadro = null;
      candidata = pista;
      desde = agora;
      return { presente: false, pronto: referencia !== null, pista: null };
    }
    const centro = 1 - (ombros[0].x + ombros[1].x) / 2;
    if (!referencia) {
      if (!preparacao || ultimoQuadro === null || agora - ultimoQuadro > 300 ||
        Math.abs(centro - preparacao.centro) > largura * 0.15) {
        preparacao = { centro, largura, desde: agora };
      } else {
        preparacao.centro = preparacao.centro * 0.75 + centro * 0.25;
        preparacao.largura = preparacao.largura * 0.75 + largura * 0.25;
      }
      ultimoQuadro = agora;
      if (agora - preparacao.desde < 600) return { presente: true, pronto: false, pista: 0 };
      referencia = { centro: preparacao.centro, largura: preparacao.largura };
      centroFiltrado = centro;
    }
    const decorrido = ultimoQuadro === null ? 0 : Math.max(0, agora - ultimoQuadro);
    if (ultimoQuadro === null) centroFiltrado = centro;
    else centroFiltrado += (centro - centroFiltrado) * (1 - Math.exp(-decorrido / 100));
    ultimoQuadro = agora;
    const deslocamento = (centroFiltrado - referencia.centro) / Math.max(referencia.largura, largura * 0.7);
    // A margem de retorno é menor para não oscilar entre pistas perto do limite.
    let alvo = pista;
    if (deslocamento < -0.24) alvo = -1;
    else if (deslocamento > 0.24) alvo = 1;
    else if (Math.abs(deslocamento) < 0.12) alvo = 0;
    if (alvo !== candidata) {
      candidata = alvo;
      desde = agora;
    }
    if (agora - desde >= 120) pista = candidata;
    return { presente: true, pronto: true, pista };
  }
  return { ler, centralizar };
};

window.Jogo.criarDetectorPose = async function () {
  const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
  const { FilesetResolver, PoseLandmarker } = await import(base + '/vision_bundle.mjs');
  const arquivos = await FilesetResolver.forVisionTasks(base + '/wasm');
  return PoseLandmarker.createFromOptions(arquivos, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
};

window.Jogo.desenharCabeca = function (pincel, pontos, largura, altura) {
  pincel.clearRect(0, 0, largura, altura);
  if (!pontos) return;
  const visivel = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.visibility >= 0.45 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  const rosto = [0, 2, 5, 7, 8].map(i => pontos[i]).filter(visivel);
  if (!rosto.length) return;
  const cabeca = visivel(pontos[0]) ? pontos[0] : {
    x: rosto.reduce((soma, p) => soma + p.x, 0) / rosto.length,
    y: rosto.reduce((soma, p) => soma + p.y, 0) / rosto.length
  };
  pincel.fillStyle = '#00ffd0';
  pincel.strokeStyle = '#080d18';
  pincel.lineWidth = Math.max(2, largura / 160);
  pincel.beginPath();
  pincel.arc(cabeca.x * largura, cabeca.y * altura, Math.max(8, largura / 65), 0, Math.PI * 2);
  pincel.fill();
  pincel.stroke();
};

window.Jogo.desenharEsqueleto = function (pincel, pontos, largura, altura) {
  window.Jogo.desenharCabeca(pincel, pontos, largura, altura);
  if (!pontos) return;
  const visivel = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.visibility >= 0.45 && (p.presence ?? 1) >= 0.45 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  const conexoes = [
    [11, 12], [11, 23], [12, 24], [23, 24],
    [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
    [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]
  ];
  pincel.lineWidth = Math.max(3, largura / 120);
  pincel.lineCap = 'round';
  for (const [a, b] of conexoes) {
    if (!visivel(pontos[a]) || !visivel(pontos[b])) continue;
    pincel.strokeStyle = a % 2 ? '#00ffd0' : '#ffd166';
    pincel.beginPath();
    pincel.moveTo(pontos[a].x * largura, pontos[a].y * altura);
    pincel.lineTo(pontos[b].x * largura, pontos[b].y * altura);
    pincel.stroke();
  }
  for (let i = 11; i < pontos.length; i++) {
    if (!visivel(pontos[i])) continue;
    pincel.fillStyle = i >= 15 && i <= 22 ? '#ffd166' : '#ffffff';
    pincel.beginPath();
    pincel.arc(pontos[i].x * largura, pontos[i].y * altura, Math.max(4, largura / 100), 0, Math.PI * 2);
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
  const botaoCentralizar = document.getElementById('botao-centralizar');
  const leitorCorpo = window.Jogo.criarLeitorCorpo();
  let ultimaPistaCorpo = 0;
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
    botaoCentralizar.hidden = true;
    leitorCorpo.centralizar();
    ultimaPistaCorpo = 0;
    botao.textContent = 'Ativar câmera';
    botao.setAttribute('aria-pressed', 'false');
    avisar(mensagem);
  }
  window.Jogo.desligarCamera = desligar;

  botaoCentralizar.addEventListener('click', () => {
    if (!detector || estado.acabou) return;
    pausar(true);
    leitorCorpo.centralizar();
    ultimaPistaCorpo = null;
    avisar('Fique parado por um instante para centralizar o corpo.');
  });

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
      botaoCentralizar.hidden = false;
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
            const corpo = leitorCorpo.ler(pontos, agora);
            const gesto = window.Jogo.identificarGesto(pontos, video.videoWidth / video.videoHeight);
            if (corpo.presente) ultimaPresenca = agora;
            const habilitado = !estado.pausado && !estado.acabou && !estado.contagem;
            const comando = lerGesto(gesto, agora, habilitado);
            if (habilitado && corpo.presente && corpo.pronto && corpo.pista !== ultimaPistaCorpo) {
              window.Jogo.mover(estado, corpo.pista - estado.pista);
              ultimaPistaCorpo = corpo.pista;
            }
            if (comando === 'pular') window.Jogo.pular(estado);
            if ((!corpo.pronto || corpo.pista === 0) && corpo.presente) {
              if (comando === 'esquerda') window.Jogo.mover(estado, -1);
              if (comando === 'direita') window.Jogo.mover(estado, 1);
            }
            if (!corpo.presente) avisar('Mostre os ombros e o tronco na câmera.');
            else if (!corpo.pronto) avisar('Fique parado por um instante para centralizar o corpo.');
            else if (estado.pausado) avisar('Câmera pronta! Clique em CONTINUAR. Incline o tronco para mudar de pista.');
            else if (estado.contagem > 0) avisar('Prepare-se! Abaixe os braços durante a contagem.');
            else if (corpo.pista === -1) avisar('Corpo: ESQUERDA. Volte ao centro para a pista do meio.');
            else if (corpo.pista === 1) avisar('Corpo: DIREITA. Volte ao centro para a pista do meio.');
            else if (gesto === 'esquerda') avisar('Gesto: ESQUERDA. Abaixe o braço para repetir.');
            else if (gesto === 'direita') avisar('Gesto: DIREITA. Abaixe o braço para repetir.');
            else if (gesto === 'pular') avisar('Gesto: PULAR. Abaixe os braços para repetir.');
            else avisar('Centro. Incline o corpo, estenda um braço ou levante as duas mãos para pular.');
          }
          if (agora - ultimaPresenca > 1000) {
            pausar(true);
            lerGesto(null, agora, false);
            avisar('Sem leitura do corpo. Mostre os ombros e o tronco e clique em CONTINUAR.');
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
