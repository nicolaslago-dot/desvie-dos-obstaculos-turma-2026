const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const contexto = vm.createContext({ window: {} });
for (const nome of ['01-estado', '02-movimento', '03-obstaculos', '04-colisoes']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + nome + '.js'), 'utf8'), contexto);
}
const jogo = contexto.window.Jogo;

function corrida(velocidade, z) {
  const estado = jogo.novoEstado();
  estado.velocidade = velocidade;
  estado.proximoObstaculo = Infinity;
  estado.obstaculos = [{ pista: 0, z }];
  return estado;
}

// O salto cruza o obstáculo na descida, ainda com altura suficiente.
// Aterrissar depois da passagem não pode retirar uma vida.
for (const velocidade of [0.32, 0.44, 0.56]) {
  for (const segundos of [1 / 60, 0.05]) {
    const estado = corrida(velocidade, 0.99 - velocidade * 0.6);
    jogo.pular(estado);
    let cruzouNoAr = false;
    for (let quadro = 0; quadro < Math.ceil(1.1 / segundos); quadro++) {
      jogo.animarMovimento(estado, segundos);
      jogo.atualizarObstaculos(estado, segundos);
      if (estado.obstaculos.some(o => o.z >= 0.99) && estado.alturaPulo >= 0.55) cruzouNoAr = true;
      if (jogo.bateu(estado)) jogo.receberImpacto(estado);
    }
    assert.ok(cruzouNoAr, 'O robô realmente passou por cima do obstáculo.');
    assert.equal(estado.vidas, 1, 'A descida após ultrapassar o obstáculo não causa dano.');
    assert.equal(estado.acabou, false);
    assert.equal(estado.alturaPulo, 0);
  }
}

// Continua detectando uma batida no chão, inclusive no quadro que cruza a passagem.
const noChao = corrida(0.56, 0.995);
jogo.atualizarObstaculos(noChao, 0.05);
assert.ok(noChao.obstaculos[0].z > 1);
assert.equal(jogo.bateu(noChao), true, 'Não atravessa a zona de colisão entre quadros.');
jogo.atualizarObstaculos(noChao, 0.05);
assert.equal(jogo.bateu(noChao), false, 'O obstáculo já ficou para trás.');

const outraPista = corrida(0.32, 0.98);
outraPista.pista = 1;
assert.equal(jogo.bateu(outraPista), false);
outraPista.pista = 0;
assert.equal(jogo.bateu(outraPista), true);
outraPista.invulneravel = 1;
assert.equal(jogo.bateu(outraPista), false);

// Saltar cedo demais ainda permite uma colisão ao aterrissar antes do obstáculo.
const cedo = corrida(0.32, 0.99 - 0.32 * 1.1);
jogo.pular(cedo);
for (let i = 0; i < 24; i++) {
  jogo.animarMovimento(cedo, 0.05);
  jogo.atualizarObstaculos(cedo, 0.05);
  if (jogo.bateu(cedo)) jogo.receberImpacto(cedo);
}
assert.equal(cedo.vidas, 0);
assert.equal(cedo.acabou, true);
console.log('Testes de colisão e salto: OK');
