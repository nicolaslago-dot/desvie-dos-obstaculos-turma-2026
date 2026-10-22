// Coloque os áudios na pasta midia. Para usar outros nomes, troque só estas linhas.
window.Jogo.arquivosAudio = {
  musica: 'midia/musica.mp3',
  pulo: 'midia/pulo.mp3',
  foguete: 'midia/foguete.mp3',
  colisao: 'midia/colisao.mp3'
};

window.Jogo.configurarAudio = function (estado) {
  const botao = document.getElementById('botao-som');
  const audios = {};
  let somAtivo = false;
  let musicaTocando = false;
  let fogueteTocando = false;

  // Os arquivos só são carregados depois de clicar em Ativar som.
  function preparar() {
    if (audios.musica) return;
    for (const nome in window.Jogo.arquivosAudio) {
      audios[nome] = new Audio(window.Jogo.arquivosAudio[nome]);
      audios[nome].preload = 'auto';
      audios[nome].volume = nome === 'musica' ? 0.3 : 0.7;
    }
    audios.musica.loop = true;
    audios.foguete.loop = true;
  }

  function tocar(nome) {
    if (!somAtivo) return;
    // Se o arquivo faltar ou o navegador bloquear o som, o jogo continua.
    audios[nome].play().catch(() => {});
  }

  function parar(nome, reiniciar = false) {
    if (!audios[nome]) return;
    audios[nome].pause();
    if (reiniciar) audios[nome].currentTime = 0;
  }

  // O jogo já chama esta função a cada quadro.
  function atualizar() {
    const correndo = somAtivo && !estado.pausado && !estado.acabou &&
      !(estado.contagem > 0) && !document.hidden;
    if (correndo !== musicaTocando) {
      musicaTocando = correndo;
      if (correndo) tocar('musica');
      else parar('musica');
    }
    const noAr = correndo && estado.tempoPulo > 0 && estado.tempoPulo <= 0.8;
    if (noAr !== fogueteTocando) {
      fogueteTocando = noAr;
      if (noAr) tocar('foguete');
      else parar('foguete', true);
    }
    if (!correndo) parar('pulo', true);
  }

  botao.addEventListener('click', function () {
    somAtivo = !somAtivo;
    if (somAtivo) preparar();
    else for (const nome in audios) parar(nome);
    botao.textContent = somAtivo ? 'Silenciar' : 'Ativar som';
    botao.setAttribute('aria-pressed', String(somAtivo));
    atualizar();
  });

  // Para os sons ao trocar de aba ou sair da página.
  document.addEventListener('visibilitychange', atualizar);
  window.addEventListener('pagehide', function () {
    somAtivo = false;
    for (const nome in audios) parar(nome);
  });

  return {
    pulo() {
      if (!somAtivo || estado.pausado || estado.acabou || estado.contagem > 0) return;
      parar('pulo', true);
      tocar('pulo');
    },
    colisao() {
      parar('musica');
      parar('foguete', true);
      parar('pulo', true);
      musicaTocando = fogueteTocando = false;
      if (!somAtivo) return;
      parar('colisao', true);
      tocar('colisao');
    },
    atualizar
  };
};
