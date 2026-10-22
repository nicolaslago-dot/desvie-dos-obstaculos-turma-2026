window.Jogo = {
  novoEstado() {
    return {
      pista: 0,
      pistaVisual: 0,
      alturaPulo: 0,
      tempoPulo: 0,
      obstaculos: [],
      proximoObstaculo: 1.25,
      distancia: 0,
      pontos: 0,
      nivel: 1,
      velocidade: 0.32,
      tempo: 0,
      contagem: 0,
      pausado: false,
      acabou: false
    };
  }
};
