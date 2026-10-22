window.Jogo.mover = function (estado, direcao) {
  if (estado.pausado || estado.acabou || estado.contagem > 0) return;
  estado.pista = Math.max(-1, Math.min(1, estado.pista + direcao));
};

window.Jogo.animarMovimento = function (estado, segundos) {
  if (estado.tempoPulo > 0) {
    estado.tempoPulo = Math.max(0, estado.tempoPulo - segundos);
    estado.alturaPulo = Math.sin(Math.PI * estado.tempoPulo / 0.9);
  }
  const passo = Math.min(1, segundos * 13);
  estado.pistaVisual += (estado.pista - estado.pistaVisual) * passo;
};

window.Jogo.pular = function (estado) {
  if (estado.pausado || estado.acabou || estado.contagem > 0 || estado.tempoPulo > 0) return;
  estado.tempoPulo = 0.9;
  window.Jogo.sons?.pulo();
};
