window.Jogo.arquivosAudio = {
  musica: 'midia/musicas/musica.mp3',
  pulo: 'midia/efeitos/pulo.mp3',
  foguete: 'midia/efeitos/foguete.wav',
  colisao: 'midia/efeitos/Colisao_Derrota.ogg',
  coleta: 'midia/efeitos/colisao_parte.mp3'
};

window.Jogo.configurarAudio = function (estado) {
  const botao = document.getElementById('botao-som');
  const audios = {};
  const tentativas = {};
  let somAtivo = true;

  for (const nome in window.Jogo.arquivosAudio) {
    audios[nome] = new Audio(window.Jogo.arquivosAudio[nome]);
    audios[nome].preload = 'auto';
    audios[nome].volume = nome === 'musica' ? 0.3 : 0.7;
    tentativas[nome] = { desejado: false, tentou: false, bloqueado: false, versao: 0 };
  }
  audios.musica.loop = true;
  audios.foguete.loop = true;

  function podeTocar() {
    return somAtivo && !estado.pausado && !estado.acabou && !document.hidden;
  }

  function atualizarBotao() {
    botao.textContent = somAtivo ? 'Silenciar' : 'Ativar som';
    botao.setAttribute('aria-pressed', String(somAtivo));
    botao.title = tentativas.musica.bloqueado
      ? 'A música começa no primeiro comando do jogo.'
      : 'Ligar ou silenciar a música e os efeitos.';
  }

  function parar(nome, reiniciar = false) {
    const tentativa = tentativas[nome];
    tentativa.versao++;
    tentativa.desejado = tentativa.tentou = tentativa.bloqueado = false;
    audios[nome].pause();
    if (reiniciar) audios[nome].currentTime = 0;
  }

  function tocar(nome) {
    const tentativa = tentativas[nome];
    tentativa.desejado = tentativa.tentou = true;
    tentativa.bloqueado = false;
    const versao = ++tentativa.versao;
    // O resultado real de play() decide se houve bloqueio de reprodução.
    Promise.resolve(audios[nome].play()).then(() => {
      if (tentativa.versao === versao) atualizarBotao();
    }).catch(erro => {
      if (tentativa.versao !== versao) return;
      tentativa.bloqueado = erro.name === 'NotAllowedError';
      atualizarBotao();
    });
  }

  function sincronizar(nome, desejado) {
    const tentativa = tentativas[nome];
    if (!desejado) {
      if (tentativa.desejado) parar(nome, nome !== 'musica');
    } else if (!tentativa.tentou) {
      tocar(nome);
    }
  }

  function atualizar() {
    const ativo = podeTocar();
    // A trilha já pode começar na contagem de entrada e de retomada.
    sincronizar('musica', ativo);
    sincronizar('foguete', ativo && !estado.contagem && estado.tempoPulo > 0 && estado.tempoPulo <= 0.8);
    if (!ativo || estado.contagem > 0) parar('pulo', true);
    if (!ativo || estado.contagem > 0) parar('coleta', true);
    if (document.hidden || estado.pausado) parar('colisao', true);
  }

  function liberarSom() {
    if (!somAtivo) return;
    // Uma tecla ou toque normal basta; não é necessário ativar um botão de som.
    for (const nome of ['musica', 'foguete']) {
      if (tentativas[nome].bloqueado) tentativas[nome].tentou = false;
    }
    atualizar();
  }

  botao.addEventListener('click', function () {
    somAtivo = !somAtivo;
    if (!somAtivo) for (const nome in audios) parar(nome);
    atualizarBotao();
    atualizar();
  });
  document.addEventListener('pointerdown', liberarSom, true);
  document.addEventListener('keydown', liberarSom, true);
  document.addEventListener('visibilitychange', atualizar);
  window.addEventListener('pagehide', function () {
    somAtivo = false;
    for (const nome in audios) parar(nome);
  });
  window.addEventListener('pageshow', function (evento) {
    if (!evento.persisted) return;
    somAtivo = true;
    atualizarBotao();
    atualizar();
  });

  atualizarBotao();
  atualizar();

  return {
    pulo() {
      if (!podeTocar() || estado.contagem > 0) return;
      parar('pulo', true);
      tocar('pulo');
    },
    coleta() {
      if (!podeTocar() || estado.contagem > 0) return;
      parar('coleta', true);
      tocar('coleta');
    },
    colisao() {
      parar('foguete', true);
      parar('pulo', true);
      if (estado.acabou) parar('musica');
      if (!somAtivo || document.hidden) return;
      parar('colisao', true);
      tocar('colisao');
    },
    atualizar
  };
};
