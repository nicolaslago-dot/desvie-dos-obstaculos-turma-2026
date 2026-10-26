const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const codigo = fs.readFileSync(path.join(__dirname, '../js/sistemas/audio.js'), 'utf8');
const esperar = () => new Promise(resolve => setImmediate(resolve));

function ambiente(bloqueado = false) {
  const audios = [];
  const eventos = {};
  const botao = {
    textContent: '', atributos: {},
    setAttribute(nome, valor) { this.atributos[nome] = valor; },
    addEventListener(nome, fn) { eventos[nome] = fn; }
  };
  class AudioTeste {
    constructor(src) { this.src = src; this.currentTime = 0; this.paused = true; this.reproducoes = 0; audios.push(this); }
    play() {
      this.reproducoes++;
      if (bloqueado) return Promise.reject(Object.assign(new Error('Aguarda interação'), {name: 'NotAllowedError'}));
      this.paused = false;
      return Promise.resolve();
    }
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
  vm.runInContext(codigo, contexto);
  const estado = { pausado: false, acabou: false, contagem: 3, tempoPulo: 0 };
  const sons = contexto.window.Jogo.configurarAudio(estado);
  return {audios, eventos, botao, documento, estado, sons, liberar() { bloqueado = false; }};
}

async function testar() {
  const a = ambiente();
  const {audios, eventos, botao, documento, estado, sons} = a;
  const [musica, pulo, foguete, colisao] = audios;
  assert.equal(audios.length, 4, 'Carrega os sons ao entrar, sem botão de ativação.');
  assert.equal(musica.reproducoes, 1, 'Tenta música automaticamente já na contagem.');
  assert.equal(botao.textContent, 'Silenciar');
  assert.equal(botao.atributos['aria-pressed'], 'true');
  for (const audio of audios) assert.ok(fs.existsSync(path.join(__dirname, '..', audio.src)), audio.src);
  sons.atualizar();
  estado.contagem = 0;
  sons.atualizar();
  assert.equal(musica.reproducoes, 1, 'Não reinicia nem repete tentativas a cada quadro.');
  assert.equal(musica.loop, true);
  estado.tempoPulo = 0.9;
  sons.pulo();
  sons.atualizar();
  assert.equal(pulo.reproducoes, 1);
  assert.equal(foguete.reproducoes, 0);
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
  documento.hidden = true;
  eventos.visibilitychange();
  assert.ok(audios.every(a => a.paused));
  documento.hidden = false;
  eventos.visibilitychange();
  assert.equal(musica.paused, false);

  eventos.click();
  eventos.pointerdown();
  eventos.keydown();
  assert.equal(botao.textContent, 'Ativar som');
  assert.ok(audios.every(a => a.paused), 'Uma escolha de silenciar permanece durante os comandos.');
  sons.colisao();
  assert.equal(colisao.reproducoes, 0);
  eventos.click();
  sons.colisao();
  assert.equal(musica.paused, false, 'Uma vida extra permite continuar a música.');
  estado.acabou = true;
  sons.colisao();
  sons.atualizar();
  assert.equal(colisao.reproducoes, 2);
  assert.equal(colisao.paused, false, 'O efeito continua durante a transição final.');
  assert.equal(musica.paused, true);
  eventos.pagehide();
  assert.ok(audios.every(a => a.paused));
  estado.acabou = false;
  eventos.pageshow({persisted: true});
  assert.equal(musica.paused, false);

  // O primeiro comando comum recupera o autoplay bloqueado, sem ativar som.
  const b = ambiente(true);
  await esperar();
  for (let i = 0; i < 100; i++) b.sons.atualizar();
  assert.equal(b.audios[0].reproducoes, 1);
  b.liberar();
  b.eventos.keydown();
  await esperar();
  assert.equal(b.audios[0].paused, false);
  assert.equal(b.audios[0].reproducoes, 2);
  assert.doesNotMatch(b.botao.title, /primeiro comando/);
  const c = ambiente(true);
  await esperar();
  c.liberar();
  c.eventos.pointerdown();
  await esperar();
  assert.equal(c.audios[0].paused, false);

  // Erro de arquivo e uma rejeição atrasada após silenciar não quebram a partida.
  pulo.play = () => Promise.reject(new Error('Arquivo ausente'));
  sons.pulo();
  await esperar();
  const d = ambiente(true);
  d.eventos.click();
  await esperar();
  d.eventos.pointerdown();
  assert.ok(d.audios.every(a => a.paused));
  assert.equal(d.botao.textContent, 'Ativar som');
  console.log('Testes de áudio automático, desbloqueio, efeitos, pausa e retorno: OK');
}

testar().catch(erro => { console.error(erro); process.exitCode = 1; });
