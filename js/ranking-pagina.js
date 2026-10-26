const dados = new URLSearchParams(window.location.search);
const distancia = Number(dados.get('distancia')) || 0;
const nivel = Number(dados.get('nivel')) || 1;
const partida = dados.get('partida') || '';

const formulario = document.getElementById('formulario-ranking');
const nomeJogador = document.getElementById('nome-jogador');
const botaoRegistrar = document.getElementById('botao-registrar');
const mensagem = document.getElementById('mensagem-registro');
const partidaValida = partida.length > 0 && partida.length <= 100 &&
  dados.has('distancia') && Number(dados.get('distancia')) === distancia &&
  Number.isSafeInteger(distancia) && distancia >= 0 &&
  dados.has('nivel') && Number(dados.get('nivel')) === nivel &&
  Number.isSafeInteger(nivel) && nivel >= 1;

formulario.hidden = !partidaValida;
const resumo = document.getElementById('resumo-partida');
resumo.hidden = !partidaValida;
resumo.textContent = 'Sua corrida: ' + distancia + ' m · Nível ' + nivel;
try {
  nomeJogador.value = localStorage.getItem('corrida-do-circuito-nome') || '';
  if (window.Ranking.ler().some(item => item.partida === partida)) {
    botaoRegistrar.disabled = true;
    nomeJogador.disabled = true;
    mensagem.textContent = 'Esta partida já está registrada no ranking.';
  }
} catch (erro) {
}

nomeJogador.addEventListener('input', () => nomeJogador.setCustomValidity(''));
formulario.addEventListener('submit', evento => {
  evento.preventDefault();
  if (!partidaValida || botaoRegistrar.disabled) return;
  if (!nomeJogador.value.trim()) {
    nomeJogador.setCustomValidity('Digite seu nome para registrar a partida.');
    nomeJogador.reportValidity();
    return;
  }
  try {
    const registro = window.Ranking.registrar(nomeJogador.value, { partida, distancia, nivel });
    mensagem.textContent = registro.posicao <= 10
      ? 'Partida registrada! Você ficou em ' + registro.posicao + 'º lugar.'
      : 'Sua distância ficou abaixo do top 10. Tente novamente para entrar no ranking!';
    botaoRegistrar.disabled = true;
    nomeJogador.disabled = true;
  } catch (erro) {
    mensagem.textContent = 'Não foi possível salvar. Permita o armazenamento neste navegador e tente novamente.';
    return;
  }
  try {
    localStorage.setItem('corrida-do-circuito-nome', nomeJogador.value.trim());
  } catch (erro) {
  }
  window.Ranking.mostrar(document, partida);
});

window.Ranking.mostrar(document, partida);
