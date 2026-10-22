window.Jogo.tiposObstaculo = [
  'sprites/computadores/desktop.png',
  'sprites/computadores/notebook.png',
  'sprites/computadores/servidores.png',
  'sprites/hologramas/barreira_vertical.png',
  'sprites/hologramas/barreira_horizontal.png'
];

function criarObstaculo(estado, pista) {
  const tipos = window.Jogo.tiposObstaculo;
  estado.obstaculos.push({
    pista,
    z: 0,
    imagem: tipos[Math.floor(Math.random() * tipos.length)]
  });
}

window.Jogo.atualizarObstaculos = function (estado, segundos) {
  for (const obstaculo of estado.obstaculos) {
    obstaculo.z += estado.velocidade * segundos;
  }
  estado.obstaculos = estado.obstaculos.filter(obstaculo => obstaculo.z < 1);

  estado.proximoObstaculo -= segundos;
  if (estado.proximoObstaculo > 0) return;

  const primeiraPista = Math.floor(Math.random() * 3) - 1;
  criarObstaculo(estado, primeiraPista);

  if (estado.nivel > 1 && Math.random() < 0.3) {
    const livres = [-1, 0, 1].filter(pista => pista !== primeiraPista);
    criarObstaculo(estado, livres[Math.floor(Math.random() * livres.length)]);
  }

  estado.proximoObstaculo = Math.max(0.95, 1.75 - (estado.nivel - 1) * 0.07);
};
