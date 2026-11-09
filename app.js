const GRAVIDADE = 9.81;
const ALTURA_ARO = 3.05;
const TOLERANCIA_ARO = 0.045;

const canvas = document.querySelector("#quadra");
const contexto = canvas.getContext("2d");
const formulario = document.querySelector("#controles");
const campoDistancia = document.querySelector("#distancia");
const campoAltura = document.querySelector("#altura");
const campoAngulo = document.querySelector("#angulo");
const botaoRepetir = document.querySelector("#repetir");
const botaoReiniciar = document.querySelector("#reiniciar");
const estadoMotor = document.querySelector("#estado-motor");
const mensagem = document.querySelector("#mensagem");
const saidaVelocidade = document.querySelector("#velocidade");
const saidaTempo = document.querySelector("#tempo");
const saidaResultado = document.querySelector("#resultado");

const painel = formulario.closest(".painel");
const aroQuadra = 8;
let jogadorX = 4;
let esquerda = 0;
let caminhada = null;
let fase = 0;
let anterior;
let pausa;
const comandos = new Map();

const placarCestas = document.querySelector("#cestas");
const placarTentativas = document.querySelector("#tentativas");
const avisoJogada = document.querySelector("#jogada");
const dadosJogada = document.querySelector("#dados-jogada");
const inclinacao = document.querySelector("#inclinacao");
let cestas = 0;
let tentativas = 0;
let acerto = false;
let pulsoRede = 0;
let limites = null;

let motor;
let ultimoArremesso = null;
let quadroAnimacao = null;
let inicioAnimacao = 0;
let tempoParada = 0;
let posicoesRastro = [];
let bolaAtual = null;

async function selecionarMotor() {
  try {
    const fisica = await import("./fisica.js");
    if (typeof fisica.calcularArremesso !== "function" || typeof fisica.posicaoDaBola !== "function") {
      throw new Error("fisica.js precisa exportar calcularArremesso e posicaoDaBola.");
    }
    motor = {
      calcularArremesso: fisica.calcularArremesso,
      posicaoDaBola: fisica.posicaoDaBola,
    };
    estadoMotor.textContent = "Física real carregada";
    estadoMotor.dataset.modo = "real";
  } catch (erro) {
    const texto = "Não foi possível carregar fisica.js: " + erro.message;
    estadoMotor.textContent = texto;
    estadoMotor.dataset.modo = "erro";
    mostrarErro(texto);
  }
  atualizarQuadra();
}

function lerEntradas() {
  const distancia = campoDistancia.valueAsNumber;
  const alturaSaida = campoAltura.valueAsNumber;
  const anguloGraus = campoAngulo.valueAsNumber;
  if (!Number.isFinite(distancia) || distancia <= 0) return { erro: "Informe uma distância maior que zero." };
  if (!Number.isFinite(alturaSaida) || alturaSaida <= 0) return { erro: "A altura de saída deve ser maior que zero." };
  if (!Number.isFinite(anguloGraus) || anguloGraus <= 0 || anguloGraus >= 90) {
    return { erro: "Use um ângulo maior que 0° e menor que 90°." };
  }
  return { distancia, alturaSaida, anguloGraus };
}

function mostrarErro(texto) {
  mensagem.textContent = texto;
  mensagem.dataset.tipo = "erro";
  saidaVelocidade.textContent = "—";
  saidaTempo.textContent = "—";
  saidaResultado.textContent = "—";
}

function limparLeitura() {
  saidaVelocidade.textContent = "—";
  saidaTempo.textContent = "—";
  saidaResultado.textContent = "Aguardando o arremesso.";
  mensagem.textContent = "Ajuste os valores e calcule um arremesso.";
  mensagem.dataset.tipo = "";
}

