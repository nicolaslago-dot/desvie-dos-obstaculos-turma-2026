const CHAVE_RECORDE = 'corrida-do-circuito-melhor-distancia';

window.Jogo.atualizarPontos = function (estado, segundos) {
  estado.tempo += segundos;
  estado.distancia += estado.velocidade * segundos * 48;
  estado.pontos = Math.floor(estado.distancia * 10);

  estado.nivel = 1 + Math.floor(estado.distancia / 150);
  estado.velocidade = Math.min(0.56, 0.32 + (estado.nivel - 1) * 0.022);
};

window.Jogo.salvarResultado = function (estado) {
  const distancia = Math.floor(estado.distancia);
  let recorde = distancia;

  try {
    recorde = Math.max(distancia, Number(localStorage.getItem(CHAVE_RECORDE)) || 0);
    localStorage.setItem(CHAVE_RECORDE, String(recorde));
  } catch (erro) {
  }

  return { pontos: estado.pontos, distancia, recorde };
};
