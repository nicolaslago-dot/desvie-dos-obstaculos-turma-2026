const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const dados = new Map();
const armazenamento = {
  getItem: chave => dados.get(chave) ?? null,
  setItem: (chave, valor) => dados.set(chave, String(valor))
};
const contexto = vm.createContext({ window: {}, localStorage: armazenamento });

for (const nome of ['01-estado', '02-movimento', '03-obstaculos', '04-colisoes', '05-pontos', 'sistemas/dificuldade', 'sistemas/coleta']) {
  vm.runInContext(ler('js/' + nome + '.js'), contexto);
}
const jogo = contexto.window.Jogo;

// Movimento e pausa.
const estado = jogo.novoEstado();
jogo.mover(estado, -1);
jogo.mover(estado, -1);
assert.equal(estado.pista, -1);
jogo.mover(estado, 1);
jogo.mover(estado, 1);
jogo.mover(estado, 1);
assert.equal(estado.pista, 1);
estado.pausado = true;
jogo.mover(estado, -1);
assert.equal(estado.pista, 1);
estado.pausado = false;
estado.contagem = 3;
jogo.mover(estado, -1);
jogo.pular(estado);
assert.equal(estado.pista, 1);
assert.equal(estado.tempoPulo, 0);
estado.contagem = 0;

// Cada grupo de obstáculos deixa pelo menos uma pista livre.
for (let i = 0; i < 100; i++) {
  estado.obstaculos = [];
  estado.proximoObstaculo = 0;
  estado.nivel = 5;
  jogo.atualizarObstaculos(estado, 0.016);
  assert.ok(estado.obstaculos.length >= 1 && estado.obstaculos.length <= 2);
  assert.equal(new Set(estado.obstaculos.map(o => o.pista)).size, estado.obstaculos.length);
}

// Mantém a janela de colisão e só remove depois de passar completamente.
estado.proximoObstaculo = 10;
estado.obstaculos = [{ pista: -1, z: 0.99 }, { pista: 1, z: 0.999 }];
jogo.atualizarObstaculos(estado, 0.01);
assert.equal(estado.obstaculos.length, 2);
assert.equal(estado.obstaculos[0].pista, -1);
estado.obstaculos = [{ pista: 0, z: 0.999 }];
jogo.atualizarObstaculos(estado, 0.05);
assert.equal(jogo.bateu(estado), false, 'A pista ainda é a direita.');
estado.pista = 0;
assert.equal(jogo.bateu(estado), true, 'Não atravessa a janela de colisão entre quadros.');
jogo.atualizarObstaculos(estado, 0.3);
assert.equal(estado.obstaculos.length, 0);

// Colisão depende da pista e da distância.
estado.pista = 0;
estado.obstaculos = [{ pista: -1, z: 1 }];
assert.equal(jogo.bateu(estado), false);
estado.obstaculos = [{ pista: 0, z: 1 }];
assert.equal(jogo.bateu(estado), true);

// Pontos, dificuldade e recorde.
const corrida = jogo.novoEstado();
for (let i = 0; i < 900; i++) jogo.atualizarPontos(corrida, 1 / 60);
assert.ok(corrida.nivel > 1 && corrida.velocidade > 0.32);
assert.equal(corrida.pontos, Math.floor(corrida.distancia * 10));
const resultado = jogo.salvarResultado(corrida);
assert.equal(resultado.recorde, Math.floor(corrida.distancia));
assert.equal(resultado.nivel, corrida.nivel);
assert.ok(resultado.partida);
const curta = jogo.novoEstado();
curta.distancia = 10;
assert.equal(jogo.salvarResultado(curta).recorde, resultado.recorde);

// Todos os arquivos usados pelo HTML e pelos sprites devem existir.
for (const pagina of ['index.html', 'jogo.html', 'gameover.html', 'ranking.html']) {
  for (const [, arquivo] of ler(pagina).matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(raiz, arquivo)), arquivo);
  }
}
for (const [pagina, nomes] of [
  ['jogo.html', ['07-controles', '08-jogo', 'sistemas/camera', 'sistemas/audio']],
  ['gameover.html', ['09-resultado']],
  ['ranking.html', ['ranking-pagina', 'sistemas/ranking']]
]) {
  const html = ler(pagina);
  for (const nome of nomes) {
    for (const [, id] of ler('js/' + nome + '.js').matchAll(/getElementById\('([^']+)'\)/g)) {
      assert.ok(html.includes('id="' + id + '"'), id);
    }
  }
}
for (const arquivo of [
  ...jogo.tiposObstaculo,
  'sprites/helperbot/correndo1.png',
  'sprites/helperbot/correndo2.png',
  'sprites/helperbot/carregando_pulo.png',
  'sprites/helperbot/pulando.png',
  ...jogo.partesRobo.map(parte => parte.imagem),
  'sprites/cenarios/fundo_jogo.png'
]) {
  assert.ok(fs.existsSync(path.join(raiz, arquivo)), arquivo);
}
assert.ok(ler('css/game.css').includes('fundo_jogo.png'));
assert.ok(!ler('jogo.html').includes('controles-toque'));

