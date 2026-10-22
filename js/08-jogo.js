const estado = window.Jogo.novoEstado();
const desenhar = window.Jogo.criarDesenho(document.getElementById('tela-jogo'));
const pontosNaTela = document.getElementById('pontos');
const distanciaNaTela = document.getElementById('distancia');
const nivelNaTela = document.getElementById('nivel');
const painelPausa = document.getElementById('painel-pausa');
const botaoPausa = document.getElementById('botao-pausa');
const painelContagem = document.getElementById('painel-contagem');
const numeroContagem = document.getElementById('numero-contagem');
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
window.Jogo.configurarCamera(estado, pausar);
iniciarContagem();

function terminarJogo() {
  estado.acabou = true;
  window.Jogo.sons.colisao();
  window.Jogo.desligarCamera();
  const resultado = window.Jogo.salvarResultado(estado);
  document.getElementById('efeito-colisao').classList.add('active');

  const dados = new URLSearchParams(resultado);
  setTimeout(() => {
    window.location.href = 'gameover.html?' + dados.toString();
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
    window.Jogo.atualizarObstaculos(estado, segundos);

    pontosNaTela.textContent = String(estado.pontos).padStart(6, '0');
    distanciaNaTela.textContent = Math.floor(estado.distancia);
    nivelNaTela.textContent = String(estado.nivel).padStart(2, '0');

    if (window.Jogo.bateu(estado)) terminarJogo();
  }

  desenhar(estado);
  window.Jogo.sons.atualizar();
  requestAnimationFrame(atualizarQuadro);
}

requestAnimationFrame(atualizarQuadro);