function calcular() {
  if (quadroAnimacao !== null || caminhada !== null) return;
  const entradas = lerEntradas();
  if (entradas.erro) {
    pararAnimacao();
    mostrarErro(entradas.erro);
    return;
  }

  if (!motor) {
    mostrarErro(estadoMotor.textContent);
    return;
  }

  let resultado;
  try {
    resultado = motor.calcularArremesso(entradas.distancia, entradas.alturaSaida, entradas.anguloGraus);
  } catch (erro) {
    pararAnimacao();
    mostrarErro("Falha ao calcular com o módulo de física: " + erro.message);
    return;
  }
  if (!resultado || !Number.isFinite(resultado.velocidade) || resultado.velocidade <= 0 ||
      !Number.isFinite(resultado.tempoAteAro) || resultado.tempoAteAro <= 0) {
    pararAnimacao();
    mostrarErro("Não há solução física para esses valores. Tente outro ângulo ou altura.");
    return;
  }

  ultimoArremesso = { velocidade: resultado.velocidade };
  botaoRepetir.disabled = false;
  saidaVelocidade.textContent = `${resultado.velocidade.toFixed(2)} m/s`;
  disparar({ ...entradas, ...resultado });
}

function arremessarComMesmaVelocidade() {
  if (quadroAnimacao !== null || caminhada !== null) return;
  if (!ultimoArremesso) return;
  const entradas = lerEntradas();
  if (entradas.erro) {
    pararAnimacao();
    mostrarErro(entradas.erro);
    return;
  }
  const angulo = entradas.anguloGraus * Math.PI / 180;
  const velocidadeX = ultimoArremesso.velocidade * Math.cos(angulo);
  const tempoAteAro = entradas.distancia / velocidadeX;
  if (!Number.isFinite(tempoAteAro) || tempoAteAro <= 0) {
    pararAnimacao();
    mostrarErro("Não foi possível calcular o tempo até o aro.");
    return;
  }
  saidaVelocidade.textContent = `${ultimoArremesso.velocidade.toFixed(2)} m/s`;
  disparar({ ...entradas, velocidade: ultimoArremesso.velocidade, tempoAteAro });
}

function disparar({ distancia, alturaSaida, anguloGraus, velocidade, tempoAteAro }) {
  posicionar(distancia);
  pararAnimacao();
  const noAro = obterPosicao(tempoAteAro, alturaSaida, anguloGraus, velocidade);
  if (!noAro) {
    mostrarErro("O módulo de física retornou uma posição inválida.");
    return;
  }
  const tempoChao = resolverTempoChao(alturaSaida, anguloGraus, velocidade);
  const chegouAbaixoDoAro = noAro.y <= 0;
  tempoParada = chegouAbaixoDoAro ? Math.max(0.05, tempoChao) : tempoAteAro;
  bolaAtual = { origem: jogadorX, distancia, alturaSaida, anguloGraus, velocidade };
  posicoesRastro = [];
  saidaTempo.textContent = `${tempoAteAro.toFixed(2)} s`;

  if (chegouAbaixoDoAro) {
    saidaResultado.textContent = "Errou: a bola atingiu o chão antes de chegar ao aro.";
  } else if (Math.abs(noAro.y - ALTURA_ARO) <= TOLERANCIA_ARO && velocidadeVertical(tempoAteAro, anguloGraus, velocidade) < 0) {
    saidaResultado.textContent = "Cesta! Passou pelo centro do aro descendo.";
  } else if (velocidadeVertical(tempoAteAro, anguloGraus, velocidade) >= 0) {
    saidaResultado.textContent = "Errou: a bola chega ao aro subindo.";
  } else if (noAro.y < ALTURA_ARO) {
    saidaResultado.textContent = "Errou: passou abaixo do centro do aro.";
  } else {
    saidaResultado.textContent = "Errou: passou acima do centro do aro.";
  }

  acerto = saidaResultado.textContent.startsWith("Cesta!");
  limites = { topo: alturaSaida, direita: aroQuadra + 1.75, esquerda };
  for (let i = 0; i <= 128; i++) {
    const amostra = obterPosicao(tempoParada * i / 128, alturaSaida, anguloGraus, velocidade);
    if (!amostra) continue;
    limites.topo = Math.max(limites.topo, amostra.y);
    limites.direita = Math.max(limites.direita, jogadorX + amostra.x + 0.3);
    limites.esquerda = Math.min(limites.esquerda, jogadorX + amostra.x - 0.3);
  }
  placarTentativas.textContent = ++tentativas;
  avisoJogada.textContent = "NO AR";
  avisoJogada.dataset.resultado = "";
  dadosJogada.textContent = `Distância: ${distancia.toFixed(2)} m · Saída: ${alturaSaida} m · Ângulo: ${anguloGraus}°`;
  painel.hidden = true;
  clearTimeout(pausa);
  mensagem.textContent = "Arremesso em andamento…";
  mensagem.dataset.tipo = "";
  atualizarQuadra();
  inicioAnimacao = performance.now();
  quadroAnimacao = requestAnimationFrame(animar);
}

