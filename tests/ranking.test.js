const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fonte = fs.readFileSync(path.join(__dirname, '../js/sistemas/ranking.js'), 'utf8');
const dados = new Map();
const armazenamento = {
  getItem: chave => dados.get(chave) ?? null,
  setItem: (chave, valor) => dados.set(chave, String(valor))
};
function carregar(storage = armazenamento) {
  const contexto = vm.createContext({ window: {}, localStorage: storage });
  vm.runInContext(fonte, contexto);
  return contexto.window.Ranking;
}
const ranking = carregar();
const corrida = (id, distancia, nivel = 1) => ({ partida: id, distancia, nivel });
assert.equal(ranking.ler().length, 0);
assert.throws(() => ranking.registrar('   ', corrida('vazia', 20)));
assert.throws(() => ranking.registrar('Ana', corrida('invalida', Infinity)));
assert.throws(() => ranking.registrar('Ana', corrida('invalida', 20, 0)));
assert.throws(() => ranking.registrar('Ana', corrida('', 20)));

ranking.registrar('  Ana   Maria  ', corrida('a', 150, 2));
ranking.registrar('Bia', corrida('b', 300, 3));
ranking.registrar('Caio', corrida('c', 150, 4));
assert.deepEqual(Array.from(ranking.ler(), item => item.nome), ['Bia', 'Caio', 'Ana Maria']);
assert.equal(ranking.ler()[1].nivel, 4);
assert.equal(ranking.registrar('Ana', corrida('a', 150, 2)).posicao, 3);
assert.equal(ranking.ler().length, 3, 'A mesma partida não pode aparecer duas vezes.');
assert.equal(carregar().ler().length, 3, 'Os resultados continuam disponíveis após reabrir.');

for (let i = 0; i < 12; i++) ranking.registrar('Jogador ' + i, corrida('extra-' + i, 500 + i, 4));
assert.equal(ranking.ler().length, 10);
assert.equal(ranking.ler()[0].distancia, 511);
assert.equal(ranking.ler()[9].distancia, 502);
assert.equal(ranking.registrar('Lia', corrida('curta', 10)).posicao, 11);
assert.equal(ranking.ler().length, 10);

const chave = 'corrida-do-circuito-ranking';
dados.set(chave, '{quebrado');
assert.equal(ranking.ler().length, 0);
dados.set(chave, JSON.stringify([null, {}, { nome: 'X', partida: 'x', distancia: -1, nivel: 1 }]));
assert.equal(ranking.ler().length, 0);
const nomeLiteral = '<img src=x onerror=x>';
ranking.registrar(nomeLiteral, corrida('literal', 800, 6));
const corpo = { children: [], replaceChildren() { this.children = []; }, appendChild(item) { this.children.push(item); } };
const elemento = () => ({ children: [], classList: { toggle() {} }, appendChild(item) { this.children.push(item); } });
const elementos = { 'ranking-corpo': corpo, 'ranking-vazio': {}, 'ranking-aviso': {} };
const documento = { getElementById: id => elementos[id], createElement: elemento };
ranking.mostrar(documento, 'literal');
assert.equal(corpo.children[0].children[1].textContent, nomeLiteral, 'Nomes são exibidos como texto.');
assert.equal(corpo.children[0].children[2].textContent, '800 m');
assert.equal(corpo.children[0].children[3].textContent, '6');

const bloqueado = carregar({ getItem() { throw Error('Bloqueado'); }, setItem() { throw Error('Bloqueado'); } });
assert.throws(() => bloqueado.registrar('Ana', corrida('sem-storage', 100)));
bloqueado.mostrar(documento);
assert.match(elementos['ranking-aviso'].textContent, /indisponível/);
const semEspaco = carregar({ getItem: () => '[]', setItem() { throw Error('Sem espaço'); } });
assert.throws(() => semEspaco.registrar('Ana', corrida('sem-espaco', 100)));

// A página separada recebe a corrida da tela final e mantém o registro funcionando.
const fontePagina = fs.readFileSync(path.join(__dirname, '../js/ranking-pagina.js'), 'utf8');
function abrirPagina(search) {
  const nos = new Map();
  function no(id) {
    if (!nos.has(id)) nos.set(id, {
      value: '', textContent: '', disabled: false, eventos: {}, children: [],
      addEventListener(tipo, evento) { this.eventos[tipo] = evento; },
      replaceChildren() { this.children = []; },
      appendChild(item) { this.children.push(item); },
      setCustomValidity(mensagem) { this.validacao = mensagem; }, reportValidity() {}
    });
    return nos.get(id);
  }
  const contexto = vm.createContext({
    window: { location: { search } }, localStorage: armazenamento, URLSearchParams,
    document: { getElementById: no, createElement: elemento }
  });
  vm.runInContext(fonte, contexto);
  vm.runInContext(fontePagina, contexto);
  return no;
}
assert.equal(abrirPagina('')('formulario-ranking').hidden, true);
assert.equal(abrirPagina('?partida=invalida&distancia=abc&nivel=2')('formulario-ranking').hidden, true);
const consulta = '?partida=nova-pagina&distancia=950&nivel=7';
const pagina = abrirPagina(consulta);
assert.equal(pagina('formulario-ranking').hidden, false);
assert.equal(pagina('resumo-partida').textContent, 'Sua corrida: 950 m · Nível 7');
const enviar = () => pagina('formulario-ranking').eventos.submit({ preventDefault() {} });
pagina('nome-jogador').value = '   ';
enviar();
assert.ok(pagina('nome-jogador').validacao);
assert.equal(pagina('botao-registrar').disabled, false);
pagina('nome-jogador').value = 'Luna';
pagina('nome-jogador').eventos.input();
enviar();
assert.equal(ranking.ler()[0].nome, 'Luna');
assert.equal(ranking.ler()[0].distancia, 950);
assert.equal(ranking.ler()[0].nivel, 7);
assert.equal(pagina('botao-registrar').disabled, true);
assert.equal(abrirPagina(consulta)('botao-registrar').disabled, true);
assert.equal(abrirPagina('')('ranking-corpo').children.length, 2, 'A consulta exibe também o resultado antigo.');
console.log('Testes do ranking: OK');
