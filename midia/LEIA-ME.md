# Áudios do jogo

Os arquivos do jogo estão separados por uso:

```text
midia/
  musicas/
    musica.mp3
    derrota.ogg
  efeitos/
    pulo.mp3
    foguete.wav
    colisao_parte.mp3
    derrota.ogg
    Colisao_Derrota.ogg
```

- `musica.mp3`: música de fundo; repete durante a corrida.
- `pulo.mp3`: efeito curto ao começar o pulo.
- `foguete.wav`: efeito do motor; repete enquanto o robô está no ar.
- `Colisao_Derrota.ogg`: efeito ao bater em um obstáculo.
- `colisao_parte.mp3`: efeito ao coletar uma parte do robô.

Os sons usados na corrida já estão incluídos. `derrota.ogg` fica disponível
como alternativa. Use arquivos próprios ou com autorização de uso.

## Como trocar os arquivos

Abra `js/sistemas/audio.js`. Os caminhos ficam logo no começo:

```js
window.Jogo.arquivosAudio = {
  musica: 'midia/musicas/musica.mp3',
  pulo: 'midia/efeitos/pulo.mp3',
  foguete: 'midia/efeitos/foguete.wav',
  colisao: 'midia/efeitos/Colisao_Derrota.ogg',
  coleta: 'midia/efeitos/colisao_parte.mp3'
};
```

Se o arquivo se chamar `minha-musica.ogg`, por exemplo, troque a linha por:

```js
musica: 'midia/musicas/minha-musica.ogg',
```

Trocar a extensão no código não converte o arquivo: use o nome e a extensão reais.
Os caminhos são relativos a `jogo.html`.

## Como usar

Cada entrada na partida começa com o som ligado e tenta tocar a música já
durante a contagem. Se o navegador bloquear o áudio automático, a primeira tecla
ou toque normal no jogo tenta liberá-lo, sem precisar clicar em **Ativar som**.
Essa restrição pertence ao navegador; não é possível garantir som audível antes
de qualquer interação em todos os dispositivos.

**Silenciar** desliga todos os áudios; **Ativar som** permite voltar depois de
silenciar manualmente. A música e os efeitos param durante a pausa ou ao ocultar
a página. Ao continuar, a trilha retoma de onde parou.

O volume da música está em `0.3` e o dos efeitos em `0.7`.
Para ajustar, altere a linha com `.volume` no JavaScript. Os valores vão de `0` a `1`.

O HTML já carrega o arquivo e os comandos do jogo já estão conectados a ele.
Se algum áudio estiver faltando, o jogo continua funcionando.