function obterPosicao(tempo, altura, angulo, velocidade) {
  try {
    const ponto = motor.posicaoDaBola(tempo, altura, angulo, velocidade);
    if (!ponto || !Number.isFinite(ponto.x) || !Number.isFinite(ponto.y)) return null;
    return ponto;
  } catch {
    return null;
  }
}

function velocidadeVertical(tempo, anguloGraus, velocidade) {
  return velocidade * Math.sin(anguloGraus * Math.PI / 180) - GRAVIDADE * tempo;
}

function resolverTempoChao(altura, anguloGraus, velocidade) {
  const vy = velocidade * Math.sin(anguloGraus * Math.PI / 180);
  return (vy + Math.sqrt(vy ** 2 + 2 * GRAVIDADE * altura)) / GRAVIDADE;
}

function animar(agora) {
  if (!bolaAtual) return;
  const decorrido = (agora - inicioAnimacao) / 1000;
  const tempo = Math.min(decorrido, tempoParada);
  const ponto = obterPosicao(tempo, bolaAtual.alturaSaida, bolaAtual.anguloGraus, bolaAtual.velocidade);
  if (ponto) posicoesRastro.push(ponto);
  desenharQuadra(ponto);
  if (decorrido < tempoParada) {
    quadroAnimacao = requestAnimationFrame(animar);
  } else {
    quadroAnimacao = null;
    if (acerto) {
      placarCestas.textContent = ++cestas;
      pulsoRede = 1;
      setTimeout(() => { pulsoRede = 0; atualizarQuadra(); }, 240);
    }
    avisoJogada.textContent = acerto ? "CESTA!" : "ERROU!";
    avisoJogada.dataset.resultado = acerto ? "cesta" : "erro";
    painel.hidden = false;
    atualizarQuadra();
    mensagem.textContent = "Animação concluída. Você pode arremessar de novo ou reiniciar.";
  }
}

function pararAnimacao() {
  if (quadroAnimacao !== null) cancelAnimationFrame(quadroAnimacao);
  quadroAnimacao = null;
  bolaAtual = null;
  posicoesRastro = [];
  atualizarQuadra();
}

function reiniciar() {
  liberarTudo();
  pararAnimacao();
  ultimoArremesso = null;
  botaoRepetir.disabled = true;
  limparLeitura();
  placarCestas.textContent = cestas = 0;
  placarTentativas.textContent = tentativas = 0;
  avisoJogada.textContent = "PRONTO";
  avisoJogada.dataset.resultado = "";
  dadosJogada.textContent = "Aguardando o primeiro lançamento.";
  atualizarQuadra();
}

function atualizarQuadra(ponto) {
  if (canvas.width === 0 || canvas.height === 0) return;
  desenharQuadra(ponto);
}

