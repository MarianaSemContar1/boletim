/* =========================================================
   BOLETIM DIGITAL — SCRIPT PRINCIPAL
   Aluno(a) configurado(a) no topo do arquivo.
   ========================================================= */

/* ===== CONFIGURAÇÃO FIXA DO ALUNO ===== */
const CONFIG_ALUNO = {
  turma: "8A",
  numeroChamada: 23,
  apiUrl: "https://boletim-api.profbt.com.br"
};

/* ===== DISCIPLINAS PADRÃO (usadas quando a API não tem dados) =====
   Cada nota pode vir em formatos antigos: 75, 82, 100, "8,5", 8.5, null.
   A normalização abaixo converte tudo para o padrão 0 a 10. */
const DISCIPLINAS_PADRAO = [
  { disciplina: "Língua Portuguesa", tri1: 10,0, tri2: "9,3", tri3: null, faltas: [1, 1, 2] },
  { disciplina: "Matemática", tri1: 9,0, tri2: "9,5", tri3: null faltas: [0, 2, 0] },
  { disciplina: "Ciências", tri1: "9,3", tri2: 10,0, tri3: null, faltas: [1, 3, 0] },
  { disciplina: "História", tri1: 9,7, tri2: 9,7, tri3: null, faltas: [1, 0, 1] },
  { disciplina: "Geografia", tri1: 10,0, tri2: 8,0, tri3: null, faltas: [0, 0, 1] },
  { disciplina: "Língua Inglesa", tri1: 9,1, tri2: "10,0", tri3: null, faltas: [1, 1, 0] },
  { disciplina: "Arte", tri1: 7,6, tri2: 10,0, tri3: 0,0, faltas: [1, 2, 0] },
  { disciplina: "Educação Física", tri1: 9,0, tri2: 9,1, tri3: null, faltas: [0, 0, 0] },
  { disciplina: "Educação Digital", tri1: 10,0, tri2: 10,0, tri3: null faltas: [0, 4, 0] },
  { disciplina: "Educação Financeira", tri1: 8,8, tri2: "9,0", tri3: null, faltas: [0, 0, 0] },
  { disciplina: "Estudo Orientado", tri1: 10,0, tri2: 9,0, tri3: null, faltas: [0, 0, 0] },
  { disciplina: "Redação e Leitura", tri1: 7,7, tri2: "9,4", tri3: null, faltas: [0, 2, 1] },
  { disciplina: "Pensamento Lógico", tri1: 10,0, tri2: 10,0, tri3: null, faltas: [0, 0, 0] },
  { disciplina: "Literatura Arte e Movimento", tri1: "7,5", tri2: 7,6, tri3: null, faltas: [1, 0, 1] },
  { disciplina: "Práticas Experimentais", tri1: 8,0, tri2: "9,4", tri3: null, faltas: [0, 1, 1] }
];

/* Frequência demonstrativa (não é calculada pelas faltas) */
const FREQUENCIA_DEMONSTRATIVA = "96%";

/* ===== ESTADO EM MEMÓRIA ===== */
let pinSessao = null;        // fica só em memória durante a sessão
let disciplinas = [];        // dados atuais exibidos
let modoEdicao = false;      // true quando o aluno clica em "Alterar dados"

/* ===== REFERÊNCIAS DO DOM ===== */
const elAcessoPin      = document.getElementById("acesso-pin");
const elCampoPin       = document.getElementById("campo-pin");
const elBotaoEntrar    = document.getElementById("botao-entrar");
const elMensagemAcesso = document.getElementById("mensagem-acesso");

const elAreaBoletim    = document.getElementById("area-boletim");
const elCorpoTabela    = document.getElementById("corpo-tabela");
const elBotaoAlterar   = document.getElementById("botao-alterar");
const elBotaoSalvar    = document.getElementById("botao-salvar");
const elMensagemBoletim = document.getElementById("mensagem-boletim");

