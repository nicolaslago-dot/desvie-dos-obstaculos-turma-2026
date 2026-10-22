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
  const pontos = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  pontos[11] = { x: 0.6, y: 0.4, visibility: 1 };
  pontos[12] = { x: 0.4, y: 0.4, visibility: 1 };
  pontos[15] = { x: 0.6, y: 0.8, visibility: 1 };
  pontos[16] = { x: 0.4, y: 0.8, visibility: 1 };
  if (tipo === 'esquerda' || tipo === 'ambos') Object.assign(pontos[15], { x: 0.85, y: 0.4 });
  if (tipo === 'direita' || tipo === 'ambos') Object.assign(pontos[16], { x: 0.15, y: 0.4 });
  if (tipo === 'pular') { pontos[15].y = 0.1; pontos[16].y = 0.1; }
  return pontos;
}

async function testar() {
  const a = ambiente();
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
  assert.equal(a.jogo.identificarGesto(pose('ambos')), 'aguardar');
  assert.equal(a.jogo.identificarGesto(null), null);
  const baixaConfianca = pose('esquerda');
  baixaConfianca[15].visibility = 0.2;
  assert.equal(a.jogo.identificarGesto(baixaConfianca), null);

  // O esqueleto usa as coordenadas do vídeo e omite pontos sem confiança.
  const corpo = pose();
  corpo[15].visibility = 0.1;
  corpo[16].x = NaN;
  a.jogo.desenharEsqueleto(a.pincel, corpo, 640, 480);
  assert.equal(a.desenho.filter(d => d[0] === 'ponto').length, 31);
  assert.ok(a.desenho.some(d => d[0] === 'inicio' && d[1] === 384 && d[2] === 192));
  assert.ok(a.desenho.some(d => d[0] === 'linha' && d[1] === 256 && d[2] === 192));
  a.desenho.length = 0;
  a.jogo.desenharEsqueleto(a.pincel, null, 640, 480);
  assert.deepEqual(a.desenho, [['limpar', 0, 0, 640, 480]]);

  // Uma pose mantida só dispara uma vez; tremores e perda de leitura não disparam.
  const lerGesto = a.jogo.criarLeitorGestos();
  assert.equal(lerGesto('esquerda', 0, true), null);
  assert.equal(lerGesto('esquerda', 200, true), null); // iniciar com braço estendido
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
  assert.equal(lerGesto('direita', 2600, true), null); // recomeçar pede repouso
  lerGesto(null, 2700, true);
  assert.equal(lerGesto('pular', 3000, true), null);

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
  console.log('Testes de câmera, gestos, pulo e recuperação: OK');
}
testar().catch(erro => { console.error(erro); process.exitCode = 1; });
