window.Jogo.criarDesenho = function (canvas) {
  const pincel = canvas.getContext('2d');
  const imagens = {};
  const imagensVermelhas = {};
  const movimentoReduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let largura;
  let altura;

  const arquivos = [
    'sprites/helperbot/correndo1.png',
    'sprites/helperbot/correndo2.png',
    'sprites/helperbot/carregando_pulo.png',
    'sprites/helperbot/pulando.png',
    ...window.Jogo.tiposObstaculo,
    ...window.Jogo.partesRobo.map(parte => parte.imagem)
  ];
  for (const arquivo of arquivos) {
    imagens[arquivo] = new Image();
    imagens[arquivo].src = arquivo;
  }

  function ajustarTela() {
    largura = canvas.clientWidth;
    altura = canvas.clientHeight;
    const escala = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = largura * escala;
    canvas.height = altura * escala;
    pincel.setTransform(escala, 0, 0, escala, 0, 0);
  }

  function posicao(z, pista) {
    const escala = Math.max(largura / 1670, altura / 942);
    const esquerda = (largura - 1670 * escala) / 2;
    const topo = (altura - 942 * escala) / 2;

    const yNoFundo = 512 + 345 * z * z;
    const metadeRua = Math.max(3, (yNoFundo - 510) * 2.05);
    const larguraPista = Math.min(metadeRua * 2 / 3 * escala, largura * 0.29);

    return {
      x: esquerda + 835 * escala + pista * larguraPista,
      y: topo + yNoFundo * escala,
      larguraPista
    };
  }

  function desenharSprite(arquivo, x, base, tamanho, alturaMaxima = Infinity, alerta = false) {
    const imagem = imagens[arquivo];
    if (imagem?.complete && imagem.naturalWidth) {
      const larguraSprite = Math.min(tamanho, alturaMaxima * imagem.naturalWidth / imagem.naturalHeight);
      const alturaSprite = larguraSprite * imagem.naturalHeight / imagem.naturalWidth;
      let sprite = imagem;
      if (alerta) {
        if (!imagensVermelhas[arquivo]) {
          const mascara = document.createElement('canvas');
          mascara.width = imagem.naturalWidth;
          mascara.height = imagem.naturalHeight;
          const tinta = mascara.getContext('2d');
          tinta.drawImage(imagem, 0, 0);
          tinta.globalCompositeOperation = 'source-in';
          tinta.fillStyle = '#ff324b';
          tinta.fillRect(0, 0, mascara.width, mascara.height);
          imagensVermelhas[arquivo] = mascara;
        }
        sprite = imagensVermelhas[arquivo];
      }
      pincel.drawImage(sprite, x - larguraSprite / 2, base - alturaSprite, larguraSprite, alturaSprite);
    } else {
      pincel.fillStyle = '#3bdcf0';
      pincel.fillRect(x - tamanho / 2, base - tamanho, tamanho, tamanho);
    }
  }

  function desenharPistas(estado) {
    const movimento = (estado.distancia / 35) % 1;
    pincel.strokeStyle = '#75eaff';
    pincel.lineWidth = 2;

    for (const limite of [-0.5, 0.5]) {
      for (let i = 0; i < 14; i++) {
        const inicio = (i + movimento) / 14;
        const fim = inicio + 0.045;
        const a = posicao(inicio, limite);
        const b = posicao(fim, limite);
        pincel.beginPath();
        pincel.moveTo(a.x, a.y);
        pincel.lineTo(b.x, b.y);
        pincel.stroke();
      }
    }
  }

  function desenharObstaculos(estado) {
    const lista = [...estado.obstaculos].sort((a, b) => a.z - b.z);
    for (const obstaculo of lista) {
      const lugar = posicao(obstaculo.z, obstaculo.pista);
      const tamanho = Math.min(145, Math.max(4, lugar.larguraPista * 0.55));
      pincel.globalAlpha = Math.min(1, 0.25 + obstaculo.z * 2.5);
      const perto = obstaculo.z >= Math.max(0.5, 0.965 - estado.velocidade);
      const piscar = movimentoReduzido?.matches || Math.floor(estado.tempo * 4) % 2 === 0;
      desenharSprite(obstaculo.imagem, lugar.x, lugar.y, tamanho, tamanho * 1.25, perto && piscar);
    }
    pincel.globalAlpha = 1;
  }

  function desenharRobo(estado) {
    const lugar = posicao(0.99, estado.pistaVisual);
    const tamanho = Math.min(112, Math.max(70, lugar.larguraPista * 0.45));
    let quadro = Math.floor(estado.tempo * 8) % 2 ? 'correndo1' : 'correndo2';
    if (estado.tempoPulo > 0.8) quadro = 'carregando_pulo';
    else if (estado.tempoPulo > 0 || estado.alturaPulo > 0) quadro = 'pulando';
    const arquivo = 'sprites/helperbot/' + quadro + '.png';
    const alturaSprite = tamanho * (quadro === 'pulando' ? 1.7 : 1.3);
    if (estado.invulneravel > 0) {
      pincel.globalAlpha = movimentoReduzido?.matches ? 0.65 : (Math.floor(estado.tempo * 6) % 2 ? 0.4 : 1);
    }
    desenharSprite(arquivo, lugar.x, lugar.y - 30 - estado.alturaPulo * tamanho * 1.6, alturaSprite, alturaSprite);
    pincel.globalAlpha = 1;
  }

  function desenharPecas(estado) {
    for (const peca of estado.pecas) {
      const parte = window.Jogo.partesRobo.find(parte => parte.id === peca.parte);
      const lugar = posicao(peca.z, peca.pista);
      const tamanho = Math.min(66, Math.max(5, lugar.larguraPista * 0.32));
      const flutuar = movimentoReduzido?.matches ? 0 : Math.sin(estado.tempo * 3) * tamanho * 0.06;
      // A moldura amarela distingue os coletáveis dos obstáculos.
      pincel.strokeStyle = '#ffe76b';
      pincel.lineWidth = 2;
      pincel.beginPath();
      pincel.moveTo(lugar.x, lugar.y - tamanho * 1.5 + flutuar);
      pincel.lineTo(lugar.x + tamanho * 0.65, lugar.y - tamanho * 0.75 + flutuar);
      pincel.lineTo(lugar.x, lugar.y + flutuar);
      pincel.lineTo(lugar.x - tamanho * 0.65, lugar.y - tamanho * 0.75 + flutuar);
      pincel.lineTo(lugar.x, lugar.y - tamanho * 1.5 + flutuar);
      pincel.stroke();
      desenharSprite(parte.imagem, lugar.x, lugar.y - tamanho * 0.25 + flutuar, tamanho, tamanho);
    }
  }

  window.addEventListener('resize', ajustarTela);
  ajustarTela();

  return function desenhar(estado) {
    pincel.clearRect(0, 0, largura, altura);
    desenharPistas(estado);
    desenharObstaculos(estado);
    desenharPecas(estado);
    desenharRobo(estado);
  };
};