const elCardMediaGeral  = document.getElementById("card-media-geral");
const elCardTotalFaltas = document.getElementById("card-total-faltas");
const elCardBomDesempenho = document.getElementById("card-bom-desempenho");
const elCardAtencao     = document.getElementById("card-atencao");
const elCardFrequencia  = document.getElementById("card-frequencia");

/* ===== REFERÊNCIAS DOS GRÁFICOS ===== */
const elCardGraficoFaltas = document.getElementById("cardGraficoFaltas");
const elEstadoFaltas      = document.getElementById("estadoFaltas");

/* ===== INSTÂNCIAS DOS GRÁFICOS (Chart.js) ===== */
let graficoMedias = null;
let graficoEvolucao = null;
let graficoFaltas = null;

/* Referência interna de risco (NÃO exibir na interface) */
const REFERENCIA_TOTAL_FALTAS = 350;

/* =========================================================
   NORMALIZAÇÃO DE NOTAS (dados antigos)
   Regras:
   75    -> 7,5
   82    -> 8,2
   100   -> 10
   "8,5" -> 8,5
   8.5   -> 8,5
   null  -> sem nota
   ========================================================= */
function normalizarNotaAntiga(valor) {
  if (valor === null || valor === undefined || valor === "") return null;

  // Se já é número
  if (typeof valor === "number") {
    if (valor > 10 && valor <= 100) return Number((valor / 10).toFixed(1));
    return Number(valor.toFixed(1));
  }

  // Se é string, aceita vírgula ou ponto
  if (typeof valor === "string") {
    const limpo = valor.trim().replace(",", ".");
    const num = Number(limpo);
    if (isNaN(num)) return null;
    if (num > 10 && num <= 100) return Number((num / 10).toFixed(1));
    return Number(num.toFixed(1));
  }

  return null;
}

/* =========================================================
   NORMALIZAÇÃO DE NOTA DIGITADA NO EDITOR
   Aceita somente: 0 a 10, ponto, vírgula ou vazio.
   Vazio -> null. Inválido -> retorna "INVALIDO".
   ========================================================= */
function normalizarNotaDigitada(valor) {
  const texto = String(valor).trim();
  if (texto === "") return null;

  // Aceita apenas número com uma vírgula ou um ponto
  if (!/^\d+([.,]\d+)?$/.test(texto)) return "INVALIDO";

  const num = Number(texto.replace(",", "."));
  if (isNaN(num)) return "INVALIDO";
  if (num < 0 || num > 10) return "INVALIDO";

  return Number(num.toFixed(1));
}

/* =========================================================
   NORMALIZAÇÃO DE FALTAS DIGITADAS
   Aceita somente inteiro >= 0. Inválido -> "INVALIDO".
   ========================================================= */
function normalizarFaltaDigitada(valor) {
  const texto = String(valor).trim();
  if (texto === "") return "INVALIDO";
  if (!/^\d+$/.test(texto)) return "INVALIDO";
  const num = Number(texto);
  if (!Number.isInteger(num) || num < 0) return "INVALIDO";
  return num;
}

/* =========================================================
   CÁLCULOS
   ========================================================= */
function calcularMedia(notas) {
  const validas = notas.filter((n) => typeof n === "number");
  if (validas.length === 0) return null;
  const soma = validas.reduce((acc, n) => acc + n, 0);
  return Number((soma / validas.length).toFixed(1));
}

function classificarSituacao(media) {
  if (media === null) return { texto: "Sem nota", classe: "situacao-indisponivel" };
  if (media >= 7) return { texto: "Bom", classe: "situacao-bom" };
  return { texto: "Atenção", classe: "situacao-atencao" };
}

function formatarNota(nota) {
  if (nota === null || nota === undefined) return "—";
  return nota.toFixed(1).replace(".", ",");
}

function formatarFaltas(faltas) {
  const validas = faltas.filter((f) => typeof f === "number");
  if (validas.length === 0) return "—";
  return validas.reduce((acc, f) => acc + f, 0);
}

/* =========================================================
   RENDERIZAÇÃO — CARDS
   ========================================================= */