// O obstáculo começa pequeno no horizonte e cresce ao se aproximar.
const desenhos = [];
const vazio = () => {};
const pincel = {
  setTransform: vazio, clearRect: vazio, fillRect: vazio,
  beginPath: vazio, moveTo: vazio, lineTo: vazio, stroke: vazio,
  drawImage: (imagem, x, y, largura) => desenhos.push({ arquivo: imagem.src || imagem.arquivo, vermelho: imagem.vermelho || false, x, y, largura })
};
function criarMascara() {
  const mascara = {};
  mascara.getContext = () => ({
    drawImage(imagem) { mascara.arquivo = imagem.src; },
    fillRect() { mascara.vermelho = true; }
  });
  return mascara;
}
contexto.document = { createElement: criarMascara };
contexto.Image = class {
  constructor() { this.complete = true; this.naturalWidth = 400; this.naturalHeight = 400; }
  set src(valor) { this.caminho = valor; }
  get src() { return this.caminho; }
};
contexto.window.addEventListener = vazio;
contexto.window.devicePixelRatio = 1;
vm.runInContext(ler('js/06-desenho.js'), contexto);
const canvas = { clientWidth: 1280, clientHeight: 720, getContext: () => pincel };
const desenhar = jogo.criarDesenho(canvas);
estado.obstaculos = [
  { pista: -1, z: 0.2, imagem: jogo.tiposObstaculo[0] },
  { pista: -1, z: 0.8, imagem: jogo.tiposObstaculo[1] }
];
desenhar(estado);
const longe = desenhos.find(d => d.arquivo === jogo.tiposObstaculo[0]);
const perto = desenhos.find(d => d.arquivo === jogo.tiposObstaculo[1]);
assert.ok(longe.largura < perto.largura);
assert.ok(Math.abs(longe.x - 640) < Math.abs(perto.x - 640));
assert.equal(longe.vermelho, false);
assert.equal(perto.vermelho, true);
desenhos.length = 0;
estado.tempo = 0.3;
desenhar(estado);
assert.equal(desenhos.find(d => d.arquivo === jogo.tiposObstaculo[1]).vermelho, false);

const roboNoChao = desenhos.find(d => d.arquivo.includes('helperbot/')).y;
desenhos.length = 0;
estado.alturaPulo = 1;
estado.tempoPulo = 0.45;
desenhar(estado);
assert.ok(desenhos.find(d => d.arquivo.endsWith('/pulando.png')).y < roboNoChao);
desenhos.length = 0;
estado.tempoPulo = 0.9;
desenhar(estado);
assert.ok(desenhos.some(d => d.arquivo.endsWith('/carregando_pulo.png')));
estado.tempoPulo = 0;
estado.alturaPulo = 0;
desenhos.length = 0;
desenhar(estado);
assert.ok(desenhos.some(d => /correndo[12]\.png$/.test(d.arquivo)));
desenhos.length = 0;
canvas.clientWidth = 375;
canvas.clientHeight = 800;
const desenharCelular = jogo.criarDesenho(canvas);
estado.obstaculos = [{ pista: -1, z: 0.99, imagem: jogo.tiposObstaculo[0] }];
desenharCelular(estado);
assert.ok(desenhos.find(d => d.arquivo === jogo.tiposObstaculo[0]).x > 0);

