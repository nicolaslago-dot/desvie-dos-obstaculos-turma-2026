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
    obstaculo.zAnterior = obstaculo.z;
    obstaculo.z += estado.velocidade * segundos;
  }
  // Continua desenhando o obstáculo um pouco depois de passar pelo robô.
  estado.obstaculos = estado.obstaculos.filter(obstaculo => obstaculo.z <= 1.08);

  estado.proximoObstaculo -= segundos;
  if (estado.proximoObstaculo > 0) return;

  const primeiraPista = Math.floor(Math.random() * 3) - 1;
  criarObstaculo(estado, primeiraPista);

  const pistasOcupadas = [primeiraPista];
  if (Math.random() < estado.chanceDupla) {
    const livres = [-1, 0, 1].filter(pista => pista !== primeiraPista);
    const segundaPista = livres[Math.floor(Math.random() * livres.length)];
    criarObstaculo(estado, segundaPista);
    pistasOcupadas.push(segundaPista);
  }

  // A peça acompanha a pista livre deste grupo, nunca um obstáculo.
  window.Jogo.criarPeca(estado, pistasOcupadas);
  estado.proximoObstaculo = estado.intervaloObstaculos;
};