function atualizarCards() {
  // Média geral
  const medias = disciplinas
    .map((d) => calcularMedia(d.notas))
    .filter((m) => m !== null);

  const mediaGeral = medias.length
    ? Number((medias.reduce((a, b) => a + b, 0) / medias.length).toFixed(1))
    : null;

  elCardMediaGeral.textContent = mediaGeral === null ? "—" : formatarNota(mediaGeral);

  // Total de faltas
  const totalFaltas = disciplinas.reduce((acc, d) => {
    return acc + d.faltas.filter((f) => typeof f === "number").reduce((a, b) => a + b, 0);
  }, 0);
  elCardTotalFaltas.textContent = String(totalFaltas);

  // Bom desempenho
  const bons = disciplinas.filter((d) => {
    const m = calcularMedia(d.notas);
    return m !== null && m >= 7;
  }).length;
  elCardBomDesempenho.textContent = String(bons);

  // Atenção
  const atencao = disciplinas.filter((d) => {
    const m = calcularMedia(d.notas);
    return m === null || m < 7;
  }).length;
  elCardAtencao.textContent = String(atencao);

  // Frequência (demonstrativa, preservada)
  elCardFrequencia.textContent = FREQUENCIA_DEMONSTRATIVA;
}

/* =========================================================
   RENDERIZAÇÃO — TABELA
   ========================================================= */
function atualizarTabela() {
  // Limpa antes de reconstruir para não duplicar
  elCorpoTabela.innerHTML = "";

  disciplinas.forEach((disciplina, index) => {
    const linha = document.createElement("tr");

    // Nome da disciplina (nunca editável)
    const tdNome = document.createElement("td");
    tdNome.textContent = disciplina.nome;
    linha.appendChild(tdNome);

    // Notas dos três trimestres
    for (let t = 0; t < 3; t++) {
      const td = document.createElement("td");
      if (modoEdicao) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "campo-edicao";
        input.dataset.tipo = "nota";
        input.dataset.index = String(index);
        input.dataset.trimestre = String(t);
        input.value = disciplina.notas[t] === null ? "" : formatarNota(disciplina.notas[t]);
        td.appendChild(input);
      } else {
        td.textContent = formatarNota(disciplina.notas[t]);
      }
      linha.appendChild(td);
    }

    // Média (somente leitura)
    const tdMedia = document.createElement("td");
    const media = calcularMedia(disciplina.notas);
    tdMedia.textContent = media === null ? "—" : formatarNota(media);
    linha.appendChild(tdMedia);

    // Faltas — exibidas como um único número somado, mas editáveis por trimestre
    const tdFaltas = document.createElement("td");
    if (modoEdicao) {
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.gap = "4px";
      wrapper.style.justifyContent = "center";
      for (let t = 0; t < 3; t++) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "campo-edicao";
        input.style.width = "44px";
        input.dataset.tipo = "falta";
        input.dataset.index = String(index);
        input.dataset.trimestre = String(t);
        input.value = typeof disciplina.faltas[t] === "number" ? String(disciplina.faltas[t]) : "";
        wrapper.appendChild(input);
      }
      tdFaltas.appendChild(wrapper);
    } else {
      tdFaltas.textContent = formatarFaltas(disciplina.faltas);
    }
    linha.appendChild(tdFaltas);

    // Situação
    const tdSituacao = document.createElement("td");
    const sit = classificarSituacao(media);
    const span = document.createElement("span");
    span.className = "situacao " + sit.classe;
    span.textContent = sit.texto;
    tdSituacao.appendChild(span);
    linha.appendChild(tdSituacao);

    elCorpoTabela.appendChild(linha);
  });
}

/* =========================================================
   RENDERIZAÇÃO GERAL
   ========================================================= */
function renderizarTudo() {
  atualizarCards();
  atualizarTabela();
  atualizarGraficos();
}

/* =========================================================
   MENSAGENS
   ========================================================= */
function mostrarMensagemAcesso(texto, tipo) {
  elMensagemAcesso.textContent = texto;
  elMensagemAcesso.className = "mensagem-acesso " + (tipo || "mensagem-info");
}