function desenharQuadra(ponto) {
  const largura = canvas.clientWidth || 720;
  const altura = canvas.clientHeight || 400;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(largura * dpr) || canvas.height !== Math.round(altura * dpr)) {
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
  }
  contexto.setTransform(dpr, 0, 0, dpr, 0, 0);
  contexto.clearRect(0, 0, largura, altura);
  const borda = bolaAtual ? limites?.esquerda ?? esquerda : esquerda;
  const mundoLargura = (bolaAtual ? limites?.direita ?? aroQuadra + 1.75 : aroQuadra + 1.75) - borda;
  const mundoAltura = Math.max(4.8, (bolaAtual ? limites?.topo ?? 0 : 0) + 0.5, (bolaAtual?.alturaSaida ?? (campoAltura.valueAsNumber || 2)) + 0.5);
  const margemEsq = Math.max(28, largura * 0.055);
  const margemDir = Math.max(28, largura * 0.055);
  const margemTopo = Math.max(28, altura * 0.08);
  const margemChao = Math.max(40, altura * 0.12);
  const escala = Math.min((largura - margemEsq - margemDir) / mundoLargura, (altura - margemTopo - margemChao) / mundoAltura);
  const origemX = (largura - mundoLargura * escala) / 2;
  const chaoY = altura - margemChao;
  const px = x => origemX + (x - borda) * escala;
  const py = y => chaoY - y * escala;
  const aroX = aroQuadra;
  const gradiente = contexto.createLinearGradient(0, 0, 0, altura);
  gradiente.addColorStop(0, "#100e19");
  gradiente.addColorStop(1, "#312233");
  contexto.fillStyle = gradiente;
  contexto.fillRect(0, 0, largura, altura);

  for (let x = 32; x < largura; x += 94) {
    const luz = contexto.createLinearGradient(x, 20, x, chaoY);
    luz.addColorStop(0, "#ffe2ab20");
    luz.addColorStop(1, "#ffe2ab00");
    contexto.fillStyle = luz;
    contexto.beginPath();
    contexto.moveTo(x - 8, 20);
    contexto.lineTo(x + 8, 20);
    contexto.lineTo(x + 67, chaoY);
    contexto.lineTo(x - 67, chaoY);
    contexto.fill();
    contexto.fillStyle = "#ffdb9c";
    contexto.fillRect(x - 8, 18, 16, 3);
  }
  contexto.fillStyle = "#99522f";
  contexto.fillRect(0, chaoY, largura, altura - chaoY);
  for (let y = chaoY; y < altura; y += 10) {
    contexto.fillStyle = y % 20 < 10 ? "#b4693c" : "#a95c35";
    contexto.fillRect(0, y, largura, 9);
    contexto.fillStyle = "#683822";
    for (let x = (y % 20) * 6; x < largura; x += 120) contexto.fillRect(x, y, 1, 9);
  }
  contexto.strokeStyle = "#ffe1ad";
  contexto.lineWidth = 2;
  contexto.strokeRect(px(aroX - 1.8), chaoY + 3, escala * 2.4, 17);
  contexto.fillStyle = "#c47a48";
  contexto.fillRect(0, chaoY, largura, Math.max(4, escala * 0.055));
  contexto.strokeStyle = "rgba(255, 226, 184, .3)";
  contexto.lineWidth = 1;
  contexto.beginPath();
  contexto.moveTo(0, chaoY + escala * 0.19);
  contexto.lineTo(largura, chaoY + escala * 0.19);
  contexto.stroke();
  contexto.fillStyle = "rgba(255,255,255,.7)";
  contexto.font = "600 11px system-ui, sans-serif";
  contexto.fillText("CHÃO · y = 0 m", 14, altura - 12);

  // Tabela, aro e rede ficam à direita da trajetória, como em uma quadra lateral.
  const aroY = ALTURA_ARO;
  contexto.fillStyle = "#69657c";
  contexto.fillRect(px(aroX + 0.83), py(aroY + 0.58), Math.max(4, escala * 0.12), (aroY + 0.58) * escala);
  contexto.fillRect(px(aroX + 0.42), py(aroY + 0.58), escala * 0.53, Math.max(3, escala * 0.07));
  contexto.fillStyle = "#b9d8ed50";
  contexto.fillRect(px(aroX + 0.4), py(aroY + 0.75), Math.max(7, escala * 0.14), escala * 0.94);
  contexto.strokeStyle = "#f3f4ed";
  contexto.lineWidth = Math.max(3, escala * 0.045);
  contexto.beginPath();
  contexto.moveTo(px(aroX + 0.42), py(aroY + 0.7));
  contexto.lineTo(px(aroX + 0.42), py(aroY - 0.14));
  contexto.stroke();
  contexto.strokeStyle = "#ff7b35";
  contexto.lineWidth = Math.max(3, escala * 0.05);
  contexto.beginPath();
  contexto.moveTo(px(aroX - 0.16), py(aroY));
  contexto.lineTo(px(aroX + 0.18), py(aroY));
  contexto.stroke();
  contexto.strokeStyle = "rgba(255,255,255,.76)";
  contexto.lineWidth = 1;
  contexto.beginPath();
  contexto.moveTo(px(aroX - 0.12), py(aroY - 0.03));
  contexto.lineTo(px(aroX - 0.06), py(aroY - 0.32 - pulsoRede * 0.2));
  contexto.lineTo(px(aroX + 0.08), py(aroY - 0.32 - pulsoRede * 0.2));
  contexto.lineTo(px(aroX + 0.16), py(aroY - 0.03));
  contexto.stroke();
  for (const deslocamento of [-0.08, 0, 0.08]) {
    contexto.beginPath();
    contexto.moveTo(px(aroX + deslocamento), py(aroY - 0.04));
    contexto.lineTo(px(aroX - deslocamento / 2), py(aroY - 0.32 - pulsoRede * 0.2));
    contexto.stroke();
  }
  contexto.fillStyle = "#ffd9a8";
  contexto.font = "700 11px system-ui, sans-serif";
  contexto.textAlign = "right";
  contexto.fillText("ARO · 3,05 m", px(aroX + 0.38), py(aroY + 0.16));
  contexto.textAlign = "left";

  contexto.strokeStyle = "rgba(255,255,255,.24)";
  contexto.setLineDash([5, 5]);
  contexto.beginPath();
  contexto.moveTo(px(aroX), py(0));
  contexto.lineTo(px(aroX), py(aroY));
  contexto.stroke();
  contexto.setLineDash([]);

  const alturaSaida = campoAltura.valueAsNumber || 2;
  const maoY = bolaAtual?.alturaSaida ?? alturaSaida;
  const corpoX = px(jogadorX - 0.45);
  const corpo = Math.max(23, escala * 1.25);
  const passo = caminhada === null ? 5 : Math.sin(fase) * corpo * 0.25;
  contexto.strokeStyle = "#f78842";
  contexto.lineWidth = Math.max(3, corpo * 0.09);
  contexto.lineCap = "round";
  contexto.beginPath();
  contexto.moveTo(corpoX - passo, chaoY);
  contexto.lineTo(corpoX, chaoY - corpo / 2);
  contexto.lineTo(corpoX + passo, chaoY);
  contexto.moveTo(corpoX, chaoY - corpo / 2);
  contexto.lineTo(corpoX, chaoY - corpo);
  contexto.lineTo(px(jogadorX), py(ponto ? maoY + 0.13 : caminhada === null ? maoY : 0.85));
  contexto.stroke();
  contexto.fillStyle = "#fa7737";
  contexto.fillRect(corpoX - corpo * 0.16, chaoY - corpo, corpo * 0.32, corpo * 0.47);
  contexto.fillStyle = "#3b244c";
  contexto.fillRect(corpoX - corpo * 0.17, chaoY - corpo * 0.59, corpo * 0.34, corpo * 0.24);
  contexto.fillStyle = "#f4be91";
  contexto.beginPath();
  contexto.arc(corpoX + 2, chaoY - corpo * 1.19, Math.max(5, corpo * 0.15), 0, Math.PI * 2);
  contexto.fill();
  const inicio = { x: jogadorX, y: caminhada === null ? maoY : 0.15 + 0.7 * Math.abs(Math.sin(fase)) };
  const pontos = bolaAtual ? posicoesRastro : [];
  if (pontos.length > 1) {
    contexto.beginPath();
    contexto.moveTo(px(bolaAtual.origem + pontos[0].x), py(pontos[0].y));
    for (const p of pontos.slice(1)) contexto.lineTo(px(bolaAtual.origem + p.x), py(p.y));
    contexto.strokeStyle = "#ffd166";
    contexto.lineWidth = 3;
    contexto.lineCap = "round";
    contexto.stroke();
  }

  const atual = ponto ? { x: bolaAtual.origem + ponto.x, y: ponto.y } : inicio;
  const bolaX = px(atual.x);
  const bolaY = py(Math.max(0, atual.y));
  const raio = Math.max(7, escala * 0.12);
  contexto.beginPath();
  contexto.arc(bolaX, bolaY, raio, 0, Math.PI * 2);
  contexto.shadowColor = "#ff963e";
  contexto.shadowBlur = ponto ? 15 : 0;
  contexto.fillStyle = "#ff963e";
  contexto.fill();
  contexto.shadowBlur = 0;
  contexto.strokeStyle = "#582d1e";
  contexto.lineWidth = Math.max(1.4, raio * 0.1);
  contexto.stroke();
  contexto.beginPath();
  contexto.moveTo(bolaX - raio * 0.88, bolaY);
  contexto.lineTo(bolaX + raio * 0.88, bolaY);
  contexto.moveTo(bolaX, bolaY - raio * 0.88);
  contexto.lineTo(bolaX, bolaY + raio * 0.88);
  contexto.stroke();
}