// Verifica a ligação entre o jogo, a colisão e a tela final.
const elementos = new Map();
function elemento(id) {
  if (id === 'tela-jogo' || id === 'esqueleto-camera') return canvas;
  if (!elementos.has(id)) {
    elementos.set(id, {
      textContent: '', hidden: false,
      addEventListener: vazio, setAttribute: vazio, appendChild: vazio,
      classList: { add: vazio, toggle: vazio }
    });
  }
  return elementos.get(id);
}
let proximoQuadro;
let fimAgendado;
contexto.document = { getElementById: elemento, querySelector: () => ({ hidden: true }), addEventListener: vazio, createElement: tipo => tipo === 'canvas' ? criarMascara() : { classList: { toggle: vazio } } };
const audiosJogo = [];
contexto.Audio = class {
  constructor(src) { this.src = src; this.reproducoes = 0; audiosJogo.push(this); }
  play() { this.reproducoes++; return Promise.resolve(); }
  pause() {}
};
let horario = 0;
contexto.performance = { now: () => horario };
contexto.requestAnimationFrame = funcao => { proximoQuadro = funcao; };
contexto.setTimeout = funcao => { fimAgendado = funcao; };
contexto.URLSearchParams = URLSearchParams;
contexto.window.location = { href: '' };
vm.runInContext(ler('js/07-controles.js'), contexto);
vm.runInContext(ler('js/sistemas/camera.js'), contexto);
vm.runInContext(ler('js/sistemas/audio.js'), contexto);
vm.runInContext(ler('js/08-jogo.js'), contexto);
function quadro(agora) { horario = agora; proximoQuadro(agora); }
assert.match(ler('jogo.html'), /id="botao-pausa"[^>]*>Pausar<\/button>/);
assert.equal(elemento('numero-contagem').textContent, '3');
assert.equal(elemento('painel-contagem').hidden, false);
quadro(1000);
assert.equal(elemento('numero-contagem').textContent, '2');
quadro(2000);
assert.equal(elemento('numero-contagem').textContent, '1');
assert.equal(vm.runInContext('estado.distancia', contexto), 0);
quadro(3000);
assert.equal(elemento('painel-contagem').hidden, true);
quadro(3016);
assert.ok(Number(elemento('pontos').textContent) > 0);
vm.runInContext('pausar(true)', contexto);
assert.equal(elemento('botao-pausa').textContent, 'Continuar');
assert.equal(elemento('painel-pausa').hidden, false);
vm.runInContext('pausar(false)', contexto);
assert.equal(elemento('botao-pausa').textContent, 'Pausar');
assert.equal(elemento('painel-pausa').hidden, true);
assert.equal(elemento('numero-contagem').textContent, '3');
quadro(4016);
assert.equal(elemento('numero-contagem').textContent, '2');
vm.runInContext('pausar(true)', contexto);
assert.equal(elemento('painel-contagem').hidden, true);
quadro(9016);
assert.equal(vm.runInContext('estado.contagem', contexto), 0);
vm.runInContext('pausar(false)', contexto);
quadro(12016);
assert.equal(elemento('painel-contagem').hidden, true);
quadro(12032);
// Coleta e vida extra atravessam o loop real e atualizam o placar.
for (const parte of jogo.partesRobo) {
  contexto.parteAtual = parte.id;
  vm.runInContext('estado.pecas = [{ parte: parteAtual, pista: estado.pista, z: 0.96 }]', contexto);
  quadro(horario + 16);
}
assert.equal(audiosJogo[4].reproducoes, 6, 'Cada parte coletada toca o efeito de coleta.');
assert.equal(elemento('vidas').textContent, 2);
assert.equal(elemento('total-pecas').textContent, '0/6');
vm.runInContext(
  "estado.obstaculos = [{ pista: estado.pista, z: 0.98, imagem: window.Jogo.tiposObstaculo[0] }]",
  contexto
);
quadro(horario + 16);
assert.equal(elemento('vidas').textContent, 1);
assert.equal(audiosJogo[3].reproducoes, 1, 'A colisão com obstáculo toca o efeito de colisão.');
assert.equal(fimAgendado, undefined, 'A vida extra mantém a corrida em andamento.');
vm.runInContext('estado.invulneravel = 0; estado.obstaculos[0].z = 0.98', contexto);
quadro(horario + 16);
assert.equal(typeof fimAgendado, 'function');
assert.equal(audiosJogo[3].reproducoes, 2, 'A colisão final também toca o efeito de colisão.');
fimAgendado();
assert.ok(contexto.window.location.href.startsWith('gameover.html?'));

const elementosResultado = new Map();
const contextoResultado = vm.createContext({
  window: { location: { search: '?' + contexto.window.location.href.split('?')[1] } },
  document: {
    getElementById(id) {
      if (!elementosResultado.has(id)) elementosResultado.set(id, {
        textContent: '', value: '', children: [],
        addEventListener: vazio, replaceChildren() { this.children = []; },
        appendChild(item) { this.children.push(item); }
      });
      return elementosResultado.get(id);
    }
  },
  localStorage: armazenamento,
  URLSearchParams
});
vm.runInContext(ler('js/09-resultado.js'), contextoResultado);
assert.equal(elementosResultado.get('pontuacao-final').textContent, elemento('pontos').textContent);
assert.equal(elementosResultado.get('nivel-final').textContent, Number(elemento('nivel').textContent));
const linkRanking = elementosResultado.get('link-ranking').href;
assert.ok(linkRanking.startsWith('ranking.html?'));
const dadosRanking = new URLSearchParams(linkRanking.split('?')[1]);
assert.equal(dadosRanking.get('nivel'), String(Number(elemento('nivel').textContent)));
assert.equal(dadosRanking.get('distancia'), String(Math.floor(vm.runInContext('estado.distancia', contexto))));
assert.ok(dadosRanking.get('partida'));
assert.ok(!ler('index.html').includes('ranking-corpo'));
assert.ok(!ler('gameover.html').includes('formulario-ranking'));
assert.ok(!ler('gameover.html').includes('ranking-corpo'));
assert.ok(!ler('gameover.html').includes('Fim de jogo'), 'A tela de resultado não mostra a mensagem de derrota.');

console.log('Testes do jogo: OK');