function mostrarMensagemBoletim(texto, tipo) {
  elMensagemBoletim.textContent = texto;
  elMensagemBoletim.className = "mensagem-boletim " + (tipo || "mensagem-info");
}

/* =========================================================
   ABRIR BOLETIM (POST)
   ========================================================= */
async function abrirBoletim() {
  const pinDigitado = elCampoPin.value.trim();

  if (pinDigitado === "") {
    mostrarMensagemAcesso("Digite o PIN para entrar.", "mensagem-erro");
    return;
  }

  elBotaoEntrar.disabled = true;
  mostrarMensagemAcesso("Conectando...", "mensagem-info");

  try {
    const resposta = await fetch(CONFIG_ALUNO.apiUrl + "/api/v1/boletins/abrir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turma: CONFIG_ALUNO.turma,
        numero_chamada: CONFIG_ALUNO.numeroChamada,
        pin: pinDigitado
      })
    });

    if (resposta.status === 401) {
      mostrarMensagemAcesso("Turma, chamada ou PIN inválidos.", "mensagem-erro");
      elBotaoEntrar.disabled = false;
      return;
    }

    if (resposta.status === 429) {
      mostrarMensagemAcesso("Muitas tentativas. Aguarde um minuto e tente novamente.", "mensagem-erro");
      elBotaoEntrar.disabled = false;
      return;
    }

    if (!resposta.ok) {
      mostrarMensagemAcesso("Não foi possível abrir o boletim. Tente novamente.", "mensagem-erro");
      elBotaoEntrar.disabled = false;
      return;
    }

    const json = await resposta.json();

    // Guarda o PIN somente em memória
    pinSessao = pinDigitado;

    // Limpa o campo do PIN após o login
    elCampoPin.value = "";

    // Decide a fonte dos dados: API > local
    if (json && json.dados && Array.isArray(json.dados.disciplinas)) {
      disciplinas = converterDadosDaApi(json.dados.disciplinas);
    } else {
      // Sem dados na API: usa as disciplinas locais do projeto
      disciplinas = clonarDisciplinasPadrao();
    }

    // Mostra a área do boletim
    elAcessoPin.classList.add("escondido");
    elAreaBoletim.classList.remove("escondido");

    renderizarTudo();
    mostrarMensagemBoletim("Boletim carregado.", "mensagem-ok");
  } catch (erro) {
    mostrarMensagemAcesso("Não foi possível conectar ao servidor. Tente novamente.", "mensagem-erro");
    elBotaoEntrar.disabled = false;
  }
}

/* Converte dados vindos da API para o formato interno */
function converterDadosDaApi(lista) {
  return lista.map((d) => {
    const notas = [
      normalizarNotaAntiga(d.notas ? d.notas[0] : null),
      normalizarNotaAntiga(d.notas ? d.notas[1] : null),
      normalizarNotaAntiga(d.notas ? d.notas[2] : null)
    ];
    const faltas = [
      typeof (d.faltas ? d.faltas[0] : null) === "number" ? d.faltas[0] : null,
      typeof (d.faltas ? d.faltas[1] : null) === "number" ? d.faltas[1] : null,
      typeof (d.faltas ? d.faltas[2] : null) === "number" ? d.faltas[2] : null
    ];
    return { nome: String(d.nome || "Disciplina"), notas, faltas };
  });
}

/* Cria uma cópia das disciplinas padrão para não modificar o original.
   Converte o formato antigo (disciplina / tri1 / tri2 / tri3 / faltas)
   para o formato interno (nome / notas[3] / faltas[3]). */
function clonarDisciplinasPadrao() {
  return DISCIPLINAS_PADRAO.map((d) => ({
    nome: d.disciplina,
    notas: [
      normalizarNotaAntiga(d.tri1),
      normalizarNotaAntiga(d.tri2),
      normalizarNotaAntiga(d.tri3)
    ],
    faltas: d.faltas.slice()
  }));
}

/* =========================================================
   EDITAR DADOS
   ========================================================= */