formulario.addEventListener("submit", evento => {
  evento.preventDefault();
  calcular();
});
botaoRepetir.addEventListener("click", arremessarComMesmaVelocidade);
botaoReiniciar.addEventListener("click", reiniciar);
window.addEventListener("resize", () => atualizarQuadra());

void selecionarMotor();

function posicionar(distancia) {
  jogadorX = aroQuadra - distancia;
  esquerda = Math.min(esquerda, jogadorX);
  atualizarQuadra();
}

function agendarPainel() {
  clearTimeout(pausa);
  pausa = setTimeout(() => { painel.hidden = false; }, 500);
}

function atualizarComandos() {
  if (comandos.size && quadroAnimacao === null) {
    if (caminhada !== null) return;
    clearTimeout(pausa);
    painel.hidden = true;
    bolaAtual = null;
    posicoesRastro = [];
    anterior = null;
    caminhada = requestAnimationFrame(andar);
  } else if (caminhada !== null) {
    cancelAnimationFrame(caminhada);
    caminhada = null;
    posicionar(campoDistancia.valueAsNumber);
    agendarPainel();
  }
}

function andar(agora) {
  const dt = anterior === null ? 0 : Math.min((agora - anterior) / 1000, 0.05);
  anterior = agora;
  const direcao = [...comandos.values()].at(-1);
  jogadorX = Math.max(esquerda, Math.min(aroQuadra - 0.5, jogadorX + direcao * 2.6 * dt));
  fase += dt * 9;
  campoDistancia.value = (aroQuadra - jogadorX).toFixed(2);
  atualizarQuadra();
  caminhada = requestAnimationFrame(andar);
}

