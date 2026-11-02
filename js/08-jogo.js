const estado = window.Jogo.novoEstado();
const desenhar = window.Jogo.criarDesenho(document.getElementById('tela-jogo'));
const pontosNaTela = document.getElementById('pontos');
const distanciaNaTela = document.getElementById('distancia');
const nivelNaTela = document.getElementById('nivel');
const painelPausa = document.getElementById('painel-pausa');
const botaoPausa = document.getElementById('botao-pausa');
const painelContagem = document.getElementById('painel-contagem');
const numeroContagem = document.getElementById('numero-contagem');
const vidasNaTela = document.getElementById('vidas');
const totalPecas = document.getElementById('total-pecas');
const avisoColeta = document.getElementById('aviso-coleta');
const painelPecas = document.getElementById('pecas-robo');
const painelResultado = document.getElementById('painel-resultado');
const botaoReiniciar = document.getElementById('botao-reiniciar');
const iconesPecas = window.Jogo.partesRobo.map(parte => {
  const icone = document.createElement('img');
  icone.src = parte.imagem;
  icone.alt = parte.nome + ': falta coletar';
  icone.title = icone.alt;
  painelPecas.appendChild(icone);
  return icone;
});
window.Jogo.sons = window.Jogo.configurarAudio(estado);
let ultimoQuadro = performance.now();

function mostrarPausa(pausado) {
  painelPausa.hidden = !pausado;
  if (pausado) {
    estado.contagem = 0;
    painelContagem.hidden = true;
    botaoPausa.textContent = 'Continuar';
  } else {
    iniciarContagem();
    botaoPausa.textContent = 'Pausar';
  }
  ultimoQuadro = performance.now();
}

function iniciarContagem() {
  estado.contagem = 3;
  numeroContagem.textContent = '3';
  painelContagem.hidden = false;
  ultimoQuadro = performance.now();
}

const pausar = window.Jogo.configurarControles(estado, mostrarPausa);
const camera = window.Jogo.configurarCamera(estado, pausar);
iniciarContagem();

botaoReiniciar.addEventListener('click', () => {
  if (!estado.acabou) return;
  // Mantém as referências usadas pela câmera, pelo áudio e pelo teclado.
  Object.assign(estado, window.Jogo.novoEstado());
  camera.prepararPartida();
  painelResultado.hidden = true;
  painelPausa.hidden = true;
  document.getElementById('efeito-colisao').classList.remove('active');
  pontosNaTela.textContent = '000000';
  distanciaNaTela.textContent = '0';
  nivelNaTela.textContent = '01';
  botaoPausa.textContent = 'Pausar';
  iniciarContagem();
  botaoPausa.focus();
});

function terminarJogo() {
  estado.acabou = true;
  const resultado = window.Jogo.salvarResultado(estado);
  document.getElementById('efeito-colisao').classList.add('active');

  document.getElementById('pontuacao-final').textContent = String(resultado.pontos).padStart(6, '0');
  document.getElementById('distancia-final').textContent = resultado.distancia;
  document.getElementById('nivel-final').textContent = resultado.nivel;
  document.getElementById('maior-distancia').textContent = resultado.recorde;
  document.getElementById('link-ranking').href = 'ranking.html?' + new URLSearchParams(resultado).toString();
  setTimeout(() => {
    painelResultado.hidden = false;
    botaoReiniciar.focus();
  }, 500);
}

function atualizarQuadro(agora) {
  const decorrido = Math.max(0, (agora - ultimoQuadro) / 1000);
  const segundos = Math.min(decorrido, 0.05);
  ultimoQuadro = agora;

  if (!estado.pausado && !estado.acabou && estado.contagem > 0) {
    estado.contagem = Math.max(0, estado.contagem - decorrido);
    const numero = String(Math.ceil(estado.contagem));
    if (numeroContagem.textContent !== numero) numeroContagem.textContent = numero;
    painelContagem.hidden = estado.contagem === 0;
  } else if (!estado.pausado && !estado.acabou) {
    window.Jogo.atualizarPontos(estado, segundos);
    window.Jogo.animarMovimento(estado, segundos);
    const pecasColetadas = window.Jogo.atualizarColeta(estado, segundos);
    if (pecasColetadas > 0) window.Jogo.sons.coleta();
    window.Jogo.atualizarObstaculos(estado, segundos);

    if (window.Jogo.bateu(estado) && window.Jogo.receberImpacto(estado)) {
      window.Jogo.sons.colisao();
      if (estado.acabou) terminarJogo();
    }

    pontosNaTela.textContent = String(estado.pontos).padStart(6, '0');
    distanciaNaTela.textContent = Math.floor(estado.distancia);
    nivelNaTela.textContent = String(estado.nivel).padStart(2, '0');
  }

  vidasNaTela.textContent = estado.vidas;
  totalPecas.textContent = estado.pecasColetadas.length + '/6';
  window.Jogo.partesRobo.forEach((parte, indice) => {
    const coletada = estado.pecasColetadas.includes(parte.id);
    const descricao = parte.nome + (coletada ? ': coletada' : ': falta coletar');
    const icone = iconesPecas[indice];
    icone.classList.toggle('coletada', coletada);
    if (icone.alt !== descricao) icone.alt = icone.title = descricao;
  });
  avisoColeta.hidden = estado.tempoAviso === 0;
  if (avisoColeta.textContent !== estado.aviso) avisoColeta.textContent = estado.aviso;

  desenhar(estado);
  window.Jogo.sons.atualizar();
  requestAnimationFrame(atualizarQuadro);
}

requestAnimationFrame(atualizarQuadro);
