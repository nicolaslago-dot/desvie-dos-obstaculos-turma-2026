const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function testar() {
  const audios = [];
  const eventos = {};
  const botao = {
    textContent: 'Ativar som', atributos: {},
    setAttribute(nome, valor) { this.atributos[nome] = valor; },
    addEventListener(nome, fn) { eventos[nome] = fn; }
  };
  class AudioTeste {
    constructor(src) { this.src = src; this.currentTime = 0; this.paused = true; this.reproducoes = 0; audios.push(this); }
    play() { this.paused = false; this.reproducoes++; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const documento = {
    hidden: false, getElementById: () => botao,
    addEventListener(nome, fn) { eventos[nome] = fn; }
  };
  const contexto = vm.createContext({
    Audio: AudioTeste, document: documento,
    window: { Jogo: {}, addEventListener(nome, fn) { eventos[nome] = fn; } }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/11-audio.js'), 'utf8'), contexto);
  const estado = { pausado: false, acabou: false, contagem: 3, tempoPulo: 0 };
  const sons = contexto.window.Jogo.configurarAudio(estado);
  sons.atualizar();
  assert.equal(audios.length, 0, 'Não tenta carregar arquivos antes da ativação.');

  eventos.click();
  const [musica, pulo, foguete, colisao] = audios;
  assert.deepEqual(audios.map(a => a.src), ['midia/musica.mp3', 'midia/pulo.mp3', 'midia/foguete.mp3', 'midia/colisao.mp3']);
  assert.equal(botao.textContent, 'Silenciar');
  assert.equal(botao.atributos['aria-pressed'], 'true');
  assert.ok(audios.every(a => a.paused), 'Aguarda a contagem.');
  estado.contagem = 0;
  sons.atualizar();
  sons.atualizar();
  assert.equal(musica.reproducoes, 1, 'Não reinicia a música a cada quadro.');
  assert.equal(musica.loop, true);

  estado.tempoPulo = 0.9;
  sons.pulo();
  sons.atualizar();
  assert.equal(pulo.reproducoes, 1);
  assert.equal(foguete.reproducoes, 0, 'Espera o robô sair da preparação do salto.');
  estado.tempoPulo = 0.7;
  sons.atualizar();
  sons.atualizar();
  assert.equal(foguete.reproducoes, 1);
  assert.equal(foguete.loop, true);
  estado.tempoPulo = 0;
  sons.atualizar();
  assert.equal(foguete.paused, true);

  estado.pausado = true;
  sons.atualizar();
  sons.pulo();
  assert.equal(musica.paused, true);
  assert.equal(pulo.reproducoes, 1);
  estado.pausado = false;
  sons.atualizar();
  assert.equal(musica.paused, false);
  eventos.click();
  assert.equal(botao.textContent, 'Ativar som');
  assert.ok(audios.every(a => a.paused), 'Silenciar para todos os sons.');
  sons.colisao();
  assert.equal(colisao.reproducoes, 0);

  eventos.click();
  estado.acabou = true;
  sons.colisao();
  sons.atualizar();
  assert.equal(colisao.reproducoes, 1);
  assert.equal(colisao.paused, false, 'O som da colisão continua durante a transição.');
  assert.equal(musica.paused, true);
  eventos.pagehide();
  assert.ok(audios.every(a => a.paused));

  // Arquivo ausente ou reprodução bloqueada não gera rejeição sem tratamento.
  estado.acabou = false;
  let tentativa = 0;
  pulo.play = () => { tentativa++; return Promise.reject(new Error('Arquivo ausente')); };
  eventos.click();
  sons.pulo();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(tentativa, 1);
  console.log('Testes de áudio, pulo, foguete, pausa, colisão e silenciar: OK');
}

testar().catch(erro => { console.error(erro); process.exitCode = 1; });
