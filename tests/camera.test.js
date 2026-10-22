const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ler = arquivo => fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8');

function ambiente() {
  const elementos = new Map();
  const eventos = new Map();
  const quadros = new Map();
  const desenho = [];
  const pincel = {
    clearRect: (...valores) => desenho.push(['limpar', ...valores]),
    beginPath() {}, stroke() {}, fill() {},
    moveTo: (...valores) => desenho.push(['inicio', ...valores]),
    lineTo: (...valores) => desenho.push(['linha', ...valores]),
    arc: (...valores) => desenho.push(['ponto', ...valores])
  };
  let id = 0;
  let tempo = 0;
  const video = {
    currentTime: 0, readyState: 2, hidden: true, srcObject: null, videoWidth: 640, videoHeight: 480,
    play: async () => {}, textContent: ''
  };
  elementos.set('video-camera', video);
  elementos.set('esqueleto-camera', { width: 0, height: 0, getContext: () => pincel });
  function elemento(nome) {
    if (!elementos.has(nome)) elementos.set(nome, {
      textContent: '', atributos: {}, eventos: {},
      setAttribute(chave, valor) { this.atributos[chave] = valor; },
      addEventListener(tipo, fn) { this.eventos[tipo] = fn; }
    });
    return elementos.get(nome);
  }
  const contexto = vm.createContext({
    window: { isSecureContext: true, addEventListener: (tipo, fn) => eventos.set(tipo, fn) },
    document: { hidden: false, getElementById: elemento, addEventListener: (tipo, fn) => eventos.set(tipo, fn) },
    navigator: { mediaDevices: {} },
    performance: { now: () => tempo },
    requestAnimationFrame: fn => { quadros.set(++id, fn); return id; },
    cancelAnimationFrame: chave => quadros.delete(chave)
  });
  for (const nome of ['01-estado', '02-movimento', '04-colisoes', '07-controles', '10-camera']) {
    vm.runInContext(ler('js/' + nome + '.js'), contexto);
  }
  const jogo = contexto.window.Jogo;
  const estado = jogo.novoEstado();
  jogo.configurarCamera(estado, valor => { estado.pausado = valor; });
  const trilha = { paradas: 0, stop() { this.paradas++; }, addEventListener(tipo, fn) { this[tipo] = fn; } };
  const fluxo = { getTracks: () => [trilha], getVideoTracks: () => [trilha] };
  const detector = { fechamentos: 0, close() { this.fechamentos++; }, detectForVideo: () => ({ landmarks: [pose()] }) };
  contexto.navigator.mediaDevices.getUserMedia = async () => fluxo;
  jogo.criarDetectorPose = async () => detector;
  function quadro(agora) {
    tempo = agora;
    video.currentTime += 0.1;
    const [chave, fn] = quadros.entries().next().value;
    quadros.delete(chave);
    fn(agora);
  }
  return { contexto, jogo, estado, elemento, video, trilha, fluxo, detector, quadros, eventos, quadro, desenho, pincel,
    clicar: () => elemento('botao-camera').eventos.click() };
}

// Coordenadas de uma pessoa de frente para uma câmera sem espelhar o vídeo de entrada.
function pose(tipo = 'neutro') {
  const pontos = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  pontos[0] = { x: 0.5, y: 0.15, visibility: 1 };
  pontos[11] = { x: 0.6, y: 0.4, visibility: 1 };
  pontos[12] = { x: 0.4, y: 0.4, visibility: 1 };
  pontos[13] = { x: 0.6, y: 0.58, visibility: 1 };
  pontos[14] = { x: 0.4, y: 0.58, visibility: 1 };
  pontos[15] = { x: 0.6, y: 0.8, visibility: 1 };
  pontos[16] = { x: 0.4, y: 0.8, visibility: 1 };
  if (tipo === 'esquerda' || tipo === 'ambos') Object.assign(pontos[15], { x: 0.85, y: 0.4 });
  if (tipo === 'direita' || tipo === 'ambos') Object.assign(pontos[16], { x: 0.15, y: 0.4 });
  if (tipo === 'pular') { pontos[15].y = 0.1; pontos[16].y = 0.1; }
  return pontos;
}

