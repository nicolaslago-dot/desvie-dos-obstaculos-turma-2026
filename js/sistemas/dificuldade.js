window.Jogo.atualizarDificuldade = function (estado) {
  // Sobe suavemente e se aproxima de um limite, sem saltos entre níveis.
  const progresso = 1 - Math.exp(-estado.distancia / 1800);
  estado.nivel = 1 + Math.floor(estado.distancia / 150);
  estado.velocidade = 0.32 + 0.24 * progresso;
  estado.intervaloObstaculos = 1.75 - 0.6 * progresso;
  estado.chanceDupla = estado.distancia < 150 ? 0 : 0.12 + 0.3 * progresso;
};
