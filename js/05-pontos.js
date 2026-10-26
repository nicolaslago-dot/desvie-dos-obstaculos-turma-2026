const CHAVE_RECORDE = 'corrida-do-circuito-melhor-distancia';

window.Jogo.atualizarPontos = function (estado, segundos) {
  estado.tempo += segundos;
  estado.distancia += estado.velocidade * segundos * 48;
  estado.pontos = Math.floor(estado.distancia * 10);

  window.Jogo.atualizarDificuldade(estado);
};

window.Jogo.salvarResultado = function (estado) {
  const distancia = Math.floor(estado.distancia);
  let recorde = distancia;

  try {
    recorde = Math.max(distancia, Number(localStorage.getItem(CHAVE_RECORDE)) || 0);
    localStorage.setItem(CHAVE_RECORDE, String(recorde));
  } catch (erro) {
  }

  const partida = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  return { pontos: estado.pontos, distancia, recorde, nivel: estado.nivel, partida };
};