function liberar(comando) {
  comandos.delete(comando);
  atualizarComandos();
}

function liberarTudo() {
  comandos.clear();
  atualizarComandos();
}

const direcoes = new Map([["a", -1], ["d", 1], ["arrowleft", -1], ["arrowright", 1]]);
window.addEventListener("keydown", evento => {
  const tecla = evento.key.toLowerCase();
  if (!direcoes.has(tecla) || evento.target.closest?.("input, textarea, select, [contenteditable]") ||
      evento.ctrlKey || evento.altKey || evento.metaKey || quadroAnimacao !== null) return;
  evento.preventDefault();
  if (evento.repeat) return;
  comandos.set(tecla, direcoes.get(tecla));
  atualizarComandos();
});
window.addEventListener("keyup", evento => liberar(evento.key.toLowerCase()));
window.addEventListener("blur", liberarTudo);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) liberarTudo();
});
for (const botao of document.querySelectorAll("[data-direcao]")) {
  botao.addEventListener("pointerdown", evento => {
    if (evento.button !== 0 || quadroAnimacao !== null) return;
    botao.setPointerCapture(evento.pointerId);
    comandos.set(evento.pointerId, Number(botao.dataset.direcao));
    atualizarComandos();
  });
  for (const tipo of ["pointerup", "pointercancel", "lostpointercapture"]) {
    botao.addEventListener(tipo, evento => liberar(evento.pointerId));
  }
}
campoDistancia.addEventListener("input", () => {
  const distancia = campoDistancia.valueAsNumber;
  if (quadroAnimacao === null && Number.isFinite(distancia) && distancia > 0) {
    pararAnimacao();
    posicionar(distancia);
  }
});
campoAltura.addEventListener("input", () => {
  if (quadroAnimacao === null) atualizarQuadra();
});
agendarPainel();
atualizarQuadra();

function atualizarInclinacao() {
  const graus = campoAngulo.valueAsNumber;
  inclinacao.textContent = Number.isFinite(graus) ? `${graus}°` : "—";
  inclinacao.style.setProperty("--angulo", `${Math.max(0, Math.min(90, graus || 0))}deg`);
}
campoAngulo.addEventListener("input", atualizarInclinacao);
atualizarInclinacao();
