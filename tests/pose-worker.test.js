const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function ambiente() {
  const workers = [];
  const imagens = [];
  const limites = new Map();
  let id = 0;
  const contexto = vm.createContext({
    window: { Jogo: {} },
    OffscreenCanvas: class {},
    Worker: class {
      constructor(url) { this.url = url; this.mensagens = []; this.encerramentos = 0; workers.push(this); }
      postMessage(dados, transferidos) { this.mensagens.push({ dados, transferidos }); }
      terminate() { this.encerramentos++; }
    },
    createImageBitmap: async (video, opcoes) => {
      const imagem = { video, opcoes, fechamentos: 0, close() { this.fechamentos++; } };
      imagens.push(imagem);
      return imagem;
    },
    setTimeout: (fn, ms) => { limites.set(++id, { fn, ms }); return id; },
    clearTimeout: chave => limites.delete(chave)
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/sistemas/camera.js'), 'utf8'), contexto);
  return { contexto, workers, imagens, limites, criar: () => contexto.window.Jogo.criarDetectorPose() };
}

const concluirPromessas = () => new Promise(resolve => setImmediate(resolve));

async function testar() {
  const a = ambiente();
  const carregamento = a.criar();
  const worker = a.workers[0];
  assert.equal(worker.url, 'js/sistemas/pose-worker.js');
  assert.equal(worker.mensagens[0].dados.tipo, 'iniciar');
  worker.onmessage({ data: { tipo: 'pronto' } });
  const detector = await carregamento;
  assert.equal(a.limites.size, 0);
  const leitura = detector.detectForVideo({ videoWidth: 640, videoHeight: 480 }, 100);
  assert.equal(detector.detectForVideo({ videoWidth: 640, videoHeight: 480 }, 166), leitura,
    'Várias solicitações compartilham o único quadro em análise, sem criar uma fila.');
  await concluirPromessas();
  assert.equal(a.imagens.length, 1);
  assert.equal(a.imagens[0].opcoes.resizeWidth, 480);
  assert.equal(a.imagens[0].opcoes.resizeHeight, 360);
  assert.equal(worker.mensagens.length, 2);
  assert.equal(worker.mensagens[1].dados.agora, 100);
  assert.equal(worker.mensagens[1].transferidos[0], a.imagens[0], 'Transfere a imagem para o processamento separado.');
  const pontos = [[{ x: 0.5, y: 0.2, visibility: 1 }]];
  worker.onmessage({ data: { tipo: 'resultado', landmarks: pontos } });
  assert.equal((await leitura).landmarks, pontos);
  assert.equal(a.limites.size, 0);

  const retrato = detector.detectForVideo({ videoWidth: 720, videoHeight: 1280 }, 300);
  await concluirPromessas();
  assert.equal(a.imagens[1].opcoes.resizeWidth, 203);
  assert.equal(a.imagens[1].opcoes.resizeHeight, 360, 'Preserva a proporção em câmeras na vertical.');
  worker.onmessage({ data: { tipo: 'resultado', landmarks: [] } });
  await retrato;
  detector.close();
  detector.close();
  assert.equal(worker.encerramentos, 1);
  await assert.rejects(detector.detectForVideo({ videoWidth: 640, videoHeight: 480 }, 400), /encerrado/);

  // Encerrar durante a captura não deixa uma imagem nem uma promessa pendurada.
  const b = ambiente();
  let capturar;
  b.contexto.createImageBitmap = () => new Promise(resolve => { capturar = resolve; });
  const abrindo = b.criar();
  b.workers[0].onmessage({ data: { tipo: 'pronto' } });
  const cancelavel = await abrindo;
  const pendente = cancelavel.detectForVideo({ videoWidth: 640, videoHeight: 480 }, 0);
  await concluirPromessas();
  const cancelamento = assert.rejects(pendente, /encerrado/);
  cancelavel.close();
  await cancelamento;
  const imagemTardia = { fechamentos: 0, close() { this.fechamentos++; } };
  capturar(imagemTardia);
  await concluirPromessas();
  assert.equal(imagemTardia.fechamentos, 1);
  assert.equal(b.workers[0].mensagens.length, 1, 'Não envia quadros depois de desligar.');
  assert.equal(b.limites.size, 0);

  const c = ambiente();
  const falhaInicial = c.criar();
  c.workers[0].onmessage({ data: { tipo: 'erro', mensagem: 'Falha no modelo' } });
  await assert.rejects(falhaInicial, /Falha no modelo/);
  assert.equal(c.workers[0].encerramentos, 1);
  assert.equal(c.limites.size, 0);

  const d = ambiente();
  const semResposta = d.criar();
  d.limites.values().next().value.fn();
  await assert.rejects(semResposta, /carregamento excedido/);
  assert.equal(d.workers[0].encerramentos, 1);

  const e = ambiente();
  const inicio = e.criar();
  e.workers[0].onmessage({ data: { tipo: 'pronto' } });
  const semRetorno = await inicio;
  const quadro = semRetorno.detectForVideo({ videoWidth: 640, videoHeight: 480 }, 0);
  const expirado = assert.rejects(quadro, /leitura excedido/);
  e.limites.values().next().value.fn();
  await expirado;
  await concluirPromessas();
  assert.equal(e.workers[0].encerramentos, 1);
  assert.equal(e.imagens[0].fechamentos, 1, 'Descarta a imagem capturada após o tempo limite.');

  const f = ambiente();
  f.contexto.createImageBitmap = () => { throw new Error('Vídeo indisponível'); };
  const pronto = f.criar();
  f.workers[0].onmessage({ data: { tipo: 'pronto' } });
  const capturaFalha = await pronto;
  await assert.rejects(capturaFalha.detectForVideo({ videoWidth: 640, videoHeight: 480 }, 0), /Vídeo indisponível/);
  assert.equal(f.workers[0].encerramentos, 1);
  assert.equal(f.limites.size, 0);

  const g = ambiente();
  g.contexto.Worker = undefined;
  await assert.rejects(g.criar(), erro => erro.name === 'NotSupportedError');
  console.log('Testes do processamento da câmera em segundo plano: OK');
}

testar().catch(erro => { console.error(erro); process.exitCode = 1; });
