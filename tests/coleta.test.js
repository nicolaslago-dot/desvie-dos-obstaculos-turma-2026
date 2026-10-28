const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const contexto = vm.createContext({ window: {} });
for (const arquivo of ['01-estado.js', '03-obstaculos.js', '04-colisoes.js', '05-pontos.js', 'sistemas/dificuldade.js', 'sistemas/coleta.js']) {
  const caminho = path.join(__dirname, '../js', arquivo);
  vm.runInContext(fs.readFileSync(caminho, 'utf8'), contexto);
}
const jogo = contexto.window.Jogo;

// É preciso juntar seis peças diferentes. Repetidas não adiantam o conjunto.
const estado = jogo.novoEstado();
assert.equal(estado.vidas, 1);
assert.equal(jogo.partesRobo.length, 6);
function coletar(parte) {
  estado.pecas.push({ parte: parte.id, pista: estado.pista, z: 0.97 });
  return jogo.atualizarColeta(estado, 0);
}
assert.equal(coletar(jogo.partesRobo[0]), 1);
assert.equal(coletar(jogo.partesRobo[0]), 0, 'Não emite coleta para uma peça repetida.');
assert.equal(estado.pecasColetadas.length, 1);
assert.equal(estado.vidas, 1);
for (const parte of jogo.partesRobo.slice(1)) coletar(parte);
assert.equal(estado.vidas, 2);
assert.equal(estado.pecasColetadas.length, 0);
assert.equal(estado.aviso, '', 'Completar as peças não mostra uma mensagem.');
for (const parte of jogo.partesRobo) coletar(parte);
assert.equal(estado.vidas, 3, 'Novos conjuntos também dão uma vida.');
assert.equal(estado.aviso, '', 'Completar outro conjunto também não mostra mensagem.');

// Conjuntos podem continuar sendo coletados, mas nunca concedem mais que cinco vidas.
estado.vidas = 4;
for (const parte of jogo.partesRobo) coletar(parte);
assert.equal(estado.vidas, 5);
assert.equal(estado.aviso, '');
for (const parte of jogo.partesRobo) coletar(parte);
assert.equal(estado.vidas, 5, 'O total de vidas não ultrapassa cinco.');
assert.equal(estado.aviso, '', 'Atingir o limite não mostra mensagem.');
assert.equal(estado.pecasColetadas.length, 0, 'O limite não bloqueia novas coletas de peças.');

// Uma vida extra absorve uma batida e protege de impactos consecutivos.
estado.vidas = 3;
estado.obstaculos = [{ pista: 0, z: 0.98 }];
assert.equal(jogo.receberImpacto(estado), true);
assert.equal(estado.vidas, 2);
assert.equal(estado.acabou, false);
assert.ok(estado.invulneravel > 0);
assert.equal(estado.aviso, '', 'Usar uma vida extra não mostra aviso.');
assert.equal(estado.tempoAviso, 0);
assert.equal(jogo.bateu(estado), false);
assert.equal(jogo.receberImpacto(estado), false);
jogo.atualizarColeta(estado, 3);
assert.equal(jogo.bateu(estado), true);
jogo.receberImpacto(estado);
jogo.atualizarColeta(estado, 3);
jogo.receberImpacto(estado);
assert.equal(estado.vidas, 0);
assert.equal(estado.acabou, true);

// Peças aparecem na pista livre do grupo, sem duplicar as que já estão a caminho.
const corrida = jogo.novoEstado();
for (let i = 0; i < 500; i++) {
  corrida.obstaculos = [];
  corrida.proximoObstaculo = 0;
  corrida.proximaPeca = 0;
  corrida.distancia = 5000;
  jogo.atualizarDificuldade(corrida);
  jogo.atualizarObstaculos(corrida, 0);
  const pistas = new Set(corrida.obstaculos.map(o => o.pista));
  assert.ok(pistas.size <= 2);
  for (const peca of corrida.pecas) assert.ok(!pistas.has(peca.pista) || peca.z !== 0);
  assert.equal(new Set(corrida.pecas.map(p => p.parte)).size, corrida.pecas.length);
  corrida.pecas = [];
}

// Errar uma peça permite recuperá-la depois; outras pistas não coletam.
corrida.pecas = [{ parte: jogo.partesRobo[0].id, pista: -1, z: 0.97 }];
jogo.atualizarColeta(corrida, 0);
assert.equal(corrida.pecasColetadas.length, 0);
jogo.atualizarColeta(corrida, 1);
assert.equal(corrida.pecas.length, 0);
corrida.proximaPeca = 0;
jogo.criarPeca(corrida, [0, 1]);
assert.equal(corrida.pecas[0].parte, jogo.partesRobo[0].id);

// A progressão é contínua, limitada e conserva tempo para trocar de pista.
const progressao = jogo.novoEstado();
let anterior = progressao.velocidade;
for (let distancia = 0; distancia <= 100000; distancia += 10) {
  progressao.distancia = distancia;
  jogo.atualizarDificuldade(progressao);
  assert.ok(progressao.velocidade >= anterior && progressao.velocidade <= 0.56);
  assert.ok(progressao.velocidade - anterior < 0.01);
  assert.ok(progressao.intervaloObstaculos >= 1.15);
  assert.ok(progressao.chanceDupla <= 0.42);
  anterior = progressao.velocidade;
}
for (const parte of jogo.partesRobo) assert.ok(fs.existsSync(path.join(__dirname, '..', parte.imagem)), parte.imagem);

// Corridas completas usam o nascimento, a aproximação e a coleta reais das peças.
// Seguir uma pista livre permite completar vários conjuntos, inclusive no limite.
for (const inicio of [0, 10000]) {
  const completa = jogo.novoEstado();
  completa.distancia = inicio;
  for (let quadro = 0; quadro < 2400; quadro++) {
    const perigos = completa.obstaculos.filter(o => o.z >= 0.85 && o.z <= 1.08);
    const livres = [-1, 0, 1].filter(pista => !perigos.some(o => o.pista === pista));
    assert.ok(livres.length > 0, 'Os grupos conservam uma rota possível.');
    const alvo = completa.pecas.find(p => p.z >= 0.85 && p.z <= 1.08 && livres.includes(p.pista));
    completa.pista = alvo ? alvo.pista : livres.includes(completa.pista) ? completa.pista : livres[0];
    jogo.atualizarPontos(completa, 0.05);
    jogo.atualizarColeta(completa, 0.05);
    jogo.atualizarObstaculos(completa, 0.05);
    assert.equal(jogo.bateu(completa), false, 'É possível desviar sem depender do salto.');
  }
  assert.ok(completa.vidas >= 3 && completa.vidas <= 5, 'As peças concedem vidas sem ultrapassar o limite.');
}
console.log('Testes de coleta, vidas, pistas livres e progressão: OK');