function ativarEdicao() {
  modoEdicao = true;
  elBotaoAlterar.classList.add("escondido");
  elBotaoSalvar.classList.remove("escondido");
  mostrarMensagemBoletim("Edite as notas e faltas. Depois clique em Salvar alterações.", "mensagem-info");
  renderizarTudo();
}

/* =========================================================
   LER CAMPOS DE EDIÇÃO E VALIDAR
   Retorna a nova lista ou null se houver campo inválido.
   ========================================================= */
function coletarDadosDaEdicao() {
  const camposNota = elCorpoTabela.querySelectorAll('input[data-tipo="nota"]');
  const camposFalta = elCorpoTabela.querySelectorAll('input[data-tipo="falta"]');

  let valido = true;

  // Primeiro limpa qualquer marcação de inválido
  elCorpoTabela.querySelectorAll(".campo-edicao").forEach((c) => {
    c.classList.remove("invalido");
  });

  // Valida notas
  camposNota.forEach((campo) => {
    const valor = normalizarNotaDigitada(campo.value);
    if (valor === "INVALIDO") {
      campo.classList.add("invalido");
      valido = false;
    }
  });

  // Valida faltas
  camposFalta.forEach((campo) => {
    const valor = normalizarFaltaDigitada(campo.value);
    if (valor === "INVALIDO") {
      campo.classList.add("invalido");
      valido = false;
    }
  });

  if (!valido) return null;

  // Monta nova lista de disciplinas
  const novo = disciplinas.map((d) => ({
    nome: d.nome,
    notas: [null, null, null],
    faltas: [null, null, null]
  }));

  camposNota.forEach((campo) => {
    const i = Number(campo.dataset.index);
    const t = Number(campo.dataset.trimestre);
    novo[i].notas[t] = normalizarNotaDigitada(campo.value);
  });

  camposFalta.forEach((campo) => {
    const i = Number(campo.dataset.index);
    const t = Number(campo.dataset.trimestre);
    novo[i].faltas[t] = normalizarFaltaDigitada(campo.value);
  });

  return novo;
}

/* =========================================================
   SALVAR (PUT)
   ========================================================= */
async function salvarDados() {
  const novosDados = coletarDadosDaEdicao();

  if (novosDados === null) {
    mostrarMensagemBoletim("Há campos inválidos. Corrija antes de salvar.", "mensagem-erro");
    return;
  }

  elBotaoSalvar.disabled = true;
  mostrarMensagemBoletim("Salvando...", "mensagem-info");

  // Converte notas/faltas ausentes (null) para 0 apenas no que vai para a API.
  // O estado interno (tabela, cards, gráficos) continua usando null normalmente.
  const disciplinasParaEnviar = novosDados.map((d) => ({
    nome: d.nome,
    notas: d.notas.map((n) => (n === null ? 0 : n)),
    faltas: d.faltas.map((f) => (f === null ? 0 : f))
  }));

  try {
    const resposta = await fetch(CONFIG_ALUNO.apiUrl + "/api/v1/boletins/salvar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turma: CONFIG_ALUNO.turma,
        numero_chamada: CONFIG_ALUNO.numeroChamada,
        pin: pinSessao,
        dados: {
          disciplinas: disciplinasParaEnviar
        }
      })
    });

    if (resposta.status === 401) {
      mostrarMensagemBoletim("Sessão expirada. Entre novamente.", "mensagem-erro");
      elBotaoSalvar.disabled = false;
      return;
    }

    if (resposta.status === 429) {
      mostrarMensagemBoletim("Muitas tentativas. Aguarde um minuto e tente novamente.", "mensagem-erro");
      elBotaoSalvar.disabled = false;
      return;
    }

    if (!resposta.ok) {
      mostrarMensagemBoletim("Não foi possível salvar. Tente novamente.", "mensagem-erro");
      elBotaoSalvar.disabled = false;
      return;
    }

    // Atualiza o estado local com os dados salvos
    disciplinas = novosDados;

    // Sai do modo edição
    modoEdicao = false;
    elBotaoSalvar.classList.add("escondido");
    elBotaoAlterar.classList.remove("escondido");
    elBotaoSalvar.disabled = false;

    renderizarTudo();
    mostrarMensagemBoletim("Dados salvos com sucesso.", "mensagem-ok");
  } catch (erro) {
    mostrarMensagemBoletim("Não foi possível conectar ao servidor. Tente novamente.", "mensagem-erro");
    elBotaoSalvar.disabled = false;
  }
}

