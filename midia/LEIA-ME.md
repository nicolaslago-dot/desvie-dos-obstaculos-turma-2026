# Áudios do jogo

Coloque os arquivos de áudio nesta pasta, com estes nomes:

```text
midia/
  musica.mp3
  pulo.mp3
  foguete.mp3
  colisao.mp3
```

- `musica.mp3`: música de fundo; repete durante a corrida.
- `pulo.mp3`: efeito curto ao começar o pulo.
- `foguete.mp3`: efeito do motor; repete enquanto o robô está no ar.
- `colisao.mp3`: efeito da batida. Use um som de até meio segundo, pois depois o jogo abre a tela de resultado.

Os áudios ainda não estão incluídos. Você pode adicionar um de cada vez.
Use arquivos próprios ou com autorização de uso.

## Como trocar os arquivos

Abra `js/11-audio.js`. Os caminhos ficam logo no começo:

```js
window.Jogo.arquivosAudio = {
  musica: 'midia/musica.mp3',
  pulo: 'midia/pulo.mp3',
  foguete: 'midia/foguete.mp3',
  colisao: 'midia/colisao.mp3'
};
```

Se o arquivo se chamar `minha-musica.ogg`, por exemplo, troque a linha por:

```js
musica: 'midia/minha-musica.ogg',
```

Trocar a extensão no código não converte o arquivo: use o nome e a extensão reais.
Os caminhos são relativos a `jogo.html`.

## Como usar

Abra o jogo e clique em **Ativar som**. A música começa quando a contagem termina.
**Silenciar** desliga todos os áudios; clique em **Ativar som** para voltar.
A música e o foguete param durante a pausa. Cada partida começa com o som desligado.

O volume da música está em `0.3` e o dos efeitos em `0.7`.
Para ajustar, altere a linha com `.volume` no JavaScript. Os valores vão de `0` a `1`.

O HTML já carrega o arquivo e os comandos do jogo já estão conectados a ele.
Se algum áudio estiver faltando, o jogo continua funcionando.
