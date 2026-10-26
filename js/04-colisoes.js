window.Jogo.bateu = function (estado) {
  if (estado.invulneravel > 0) return false;
  return estado.obstaculos.some(obstaculo =>
    estado.alturaPulo < 0.55 &&
    obstaculo.pista === estado.pista &&
    obstaculo.z >= 0.965 &&
    // Considera a passagem entre quadros, sem causar dano depois dela.
    (obstaculo.zAnterior ?? obstaculo.z) <= 1
  );
};

window.Jogo.receberImpacto = function (estado) {
  if (estado.acabou || estado.invulneravel > 0) return false;
  estado.vidas--;
  if (estado.vidas === 0) {
    estado.acabou = true;
  } else {
    estado.invulneravel = 2.5;
    estado.aviso = 'VIDA EXTRA USADA · CONTINUE CORRENDO!';
    estado.tempoAviso = 2.5;
  }
  return true;
};
