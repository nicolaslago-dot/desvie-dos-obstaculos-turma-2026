window.Jogo.partesRobo = [
  { id: 'cabeca', nome: 'Cabeça', imagem: 'sprites/pecas-robo/cabeca.png' },
  { id: 'tronco', nome: 'Tronco', imagem: 'sprites/pecas-robo/tronco.png' },
  { id: 'braco-direito', nome: 'Braço direito', imagem: 'sprites/pecas-robo/braco-direito.png' },
  { id: 'braco-esquerdo', nome: 'Braço esquerdo', imagem: 'sprites/pecas-robo/braco-esquerdo.png' },
  { id: 'perna-esquerda', nome: 'Perna esquerda', imagem: 'sprites/pecas-robo/perna-esquerda.png' },
  { id: 'perna-direita', nome: 'Perna direita', imagem: 'sprites/pecas-robo/perna-direita.png' }
];

window.Jogo.criarPeca = function (estado, pistasOcupadas) {
  if (estado.proximaPeca > 0) return;
  const parte = window.Jogo.partesRobo.find(parte =>
    !estado.pecasColetadas.includes(parte.id) &&
    !estado.pecas.some(peca => peca.parte === parte.id)
  );
  const livres = [-1, 0, 1].filter(pista => !pistasOcupadas.includes(pista));
  if (!parte || !livres.length) return;
  estado.pecas.push({
    parte: parte.id,
    pista: livres[Math.floor(Math.random() * livres.length)],
    z: 0
  });
  estado.proximaPeca = 3.5;
};

window.Jogo.atualizarColeta = function (estado, segundos) {
  estado.proximaPeca -= segundos;
  estado.invulneravel = Math.max(0, estado.invulneravel - segundos);
  estado.tempoAviso = Math.max(0, estado.tempoAviso - segundos);
  for (const peca of estado.pecas) {
    peca.z += estado.velocidade * segundos;
    if (peca.pista !== estado.pista || peca.z < 0.94 || peca.z > 1.08) continue;
    peca.coletada = true;
    if (estado.pecasColetadas.includes(peca.parte)) continue;
    estado.pecasColetadas.push(peca.parte);
    if (estado.pecasColetadas.length === window.Jogo.partesRobo.length) {
      estado.vidas++;
      estado.pecasColetadas = [];
      estado.aviso = 'ROBÔ COMPLETO! +1 VIDA';
      estado.tempoAviso = 3;
    }
  }
  estado.pecas = estado.pecas.filter(peca => !peca.coletada && peca.z <= 1.08);
};