/* =========================================================
   GRÁFICOS — SOMENTE LEITURA
   Usam a variável global `disciplinas` já carregada.
   Não alteram dados, notas, faltas nem o payload da API.
   ========================================================= */

/* Paleta e opções visuais reaproveitadas pelos 3 gráficos */
const COR_ROXO = "#8b5cf6";
const COR_ROXO_CLARO = "rgba(139, 92, 246, 0.55)";
const COR_DOURADO = "#facc15";
const COR_DOURADO_CLARO = "rgba(250, 204, 21, 0.55)";
const COR_TEXTO = "#e5e5f0";
const COR_TEXTO_SUAVE = "#a1a1b5";
const COR_GRADE = "rgba(46, 46, 64, 0.6)";

function opcoesBaseGrafico() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1e1e2a",
        titleColor: COR_TEXTO,
        bodyColor: COR_TEXTO,
        borderColor: "#2e2e40",
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { color: COR_TEXTO_SUAVE, font: { size: 11 } },
        grid: { color: COR_GRADE }
      },
      y: {
        ticks: { color: COR_TEXTO_SUAVE, font: { size: 11 } },
        grid: { color: COR_GRADE }
      }
    }
  };
}

/* ---------- GRÁFICO 1: MÉDIA POR DISCIPLINA ---------- */
function atualizarGraficoMedias() {
  const canvas = document.getElementById("graficoMediasDisciplinas");
  if (!canvas) return;

  // Copia para não tocar no estado original
  const copia = disciplinas.map((d) => ({ nome: d.nome, notas: d.notas.slice() }));
  const labels = copia.map((d) => d.nome);
  const valores = copia.map((d) => calcularMedia(d.notas));

  if (graficoMedias) graficoMedias.destroy();

  const opcoes = opcoesBaseGrafico();
  opcoes.indexAxis = "y";
  opcoes.scales.x = {
    min: 0,
    max: 10,
    ticks: { color: COR_TEXTO_SUAVE, font: { size: 11 }, stepSize: 2 },
    grid: { color: COR_GRADE }
  };
  opcoes.scales.y = {
    ticks: { color: COR_TEXTO, font: { size: 11 } },
    grid: { display: false }
  };
  opcoes.plugins.tooltip.callbacks = {
    label: function (contexto) {
      const valor = contexto.parsed.x;
      if (valor === null || valor === undefined) return "Sem nota";
      return "Média: " + Number(valor).toFixed(1).replace(".", ",");
    }
  };

  graficoMedias = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Média",
          data: valores,
          backgroundColor: COR_ROXO_CLARO,
          borderColor: COR_ROXO,
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: opcoes
  });
}

/* ---------- GRÁFICO 2: EVOLUÇÃO DA MÉDIA GERAL ---------- */
function atualizarGraficoEvolucao() {
  const canvas = document.getElementById("graficoEvolucaoTrimestres");
  if (!canvas) return;

  function mediaDoTrimestre(indice) {
    const notas = disciplinas
      .map((d) => d.notas[indice])
      .filter((n) => typeof n === "number");
    if (notas.length === 0) return null;
    const soma = notas.reduce((a, b) => a + b, 0);
    return Number((soma / notas.length).toFixed(1));
  }

  const valores = [mediaDoTrimestre(0), mediaDoTrimestre(1), mediaDoTrimestre(2)];

  if (graficoEvolucao) graficoEvolucao.destroy();

  const opcoes = opcoesBaseGrafico();
  opcoes.scales.y = {
    min: 0,
    max: 10,
    ticks: { color: COR_TEXTO_SUAVE, font: { size: 11 }, stepSize: 2 },
    grid: { color: COR_GRADE }
  };
  opcoes.scales.x = {
    ticks: { color: COR_TEXTO, font: { size: 12 } },
    grid: { display: false }
  };
  opcoes.plugins.tooltip.callbacks = {
    label: function (contexto) {
      const valor = contexto.parsed.y;
      if (valor === null || valor === undefined) return "Sem nota";
      return "Média: " + Number(valor).toFixed(1).replace(".", ",");
    }
  };

  graficoEvolucao = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: ["1º Tri", "2º Tri", "3º Tri"],
      datasets: [8,2
        {
          label: "Média geral",
          data: valores,
          borderColor: COR_DOURADO,
          backgroundColor: COR_DOURADO_CLARO,
          pointBackgroundColor: COR_DOURADO,
          pointBorderColor: "#12121a",
          pointRadius: 5,
          tension: 0.3,
          fill: false,
          spanGaps: false
        }
      ]
    },
    options: opcoes
  });
}

