(function () {
  const CHAVE = 'corrida-do-circuito-ranking';
  const LIMITE = 10;

  function normalizarNome(nome) {
    return typeof nome === 'string' ? nome.trim().replace(/\s+/g, ' ').slice(0, 24) : '';
  }

  function valido(item) {
    return item && normalizarNome(item.nome) &&
      typeof item.partida === 'string' && item.partida.length > 0 && item.partida.length <= 100 &&
      Number.isSafeInteger(item.distancia) && item.distancia >= 0 &&
      Number.isSafeInteger(item.nivel) && item.nivel >= 1;
  }

  function ordenar(itens) {
    return itens.sort((a, b) => b.distancia - a.distancia || b.nivel - a.nivel);
  }

  function ler() {
    const texto = localStorage.getItem(CHAVE);
    let itens;
    try {
      itens = JSON.parse(texto || '[]');
    } catch (erro) {
      return [];
    }
    if (!Array.isArray(itens)) return [];
    const partidas = new Set();
    return ordenar(itens.filter(item => {
      if (!valido(item) || partidas.has(item.partida)) return false;
      partidas.add(item.partida);
      return true;
    }).map(item => ({ ...item, nome: normalizarNome(item.nome) }))).slice(0, LIMITE);
  }

  function registrar(nome, resultado) {
    const item = {
      nome: normalizarNome(nome),
      partida: resultado.partida,
      distancia: resultado.distancia,
      nivel: resultado.nivel
    };
    if (!valido(item)) throw new Error('Preencha seu nome e conclua uma partida para registrar.');
    const itens = ler();
    const existente = itens.findIndex(registro => registro.partida === item.partida);
    if (existente !== -1) return { posicao: existente + 1 };
    itens.push(item);
    ordenar(itens);
    const posicao = itens.indexOf(item) + 1;
    localStorage.setItem(CHAVE, JSON.stringify(itens.slice(0, LIMITE)));
    return { posicao };
  }

  function mostrar(documento, partida) {
    const corpo = documento.getElementById('ranking-corpo');
    const vazio = documento.getElementById('ranking-vazio');
    const aviso = documento.getElementById('ranking-aviso');
    corpo.replaceChildren();
    aviso.textContent = '';
    let itens;
    try {
      itens = ler();
    } catch (erro) {
      vazio.hidden = true;
      aviso.textContent = 'O ranking está indisponível. Permita o armazenamento neste navegador.';
      return;
    }
    vazio.hidden = itens.length > 0;
    itens.forEach((item, indice) => {
      const linha = documento.createElement('tr');
      linha.classList.toggle('minha-partida', item.partida === partida);
      [String(indice + 1) + 'º', item.nome, item.distancia + ' m', String(item.nivel)].forEach(valor => {
        const celula = documento.createElement('td');
        celula.textContent = valor;
        linha.appendChild(celula);
      });
      corpo.appendChild(linha);
    });
  }

  window.Ranking = { ler, registrar, mostrar };
}());