async function testar() {
  const a = ambiente();
  // O corpo escolhe a pista pela posição dos ombros, mesmo sem as mãos.
  const corpoLateral = a.jogo.criarLeitorCorpo();
  for (const agora of [0, 200, 400]) assert.equal(corpoLateral.ler(pose(), agora).pronto, false);
  assert.equal(corpoLateral.ler(pose(), 600).pronto, true);
  const inclinado = pose().map(p => ({ ...p, x: p.x + 0.09 }));
  inclinado[15].visibility = inclinado[16].visibility = 0;
  for (const agora of [700, 800, 900, 1000]) corpoLateral.ler(inclinado, agora);
  assert.equal(corpoLateral.ler(inclinado, 1100).pista, -1);
  for (const agora of [1200, 1300, 1400, 1500]) corpoLateral.ler(pose(), agora);
  assert.equal(corpoLateral.ler(pose(), 1600).pista, 0, 'Voltar à referência escolhe a pista do meio.');
  const inclinadoD = pose().map(p => ({ ...p, x: p.x - 0.09 }));
  for (const agora of [1700, 1800, 1900, 2000]) corpoLateral.ler(inclinadoD, agora);
  assert.equal(corpoLateral.ler(inclinadoD, 2100).pista, 1);
  assert.equal(corpoLateral.ler(null, 2200).presente, false);
  assert.equal(corpoLateral.ler(null, 2300).pista, null);
  corpoLateral.centralizar();
  for (const agora of [2400, 2600, 2800, 3000]) corpoLateral.ler(inclinadoD, agora);
  assert.equal(corpoLateral.ler(inclinadoD, 3100).pista, 0, 'Centraliza também quando a pessoa começa fora do meio da imagem.');
  for (let agora = 3200; agora <= 4200; agora += 100) {
    const tremor = inclinadoD.map(p => ({ ...p, x: p.x + (agora % 200 ? 0.006 : -0.006) }));
    assert.equal(corpoLateral.ler(tremor, agora).pista, 0, 'Pequenos tremores não trocam a pista.');
  }
  const semReferencia = a.jogo.criarLeitorCorpo();
  semReferencia.ler(pose(), 0);
  assert.equal(semReferencia.ler(pose(), 1000).pronto, false, 'Uma lacuna longa não completa a centralização.');
  semReferencia.ler(null, 1200);
  assert.equal(semReferencia.ler(pose(), 1400).pronto, false);
  a.jogo.configurarControles(a.estado, () => {});
  const tecla = key => a.eventos.get('keydown')({ key, repeat: false, preventDefault() {} });
  tecla('ArrowLeft');
  assert.equal(a.estado.pista, -1);
  tecla('ArrowRight');
  assert.equal(a.estado.pista, 0);
  tecla('ArrowUp');
  assert.equal(a.estado.tempoPulo, 0.9);
  a.jogo.animarMovimento(a.estado, 0.9);
  tecla(' ');
  assert.equal(a.estado.tempoPulo, 0.9);
  a.jogo.animarMovimento(a.estado, 0.9);
  tecla('p');
  tecla('ArrowRight');
  tecla(' ');
  assert.equal(a.estado.pista, 0);
  assert.equal(a.estado.tempoPulo, 0);
  tecla('Escape');
  tecla(' ');
  assert.equal(a.estado.tempoPulo, 0.9);
  a.jogo.animarMovimento(a.estado, 0.9);
  for (const tipo of ['neutro', 'esquerda', 'direita', 'pular']) {
    assert.equal(a.jogo.identificarGesto(pose(tipo)), tipo);
  }
  // Uma mão fora do enquadramento não pode cancelar o outro braço.
  const umBraco = pose('esquerda');
  umBraco[16].visibility = 0.1;
  assert.equal(a.jogo.identificarGesto(umBraco), 'esquerda');
  // O braço pode ficar um pouco abaixo da linha dos ombros.
  const diagonal = pose('direita');
  Object.assign(diagonal[16], { x: 0.24, y: 0.6 });
  assert.equal(a.jogo.identificarGesto(diagonal), 'direita');
  assert.equal(a.jogo.identificarGesto(pose('ambos')), 'aguardar');
  assert.equal(a.jogo.identificarGesto(null), null);
  const baixaConfianca = pose('esquerda');
  for (const i of [13, 14, 15, 16]) baixaConfianca[i].visibility = 0.2;
  assert.equal(a.jogo.identificarGesto(baixaConfianca), null);
  const confiancaModerada = pose('esquerda');
  confiancaModerada[15].visibility = 0.5;
  assert.equal(a.jogo.identificarGesto(confiancaModerada), 'esquerda');
  const semPulso = pose();
  semPulso[15].visibility = 0.1;
  Object.assign(semPulso[13], { x: 0.76, y: 0.46 });
  assert.equal(a.jogo.identificarGesto(semPulso), 'esquerda');
  semPulso[13].visibility = 0.1;
  semPulso[19] = { x: 0.8, y: 0.45, visibility: 0.7 };
  assert.equal(a.jogo.identificarGesto(semPulso), 'esquerda');
  const cotoveloBaixo = pose();
  cotoveloBaixo[15].visibility = 0.1;
  cotoveloBaixo[13].x = 0.7;
  assert.equal(a.jogo.identificarGesto(cotoveloBaixo), 'neutro', 'Um cotovelo baixo em repouso não move o robô.');
  const cruzado = pose();
  Object.assign(cruzado[15], { x: 0.1, y: 0.4 });
  assert.equal(a.jogo.identificarGesto(cruzado), 'aguardar', 'Não interpreta um braço cruzado como o braço oposto.');
  const deslocado = pose('esquerda').map(p => ({ ...p, x: p.x + 0.08 }));
  assert.equal(a.jogo.identificarGesto(deslocado), 'esquerda');
  const trocado = pose('esquerda');
  for (const [e, d] of [[11, 12], [13, 14], [15, 16]]) [trocado[e], trocado[d]] = [trocado[d], trocado[e]];
  assert.equal(a.jogo.identificarGesto(trocado), 'esquerda', 'A direção acompanha a prévia, mesmo se o detector trocar os rótulos.');
  const retrato = pose('pular').map(p => ({ ...p, y: p.y * 0.6 }));
  assert.equal(a.jogo.identificarGesto(retrato, 0.8), 'pular');
  const semOmbro = pose('esquerda');
  semOmbro[11].visibility = 0.1;
  assert.equal(a.jogo.identificarGesto(semOmbro), null);
  const foraDaTela = pose();
  foraDaTela[15].x = 1.2;
  assert.notEqual(a.jogo.identificarGesto(foraDaTela), 'esquerda');

  // O marcador da cabeça continua disponível; a prévia usa o esqueleto completo.
  const corpo = pose();
  a.jogo.desenharCabeca(a.pincel, corpo, 640, 480);
  const cabecas = a.desenho.filter(d => d[0] === 'ponto');
  assert.equal(cabecas.length, 1);
  assert.equal(cabecas[0][1], 320);
  assert.equal(cabecas[0][2], 72);
  assert.ok(!a.desenho.some(d => d[0] === 'inicio' || d[0] === 'linha'));
  a.desenho.length = 0;
  corpo[0].visibility = 0.1;
  a.jogo.desenharCabeca(a.pincel, corpo, 640, 480);
  assert.equal(a.desenho.filter(d => d[0] === 'ponto').length, 0);
  corpo[2] = { x: 0.45, y: 0.1, visibility: 0.8 };
  corpo[5] = { x: 0.55, y: 0.1, visibility: 0.8 };
  a.jogo.desenharCabeca(a.pincel, corpo, 640, 480);
  assert.equal(a.desenho.filter(d => d[0] === 'ponto').length, 1);
  a.desenho.length = 0;
  a.jogo.desenharCabeca(a.pincel, null, 640, 480);
  assert.deepEqual(a.desenho, [['limpar', 0, 0, 640, 480]]);
  const esqueleto = pose();
  for (const [i, x, y] of [[17, .62, .82], [19, .59, .84], [21, .57, .8],
    [18, .38, .82], [20, .41, .84], [22, .43, .8], [23, .58, .65], [24, .42, .65]]) {
    esqueleto[i] = { x, y, visibility: 1 };
  }
  a.desenho.length = 0;
  a.jogo.desenharEsqueleto(a.pincel, esqueleto, 640, 480);
  assert.ok(a.desenho.filter(d => d[0] === 'ponto').length >= 15, 'Desenha cabeça, braços, mãos e quadris.');
  assert.ok(a.desenho.some(d => d[0] === 'linha' && d[1] === 371.2 && d[2] === 312), 'Liga o ombro ao quadril.');
  assert.ok(a.desenho.some(d => d[0] === 'linha' && d[1] === .62 * 640 && d[2] === .82 * 480), 'Liga o pulso aos pontos da mão.');
  esqueleto[17].visibility = 0.1;
  a.desenho.length = 0;
  a.jogo.desenharEsqueleto(a.pincel, esqueleto, 640, 480);
  assert.ok(!a.desenho.some(d => d[0] === 'ponto' && d[1] === .62 * 640 && d[2] === .82 * 480));

  // Uma pose mantida só dispara uma vez; tremores e perda de leitura não disparam.
  const lerGesto = a.jogo.criarLeitorGestos();
  assert.equal(lerGesto('esquerda', 0, true), null);
  assert.equal(lerGesto('esquerda', 200, true), 'esquerda'); // primeiro gesto já pode mover
  lerGesto('neutro', 300, true);
  lerGesto('neutro', 500, true);
  assert.equal(lerGesto('esquerda', 600, true), null);
  assert.equal(lerGesto('esquerda', 750, true), 'esquerda');
  assert.equal(lerGesto('esquerda', 1500, true), null);
  lerGesto('neutro', 1600, true);
  lerGesto('neutro', 1800, true);
  lerGesto('direita', 1900, true);
  assert.equal(lerGesto('neutro', 1950, true), null); // gesto curto não move
  lerGesto('neutro', 2150, true);
  lerGesto('direita', 2200, false);
  assert.equal(lerGesto('direita', 2400, true), null);
  assert.equal(lerGesto('direita', 2600, true), 'direita');
  lerGesto(null, 2700, true);
  assert.equal(lerGesto('pular', 3000, true), null);
  // Trocar de lado é um novo gesto, sem repetir uma pose mantida.
  const alternar = a.jogo.criarLeitorGestos();
  alternar('esquerda', 0, true);
  assert.equal(alternar('esquerda', 150, true), 'esquerda');
  assert.equal(alternar('esquerda', 250, true), null);
  alternar('direita', 300, true);
  assert.equal(alternar('direita', 450, true), 'direita');
  assert.equal(alternar('direita', 550, true), null);
  alternar('neutro', 600, true);
  alternar('neutro', 750, true);
  alternar(null, 800, true);
  alternar('direita', 850, true);
  assert.equal(alternar('direita', 1000, true), 'direita', 'Uma falha curta não exige baixar os braços outra vez.');
  alternar(null, 1400, true);
  alternar('esquerda', 1450, true);
  assert.equal(alternar('esquerda', 1600, true), 'esquerda', 'Quando as mãos reaparecem, um gesto estável volta a funcionar.');

  // O pulo sobe, evita colisão no alto, desce e respeita pausa e fim de jogo.
  const corrida = a.jogo.novoEstado();
  corrida.obstaculos = [{ pista: 0, z: 0.98 }];
  assert.equal(a.jogo.bateu(corrida), true);
  a.jogo.pular(corrida);
  a.jogo.animarMovimento(corrida, 0.45);
  assert.ok(corrida.alturaPulo > 0.99);
  assert.equal(a.jogo.bateu(corrida), false);
  a.jogo.pular(corrida);
  assert.equal(corrida.tempoPulo, 0.45);
  a.jogo.animarMovimento(corrida, 0.45);
  assert.equal(corrida.alturaPulo, 0);
  assert.equal(a.jogo.bateu(corrida), true);
  corrida.pausado = true;
  a.jogo.pular(corrida);
  assert.equal(corrida.tempoPulo, 0);
  corrida.pausado = false;
  corrida.acabou = true;
  a.jogo.pular(corrida);
  assert.equal(corrida.tempoPulo, 0);

  // Captura e detector ficam nas bordas; os comandos usam as funções reais do jogo.
  await a.clicar();
  assert.equal(a.estado.pausado, true);
  assert.equal(a.video.hidden, false);
  assert.equal(a.elemento('previa-camera').hidden, false);
  assert.equal(a.elemento('botao-centralizar').hidden, false);
  a.estado.pausado = false;
  a.quadro(100); a.quadro(300);
  assert.equal(a.elemento('esqueleto-camera').width, 640);
  assert.equal(a.elemento('esqueleto-camera').height, 480);
  assert.ok(a.desenho.some(d => d[0] === 'ponto'));
  a.detector.detectForVideo = () => ({ landmarks: [pose('esquerda')] });
  a.quadro(400); a.quadro(600);
  assert.equal(a.estado.pista, -1);
  a.quadro(800);
  assert.equal(a.estado.pista, -1);
  a.detector.detectForVideo = () => ({ landmarks: [pose()] });
  a.quadro(900); a.quadro(1100);
  a.detector.detectForVideo = () => ({ landmarks: [pose('direita')] });
  a.quadro(1200); a.quadro(1400);
  assert.equal(a.estado.pista, 0);
  a.detector.detectForVideo = () => ({ landmarks: [pose()] });
  a.quadro(1500); a.quadro(1700);
  a.detector.detectForVideo = () => ({ landmarks: [pose('pular')] });
  a.quadro(1800); a.quadro(2000);
  assert.equal(a.estado.tempoPulo, 0.9);
  a.detector.detectForVideo = () => ({ landmarks: [] });
  a.desenho.length = 0;
  a.quadro(3100);
  assert.deepEqual(a.desenho, [['limpar', 0, 0, 640, 480]]);
  assert.equal(a.estado.pausado, true);
  assert.match(a.elemento('status-camera').textContent, /Sem leitura/);
  await a.clicar();
  assert.equal(a.trilha.paradas, 1);
  assert.equal(a.detector.fechamentos, 1);
  assert.equal(a.video.srcObject, null);
  assert.equal(a.elemento('previa-camera').hidden, true);
  assert.equal(a.elemento('botao-centralizar').hidden, true);
  assert.equal(a.quadros.size, 0);

  // Permissão negada e falha de carregamento permitem tentar novamente.
  const b = ambiente();
  b.contexto.navigator.mediaDevices.getUserMedia = async () => { throw { name: 'NotAllowedError' }; };
  await b.clicar();
  assert.match(b.elemento('status-camera').textContent, /bloqueada/);
  assert.equal(b.elemento('botao-camera').atributos['aria-pressed'], 'false');
  b.contexto.navigator.mediaDevices.getUserMedia = async () => b.fluxo;
  b.jogo.criarDetectorPose = async () => { throw new Error('offline'); };
  await b.clicar();
  assert.equal(b.trilha.paradas, 1);
  assert.match(b.elemento('status-camera').textContent, /internet/);

  // Cancelar enquanto a permissão está pendente não deixa a câmera aberta.
  const c = ambiente();
  let permitir;
  c.contexto.navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { permitir = resolve; });
  const inicio = c.clicar();
  await c.clicar();
  permitir(c.fluxo);
  await inicio;
  assert.equal(c.trilha.paradas, 1);
  assert.equal(c.video.srcObject, null);
  assert.equal(c.quadros.size, 0);

  const d = ambiente();
  let carregar;
  d.jogo.criarDetectorPose = () => new Promise(resolve => { carregar = resolve; });
  const carregamento = d.clicar();
  await new Promise(resolve => setImmediate(resolve));
  await d.clicar();
  carregar(d.detector);
  await carregamento;
  assert.equal(d.trilha.paradas, 1);
  assert.equal(d.detector.fechamentos, 1);
  assert.equal(d.quadros.size, 0);

  const e = ambiente();
  await e.clicar();
  e.trilha.ended();
  assert.equal(e.estado.pausado, true);
  assert.equal(e.quadros.size, 0);
  assert.match(e.elemento('status-camera').textContent, /desconectada/);

  const f = ambiente();
  await f.clicar();
  f.eventos.get('pagehide')();
  assert.equal(f.trilha.paradas, 1);
  assert.equal(f.detector.fechamentos, 1);

  const g = ambiente();
  g.contexto.window.isSecureContext = false;
  await g.clicar();
  assert.equal(g.video.srcObject, null);
  assert.match(g.elemento('status-camera').textContent, /localhost ou HTTPS/);

  // Controle do corpo atravessa o detector, a centralização e os movimentos reais.
  const h = ambiente();
  await h.clicar();
  for (const agora of [0, 200, 400, 600]) h.quadro(agora);
  h.estado.pausado = false;
  h.detector.detectForVideo = () => ({ landmarks: [inclinado] });
  for (const agora of [700, 800, 900, 1000, 1100]) h.quadro(agora);
  assert.equal(h.estado.pista, -1);
  assert.match(h.elemento('status-camera').textContent, /Corpo: ESQUERDA/);
  h.quadro(2100);
  assert.equal(h.estado.pausado, false, 'O corpo continua sendo lido com as mãos ocultas.');
  h.estado.pausado = true;
  h.detector.detectForVideo = () => ({ landmarks: [inclinadoD] });
  for (const agora of [2200, 2300, 2400, 2500, 2600]) h.quadro(agora);
  assert.equal(h.estado.pista, -1, 'Não muda a pista durante a pausa.');
  h.estado.pausado = false;
  h.quadro(2700);
  assert.equal(h.estado.pista, 1, 'Ao continuar, sincroniza com a posição atual do corpo.');
  h.elemento('botao-centralizar').eventos.click();
  assert.equal(h.estado.pausado, true);
  for (const agora of [2800, 3000, 3200, 3400]) h.quadro(agora);
  h.estado.pausado = false;
  h.quadro(3500);
  assert.equal(h.estado.pista, 0, 'O botão redefine a posição atual como centro.');
  h.jogo.desligarCamera();
  console.log('Testes de câmera, gestos, pulo e recuperação: OK');
}
testar().catch(erro => { console.error(erro); process.exitCode = 1; });
