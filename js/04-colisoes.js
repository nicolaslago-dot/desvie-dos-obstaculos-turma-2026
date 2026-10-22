window.Jogo.bateu = function (estado) {
  return estado.obstaculos.some(obstaculo =>
    estado.alturaPulo < 0.55 &&
    obstaculo.pista === estado.pista &&
    obstaculo.z >= 0.965 &&
    obstaculo.z <= 1.08
  );
};