/* ---------- GRÁFICO 3: FALTAS POR TRIMESTRE ---------- */
function atualizarGraficoFaltas() {
  const canvas = document.getElementById("graficoFaltasTrimestres");
  if (!canvas) return;

  function somaFaltasDoTrimestre(indice) {
    return disciplinas.reduce((acc, d) => {
      const f = d.faltas[indice];
      return acc + (typeof f === "number" ? f : 0);
    }, 0);
  }

  const f1 = somaFaltasDoTrimestre(0);
  const f2 = somaFaltasDoTrimestre(1);
  const f3 = somaFaltasDoTrimestre(2);
  const totalInterno = f1 + f2 + f3;

  // Badge Perigo (sem mostrar 350 nem qualquer explicação)
  if (elEstadoFaltas) {
    elEstadoFaltas.innerHTML = "";
    if (totalInterno >= REFERENCIA_TOTAL_FALTAS) {
      const badge = document.createElement("span");
      badge.className = "badge-perigo";
      badge.textContent = "Perigo";
      elEstadoFaltas.appendChild(badge);
      if (elCardGraficoFaltas) elCardGraficoFaltas.classList.add("perigo");
    } else {
      if (elCardGraficoFaltas) elCardGraficoFaltas.classList.remove("perigo");
    }
  }

  if (graficoFaltas) graficoFaltas.destroy();

  const opcoes = opcoesBaseGrafico();
  opcoes.scales.y = {
    beginAtZero: true,
    ticks: { color: COR_TEXTO_SUAVE, font: { size: 11 }, precision: 0 },
    grid: { color: COR_GRADE }
  };
  opcoes.scales.x = {
    ticks: { color: COR_TEXTO, font: { size: 12 } },
    grid: { display: false }
  };
  opcoes.plugins.tooltip.callbacks = {
    label: function (contexto) {
      return contexto.parsed.y + " faltas";
    }
  };

  graficoFaltas = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: ["1º Tri", "2º Tri", "3º Tri"],
      datasets: [
        {
          label: "Faltas",
          data: [f1, f2, f3],
          backgroundColor: totalInterno >= REFERENCIA_TOTAL_FALTAS
            ? "rgba(248, 113, 113, 0.55)"
            : COR_ROXO_CLARO,
          borderColor: totalInterno >= REFERENCIA_TOTAL_FALTAS
            ? "#f87171"
            : COR_ROXO,
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: opcoes
  });
}

/* Atualiza os três gráficos (somente leitura) */
function atualizarGraficos() {
  atualizarGraficoMedias();
  atualizarGraficoEvolucao();
  atualizarGraficoFaltas();
}

/* =========================================================
   EVENTOS
   ========================================================= */
elBotaoEntrar.addEventListener("click", abrirBoletim);

elCampoPin.addEventListener("keydown", (e) => {
  if (e.key === "Enter") abrirBoletim();
});

elBotaoAlterar.addEventListener("click", ativarEdicao);
elBotaoSalvar.addEventListener("click", salvarDados);

/* Garante que a tela de PIN comece visível e o boletim escondido */
elAcessoPin.classList.remove("escondido");
elAreaBoletim.classList.add("escondido");