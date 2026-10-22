const dados = new URLSearchParams(window.location.search);
const pontos = Number(dados.get('pontos')) || 0;
const distancia = Number(dados.get('distancia')) || 0;
let recorde = Math.max(distancia, Number(dados.get('recorde')) || 0);

try {
  recorde = Math.max(recorde, Number(localStorage.getItem('corrida-do-circuito-melhor-distancia')) || 0);
} catch (erro) {
}

document.getElementById('pontuacao-final').textContent = String(pontos).padStart(6, '0');
document.getElementById('distancia-final').textContent = distancia;
document.getElementById('maior-distancia').textContent = recorde;
