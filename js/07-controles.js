window.Jogo.configurarControles = function (estado, mostrarPausa) {
  const botaoPausa = document.getElementById('botao-pausa');
  const botaoContinuar = document.getElementById('botao-continuar');

  function pausar(valor) {
    if (estado.acabou) return;
    estado.pausado = valor;
    mostrarPausa(valor);
  }

  window.addEventListener('keydown', evento => {
    if ([' ', 'Enter'].includes(evento.key) && evento.target?.closest('button, a, summary')) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(evento.key)) evento.preventDefault();
    if (evento.repeat) return;

    if (evento.key === 'ArrowLeft') window.Jogo.mover(estado, -1);

    if (evento.key === 'ArrowRight') window.Jogo.mover(estado, 1);
    if (evento.key === 'ArrowUp' || evento.key === ' ') window.Jogo.pular(estado);

    if (evento.key.toLowerCase() === 'p' || evento.key === 'Escape') pausar(!estado.pausado);
  });

  botaoPausa.addEventListener('click', () => pausar(!estado.pausado));
  botaoContinuar.addEventListener('click', () => pausar(false));

  window.addEventListener('blur', () => pausar(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pausar(true);
  });
  return pausar;
};
