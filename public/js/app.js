/**
 * Integrador Sankhya - Lógica do Frontend (Vanilla JS)
 * Consulta direta ao ERP Sankhya via Sandbox com seleção dinâmica de TOPs,
 * modais paginados de clientes e produtos, e validação local de pedidos.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================
  // ESTADO GLOBAL DA APLICAÇÃO
  // ==========================================================
  const state = {
    itens: [],
    clienteSelecionado: null,
    tops: [],               // TOPs carregadas de GET /api/tops
    topSelecionada: null,   // objeto TOP completo (com compatibilidade e nota modelo)
    topSugerida: null,
    indiceAtivo: -1,        // opção destacada no combobox da TOP (teclado)
    isSubmitting: false,

    // Estado do Modal de Clientes
    modalClientes: {
      page: 0,
      sortOrder: 'ASC',
      temMaisRegistros: false,
      carregando: false,
      clientes: [],
      termoBusca: ''
    },

    // Estado do Modal de Produtos
    modalProdutos: {
      page: 0,
      temMaisRegistros: false,
      carregando: false,
      produtos: [],
      termoBusca: ''
    }
  };

  // ==========================================================
  // ELEMENTOS DO DOM
  // ==========================================================
  // Status Sandbox
  const statusDot = document.getElementById('statusDot');
  const statusTitle = document.getElementById('statusTitle');
  const statusDetail = document.getElementById('statusDetail');
  const btnTestarConexao = document.getElementById('btnTestarConexao');

  // Cliente (Passo 1)
  const inputCodParc = document.getElementById('inputCodParc');
  const btnAbrirModalClientes = document.getElementById('btnAbrirModalClientes');
  const btnConsultarCliente = document.getElementById('btnConsultarCliente');
  const clientInfoPanel = document.getElementById('clientInfoPanel');
  const clientTypeBadge = document.getElementById('clientTypeBadge');
  const clientNome = document.getElementById('clientNome');
  const clientCpfCnpj = document.getElementById('clientCpfCnpj');
  const clientEndereco = document.getElementById('clientEndereco');

  // Modal de Pesquisa de Clientes
  const modalPesquisaClientes = document.getElementById('modalPesquisaClientes');
  const btnFecharModalClientes = document.getElementById('btnFecharModalClientes');
  const btnCancelarModalClientes = document.getElementById('btnCancelarModalClientes');
  const inputBuscaClienteModal = document.getElementById('inputBuscaClienteModal');
  const btnClearBuscaCliente = document.getElementById('btnClearBuscaCliente');
  const btnBuscarClienteModal = document.getElementById('btnBuscarClienteModal');
  const selectOrdemClientes = document.getElementById('selectOrdemClientes');
  const btnRecarregarClientesModal = document.getElementById('btnRecarregarClientesModal');
  const clientesLoadingOverlay = document.getElementById('clientesLoadingOverlay');
  const clientesModalTableBody = document.getElementById('clientesModalTableBody');
  const clientesEmptyState = document.getElementById('clientesEmptyState');
  const clientesEmptySubtext = document.getElementById('clientesEmptySubtext');
  const btnClientePagAnterior = document.getElementById('btnClientePagAnterior');
  const btnClientePagProxima = document.getElementById('btnClientePagProxima');
  const clientePaginaInfo = document.getElementById('clientePaginaInfo');

  // Tipo de Operação (Passo 2)
  const inputTopBusca = document.getElementById('inputTopBusca');
  const topListbox = document.getElementById('topListbox');
  const topLoadStatus = document.getElementById('topLoadStatus');
  const btnRecarregarTops = document.getElementById('btnRecarregarTops');
  const topSelecionadaPanel = document.getElementById('topSelecionadaPanel');
  const topSelCodigo = document.getElementById('topSelCodigo');
  const topSelNome = document.getElementById('topSelNome');
  const topSelBadges = document.getElementById('topSelBadges');
  const topSelPendencias = document.getElementById('topSelPendencias');

  // Produtos e Itens (Passo 3)
  const formAdicionarItem = document.getElementById('formAdicionarItem');
  const inputCodProd = document.getElementById('inputCodProd');
  const btnAbrirModalProdutos = document.getElementById('btnAbrirModalProdutos');
  const produtoInfoHint = document.getElementById('produtoInfoHint');
  const inputQuantidade = document.getElementById('inputQuantidade');
  const inputValorUnitario = document.getElementById('inputValorUnitario');
  const inputLocalEstoque = document.getElementById('inputLocalEstoque');
  const inputControle = document.getElementById('inputControle');
  const localEstoqueHint = document.getElementById('localEstoqueHint');
  const controleHint = document.getElementById('controleHint');
  const itensTableBody = document.getElementById('itensTableBody');
  const emptyRow = document.getElementById('emptyRow');
  const itemCountBadge = document.getElementById('itemCountBadge');

  // Modal de Pesquisa de Produtos
  const modalPesquisaProdutos = document.getElementById('modalPesquisaProdutos');
  const btnFecharModalProdutos = document.getElementById('btnFecharModalProdutos');
  const btnCancelarModalProdutos = document.getElementById('btnCancelarModalProdutos');
  const inputBuscaProdutoModal = document.getElementById('inputBuscaProdutoModal');
  const btnClearBuscaProduto = document.getElementById('btnClearBuscaProduto');
  const btnBuscarProdutoModal = document.getElementById('btnBuscarProdutoModal');
  const btnRecarregarProdutosModal = document.getElementById('btnRecarregarProdutosModal');
  const produtosLoadingOverlay = document.getElementById('produtosLoadingOverlay');
  const produtosModalTableBody = document.getElementById('produtosModalTableBody');
  const produtosEmptyState = document.getElementById('produtosEmptyState');
  const produtosEmptySubtext = document.getElementById('produtosEmptySubtext');
  const btnProdutoPagAnterior = document.getElementById('btnProdutoPagAnterior');
  const btnProdutoPagProxima = document.getElementById('btnProdutoPagProxima');
  const produtoPaginaInfo = document.getElementById('produtoPaginaInfo');

  // Resumo e Ação de Pedido (Passo 4)
  const selectTipoPagamento = document.getElementById('selectTipoPagamento');
  const inputDataVencimento = document.getElementById('inputDataVencimento');
  const summaryTop = document.getElementById('summaryTop');
  const summaryNotaModelo = document.getElementById('summaryNotaModelo');
  const summaryTotalItens = document.getElementById('summaryTotalItens');
  const summaryTotalValor = document.getElementById('summaryTotalValor');
  const btnGerarPedido = document.getElementById('btnGerarPedido');
  const orderActionNote = document.getElementById('orderActionNote');

  // Modal de Confirmação/Validação de Pedido
  const confirmModal = document.getElementById('confirmModal');
  const btnFecharModal = document.getElementById('btnFecharModal');
  const btnCancelarModal = document.getElementById('btnCancelarModal');
  const modalCodParc = document.getElementById('modalCodParc');
  const modalTop = document.getElementById('modalTop');
  const modalNotaModelo = document.getElementById('modalNotaModelo');
  const modalEmpresa = document.getElementById('modalEmpresa');
  const modalEmpresaNegociacao = document.getElementById('modalEmpresaNegociacao');
  const modalTipoVenda = document.getElementById('modalTipoVenda');
  const modalTotalItens = document.getElementById('modalTotalItens');
  const modalTotalValor = document.getElementById('modalTotalValor');
  const modalJsonPreview = document.getElementById('modalJsonPreview');
  const modalAvisos = document.getElementById('modalAvisos');

  // Salvaguarda e Envio ao Sandbox
  const chkConfirmarEnvioSandbox = document.getElementById('chkConfirmarEnvioSandbox');
  const envioResultadoPanel = document.getElementById('envioResultadoPanel');
  const envioResultadoIcon = document.getElementById('envioResultadoIcon');
  const envioResultadoTitulo = document.getElementById('envioResultadoTitulo');
  const envioResultadoStatusBadge = document.getElementById('envioResultadoStatusBadge');
  const rowNunotaRetornado = document.getElementById('rowNunotaRetornado');
  const txtNunotaRetornado = document.getElementById('txtNunotaRetornado');
  const envioResultadoMensagem = document.getElementById('envioResultadoMensagem');
  const envioResultadoJson = document.getElementById('envioResultadoJson');
  const btnConfirmarEmissao = document.getElementById('btnConfirmarEmissao');

  // ==========================================================
  // FORMATADORES E UTILITÁRIOS
  // ==========================================================
  const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  const formatadorNumero = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const rotuloTop = (t) => `${t.codigoTipoOperacao} - ${t.nome || 'Sem descrição'}`;

  // ==========================================================
  // NOTIFICAÇÕES TOAST (COM DEDUPLICAÇÃO)
  // ==========================================================
  const toastsRecentes = new Map();

  function showToast(mensagem, tipo = 'info', duracao = 4500) {
    const agora = Date.now();
    const chave = `${tipo}:${mensagem}`;
    if (toastsRecentes.has(chave) && (agora - toastsRecentes.get(chave) < 2500)) {
      return; // Previne mensagens duplicadas na tela
    }
    toastsRecentes.set(chave, agora);

    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;

    let icone = 'ℹ️';
    if (tipo === 'success') icone = '✅';
    if (tipo === 'error') icone = '❌';

    const iconeEl = document.createElement('span');
    iconeEl.textContent = icone;
    const textoEl = document.createElement('span');
    textoEl.textContent = mensagem;
    toast.append(iconeEl, textoEl);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duracao);
  }

  // ==========================================================
  // VERIFICAÇÃO DE STATUS DO BACKEND
  // ==========================================================
  async function verificarStatusBackend() {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();

      if (!data.sucesso) {
        throw new Error(data.mensagem || 'Falha ao consultar status');
      }

      const status = data.status;
      if (!status.configurado) {
        statusDot.className = 'status-dot status-offline';
        statusTitle.textContent = 'Credenciais Pendentes';
        statusDetail.textContent = `Configure no .env: ${status.variaveisAusentes.join(', ')}`;
        return false;
      }

      if (status.tokenAtivo) {
        statusDot.className = 'status-dot status-online';
        statusTitle.textContent = 'Sandbox Conectado';
        statusDetail.textContent = `Token ativo (${status.segundosRestantes}s restantes)`;
      } else {
        statusDot.className = 'status-dot status-checking';
        statusTitle.textContent = 'Credenciais Configuradas';
        statusDetail.textContent = 'Pronto para autenticar via OAuth 2.0';
      }
      return true;
    } catch (err) {
      statusDot.className = 'status-dot status-offline';
      statusTitle.textContent = 'Servidor Indisponível';
      statusDetail.textContent = 'Não foi possível conectar ao backend local';
      return false;
    }
  }

  // Teste de conexão manual
  btnTestarConexao.addEventListener('click', async () => {
    btnTestarConexao.disabled = true;
    statusDot.className = 'status-dot status-checking';
    statusTitle.textContent = 'Testando conexão...';
    statusDetail.textContent = 'Autenticando e consultando parceiros clientes no Sandbox';

    try {
      const res = await fetch('/api/conexao/test', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.sucesso) {
        throw new Error(data.mensagem || 'Falha ao conectar ao Sandbox');
      }

      statusDot.className = 'status-dot status-online';
      statusTitle.textContent = 'Sandbox 100% Operacional';
      statusDetail.textContent = `Autenticado! ${data.dados.totalClientesRetornados} clientes retornados na pág. 1`;
      showToast('Conexão e consulta de clientes realizadas com sucesso no Sandbox!', 'success');
    } catch (err) {
      statusDot.className = 'status-dot status-offline';
      statusTitle.textContent = 'Falha de Conexão';
      statusDetail.textContent = err.message;
      showToast(err.message, 'error', 6000);
    } finally {
      btnTestarConexao.disabled = false;
    }
  });

  // ==========================================================
  // CONSULTA DIRETA DE CLIENTE (CODPARC)
  // ==========================================================
  async function aplicarClienteSelecionado(cliente, exibirToast = true) {
    state.clienteSelecionado = cliente;
    inputCodParc.value = cliente.codigoCliente;

    clientTypeBadge.textContent = cliente.tipo === 'J' ? 'PJ' : 'PF';
    clientNome.textContent = cliente.nome || cliente.razao || `Parceiro ${cliente.codigoCliente}`;
    clientCpfCnpj.textContent = cliente.cnpjCpf || 'Não informado';
    clientEndereco.textContent = cliente.enderecoCompleto || 'Endereço não cadastrado';

    clientInfoPanel.classList.remove('hidden');
    atualizarEstadoBotaoGerar();

    if (exibirToast) {
      showToast(`Cliente "${clientNome.textContent}" selecionado!`, 'success');
    }
  }

  async function consultarClientePorCodigo() {
    const codParc = parseInt(inputCodParc.value, 10);
    if (!codParc || codParc <= 0) {
      showToast('Informe um código de cliente válido (número positivo).', 'error');
      inputCodParc.focus();
      return;
    }

    btnConsultarCliente.disabled = true;
    btnConsultarCliente.textContent = 'Buscando...';

    try {
      const response = await fetch(`/api/clientes/${codParc}`);
      const data = await response.json();

      if (!response.ok || !data.sucesso) {
        throw new Error(data.mensagem || `Cliente ${codParc} não localizado.`);
      }

      aplicarClienteSelecionado(data.cliente, true);
    } catch (err) {
      state.clienteSelecionado = null;
      clientInfoPanel.classList.add('hidden');
      showToast(err.message, 'error');
    } finally {
      btnConsultarCliente.disabled = false;
      btnConsultarCliente.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        Consultar
      `;
      atualizarEstadoBotaoGerar();
    }
  }

  btnConsultarCliente.addEventListener('click', consultarClientePorCodigo);
  inputCodParc.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      consultarClientePorCodigo();
    }
  });

  inputCodParc.addEventListener('input', () => {
    if (state.clienteSelecionado && Number(inputCodParc.value) !== state.clienteSelecionado.codigoCliente) {
      state.clienteSelecionado = null;
      clientInfoPanel.classList.add('hidden');
    }
    atualizarEstadoBotaoGerar();
  });

  // ==========================================================
  // MODAL DE PESQUISA DE CLIENTES (GET /v1/parceiros/clientes)
  // ==========================================================
  function abrirModalClientes() {
    modalPesquisaClientes.classList.remove('hidden');
    inputBuscaClienteModal.value = state.modalClientes.termoBusca;
    btnClearBuscaCliente.classList.toggle('hidden', !state.modalClientes.termoBusca);
    carregarClientesModal();
    inputBuscaClienteModal.focus();
  }

  function fecharModalClientes() {
    modalPesquisaClientes.classList.add('hidden');
  }

  btnAbrirModalClientes.addEventListener('click', abrirModalClientes);
  btnFecharModalClientes.addEventListener('click', fecharModalClientes);
  btnCancelarModalClientes.addEventListener('click', fecharModalClientes);

  // Fecha modal ao clicar fora da caixa de diálogo
  modalPesquisaClientes.addEventListener('click', (e) => {
    if (e.target === modalPesquisaClientes) {
      fecharModalClientes();
    }
  });

  async function carregarClientesModal(resetPage = false) {
    const ms = state.modalClientes;
    if (ms.carregando) return;

    if (resetPage) {
      ms.page = 0;
    }

    ms.carregando = true;
    clientesLoadingOverlay.classList.remove('hidden');
    clientesEmptyState.classList.add('hidden');
    btnClientePagAnterior.disabled = true;
    btnClientePagProxima.disabled = true;

    try {
      const params = new URLSearchParams();
      params.append('page', ms.page);
      params.append('sortOrder', ms.sortOrder);
      if (ms.termoBusca.trim()) {
        params.append('termo', ms.termoBusca.trim());
      }

      const url = `/api/clientes?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.sucesso) {
        throw new Error(data.mensagem || 'Falha ao consultar clientes no Sankhya.');
      }

      ms.clientes = data.dados.clientes || [];
      ms.temMaisRegistros = Boolean(data.dados.temMaisRegistros);

      if (data.dados.buscaPorCodigo) {
        clientePaginaInfo.textContent = 'Busca por código (1 cliente)';
        btnClientePagAnterior.disabled = true;
        btnClientePagProxima.disabled = true;
      } else {
        clientePaginaInfo.textContent = `Página ${ms.page + 1} (${ms.clientes.length} clientes)`;
        btnClientePagAnterior.disabled = ms.page === 0;
        btnClientePagProxima.disabled = !ms.temMaisRegistros;
      }

      renderizarTabelaClientesModal();
    } catch (err) {
      showToast(err.message, 'error');
      clientesModalTableBody.replaceChildren();
      clientesEmptyState.classList.remove('hidden');
      clientesEmptySubtext.textContent = err.message;
    } finally {
      ms.carregando = false;
      clientesLoadingOverlay.classList.add('hidden');
    }
  }

  function renderizarTabelaClientesModal() {
    const ms = state.modalClientes;
    const termo = ms.termoBusca.trim().toLowerCase();

    let exibidos = ms.clientes;
    if (termo) {
      exibidos = ms.clientes.filter((c) => {
        const cod = String(c.codigoCliente || '');
        const nome = (c.nome || '').toLowerCase();
        const razao = (c.razao || '').toLowerCase();
        const cnpjCpf = (c.cnpjCpf || '').replace(/\D/g, '');
        const termoNum = termo.replace(/\D/g, '');
        return cod.includes(termo)
          || nome.includes(termo)
          || razao.includes(termo)
          || (termoNum && cnpjCpf.includes(termoNum));
      });
    }

    clientesModalTableBody.replaceChildren();

    if (exibidos.length === 0) {
      clientesEmptyState.classList.remove('hidden');
      clientesEmptySubtext.textContent = termo
        ? `Nenhum cliente corresponde a "${termo}". Tente navegar nas páginas ou pesquisar diretamente pelo código.`
        : 'Nenhum cliente retornado para esta página.';
      return;
    }

    clientesEmptyState.classList.add('hidden');

    exibidos.forEach((c) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="search-record-code font-mono">${c.codigoCliente}</td>
        <td>
          <div class="search-record-name">${c.nome || '-'}</div>
          ${c.cnpjCpf ? `<span class="search-record-sub font-mono">${c.cnpjCpf}</span>` : ''}
        </td>
        <td>
          <div class="search-record-name">${c.razao || c.nome || '-'}</div>
          ${c.cidade ? `<span class="search-record-sub">${c.cidade}${c.uf ? '/' + c.uf : ''}</span>` : ''}
        </td>
        <td class="text-center">
          <span class="badge ${c.ativo ? 'badge-success' : 'badge-danger'}">
            ${c.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td class="text-center">
          <button type="button" class="btn-select-record" data-cod="${c.codigoCliente}" title="Selecionar este cliente">
            Selecionar
          </button>
        </td>
      `;

      // Seleção ao clicar no botão ou na linha
      tr.querySelector('.btn-select-record').addEventListener('click', (e) => {
        e.stopPropagation();
        aplicarClienteSelecionado(c, true);
        fecharModalClientes();
      });

      tr.addEventListener('click', () => {
        aplicarClienteSelecionado(c, true);
        fecharModalClientes();
      });

      clientesModalTableBody.appendChild(tr);
    });
  }

  inputBuscaClienteModal.addEventListener('input', (e) => {
    state.modalClientes.termoBusca = e.target.value;
    btnClearBuscaCliente.classList.toggle('hidden', !e.target.value);
    renderizarTabelaClientesModal();
  });

  inputBuscaClienteModal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      carregarClientesModal(true);
    }
  });

  if (btnBuscarClienteModal) {
    btnBuscarClienteModal.addEventListener('click', () => {
      carregarClientesModal(true);
    });
  }

  btnClearBuscaCliente.addEventListener('click', () => {
    inputBuscaClienteModal.value = '';
    state.modalClientes.termoBusca = '';
    btnClearBuscaCliente.classList.add('hidden');
    carregarClientesModal(true);
    inputBuscaClienteModal.focus();
  });

  selectOrdemClientes.addEventListener('change', (e) => {
    state.modalClientes.sortOrder = e.target.value;
    state.modalClientes.page = 0; // Volta para a primeira página com a nova ordenação
    carregarClientesModal(true);
  });

  btnRecarregarClientesModal.addEventListener('click', () => carregarClientesModal(false));

  btnClientePagAnterior.addEventListener('click', () => {
    if (state.modalClientes.page > 0) {
      state.modalClientes.page--;
      carregarClientesModal();
    }
  });

  btnClientePagProxima.addEventListener('click', () => {
    if (state.modalClientes.temMaisRegistros) {
      state.modalClientes.page++;
      carregarClientesModal();
    }
  });

  // ==========================================================
  // TIPO DE OPERAÇÃO (TOP) - SELEÇÃO DINÂMICA
  // ==========================================================
  async function carregarTops(forcarAtualizacao = false) {
    inputTopBusca.disabled = true;
    btnRecarregarTops.disabled = true;
    topLoadStatus.className = 'field-hint';
    topLoadStatus.textContent = 'Consultando TOPs ativas de Pedido de Venda no Sankhya...';

    try {
      const response = await fetch(`/api/tops${forcarAtualizacao ? '?atualizar=1' : ''}`);
      const data = await response.json();

      if (!response.ok || !data.sucesso) {
        let msg = data.mensagem || `Falha ao carregar TOPs (HTTP ${response.status}).`;
        if (data.diagnostico) msg += ` ${data.diagnostico.motivo}`;
        throw new Error(msg);
      }

      state.tops = data.tops || [];
      state.topSugerida = data.topSugerida;

      if (state.tops.length === 0) {
        topLoadStatus.className = 'field-hint hint-warning';
        topLoadStatus.textContent = 'Nenhuma TOP ativa de Pedido de Venda foi retornada pelo Sankhya.';
        selecionarTop(null);
        return;
      }

      inputTopBusca.disabled = false;
      const prontas = state.tops.filter((t) => t.compatibilidade.prontaParaPedido).length;
      topLoadStatus.textContent = `${state.tops.length} TOP(s) de Pedido de Venda carregada(s) • ${prontas} com nota modelo configurada.`;

      // Preserva a seleção se já existir ou sugere conforme configuração no .env
      const atual = state.topSelecionada
        && state.tops.find((t) => t.codigoTipoOperacao === state.topSelecionada.codigoTipoOperacao);
      const sugerida = state.topSugerida && state.topSugerida.disponivel
        && state.tops.find((t) => t.codigoTipoOperacao === state.topSugerida.codigo);

      if (atual) {
        selecionarTop(atual);
      } else if (sugerida) {
        selecionarTop(sugerida);
        topLoadStatus.textContent += ` TOP ${sugerida.codigoTipoOperacao} sugerida inicialmente.`;
      } else {
        selecionarTop(null);
        if (state.topSugerida && state.topSugerida.codigo) {
          topLoadStatus.textContent += ` A TOP sugerida ${state.topSugerida.codigo} não está disponível; selecione uma TOP da lista.`;
        }
      }
    } catch (err) {
      state.tops = [];
      selecionarTop(null);
      topLoadStatus.className = 'field-hint hint-error';
      topLoadStatus.textContent = err.message;
    } finally {
      btnRecarregarTops.disabled = false;
    }
  }

  function filtrarTops(termo) {
    const t = termo.trim().toLowerCase();
    if (!t) return state.tops;
    return state.tops.filter((top) =>
      String(top.codigoTipoOperacao).includes(t) || (top.nome || '').toLowerCase().includes(t));
  }

  function abrirListaTops() {
    renderizarListaTops();
    topListbox.classList.remove('hidden');
    inputTopBusca.setAttribute('aria-expanded', 'true');
  }

  function fecharListaTops() {
    topListbox.classList.add('hidden');
    inputTopBusca.setAttribute('aria-expanded', 'false');
    inputTopBusca.removeAttribute('aria-activedescendant');
    state.indiceAtivo = -1;
  }

  function renderizarListaTops() {
    const termo = state.topSelecionada && inputTopBusca.value === rotuloTop(state.topSelecionada)
      ? ''
      : inputTopBusca.value;
    const resultados = filtrarTops(termo);
    topListbox.replaceChildren();

    if (resultados.length === 0) {
      const vazio = document.createElement('li');
      vazio.className = 'combo-empty';
      vazio.textContent = 'Nenhuma TOP encontrada para a pesquisa.';
      topListbox.appendChild(vazio);
      return;
    }

    resultados.forEach((top, idx) => {
      const li = document.createElement('li');
      li.id = `top-opt-${top.codigoTipoOperacao}`;
      li.className = 'combo-option';
      li.setAttribute('role', 'option');
      li.dataset.codigo = String(top.codigoTipoOperacao);
      const selecionada = state.topSelecionada && state.topSelecionada.codigoTipoOperacao === top.codigoTipoOperacao;
      li.setAttribute('aria-selected', selecionada ? 'true' : 'false');
      if (idx === state.indiceAtivo) li.classList.add('active');

      const codigo = document.createElement('span');
      codigo.className = 'combo-code font-mono';
      codigo.textContent = top.codigoTipoOperacao;

      const nome = document.createElement('span');
      nome.className = 'combo-name';
      nome.textContent = top.nome || 'Sem descrição';

      const estado = document.createElement('span');
      const pronta = top.compatibilidade.prontaParaPedido;
      estado.className = `combo-tag ${pronta ? 'tag-ok' : 'tag-warn'}`;
      estado.textContent = pronta ? `NM ${top.compatibilidade.notaModelo}` : 'Sem nota modelo';

      li.append(codigo, nome, estado);
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selecionarTop(top);
        fecharListaTops();
      });
      topListbox.appendChild(li);
    });
  }

  function moverDestaqueTops(delta) {
    const opcoes = topListbox.querySelectorAll('.combo-option');
    if (opcoes.length === 0) return;
    state.indiceAtivo = (state.indiceAtivo + delta + opcoes.length) % opcoes.length;
    opcoes.forEach((o, i) => o.classList.toggle('active', i === state.indiceAtivo));
    const ativa = opcoes[state.indiceAtivo];
    inputTopBusca.setAttribute('aria-activedescendant', ativa.id);
    ativa.scrollIntoView({ block: 'nearest' });
  }

  function selecionarTop(top) {
    state.topSelecionada = top;

    if (!top) {
      topSelecionadaPanel.classList.add('hidden');
      if (document.activeElement !== inputTopBusca) inputTopBusca.value = '';
      atualizarResumoTop();
      atualizarEstadoBotaoGerar();
      return;
    }

    inputTopBusca.value = rotuloTop(top);
    topSelCodigo.textContent = `TOP ${top.codigoTipoOperacao}`;
    topSelNome.textContent = top.nome || 'Sem descrição';

    const comp = top.compatibilidade;
    const badges = [
      { texto: top.ativo ? 'Ativa' : 'Inativa', ok: top.ativo },
      { texto: top.tipoMovimentoDescricao || `Tipo ${top.tipoMovimento}`, ok: top.tipoMovimento === 19 },
      { texto: comp.notaModelo ? `Nota modelo ${comp.notaModelo}` : 'Nota modelo não configurada', ok: Boolean(comp.notaModelo) }
    ];
    if (comp.codigoEmpresa) badges.push({ texto: `Empresa Doc: ${comp.codigoEmpresa}`, ok: true });
    if (comp.empresaNegociacao) badges.push({ texto: `Empresa Neg: ${comp.empresaNegociacao}`, ok: true });
    if (comp.tipoVenda) badges.push({ texto: `Tipo Venda: ${comp.tipoVenda}`, ok: true });

    topSelBadges.replaceChildren(...badges.map((b) => {
      const span = document.createElement('span');
      span.className = `badge ${b.ok ? 'badge-success' : 'badge-warning'}`;
      span.textContent = b.texto;
      return span;
    }));

    const mensagens = [
      ...comp.pendencias.map((p) => ({ texto: p, tipo: 'issue-error' })),
      ...comp.avisos.map((a) => ({ texto: a, tipo: 'issue-info' }))
    ];
    topSelPendencias.replaceChildren(...mensagens.map((m) => {
      const li = document.createElement('li');
      li.className = m.tipo;
      li.textContent = m.texto;
      return li;
    }));

    topSelecionadaPanel.classList.remove('hidden');
    atualizarResumoTop();
    atualizarEstadoBotaoGerar();
  }

  function atualizarResumoTop() {
    const top = state.topSelecionada;
    summaryTop.textContent = top ? rotuloTop(top) : 'Não selecionada';
    summaryNotaModelo.textContent = top && top.compatibilidade.notaModelo
      ? String(top.compatibilidade.notaModelo)
      : (top ? 'Não configurada' : '-');
  }

  inputTopBusca.addEventListener('focus', () => {
    inputTopBusca.select();
    abrirListaTops();
  });

  inputTopBusca.addEventListener('input', () => {
    if (state.topSelecionada && inputTopBusca.value !== rotuloTop(state.topSelecionada)) {
      state.topSelecionada = null;
      topSelecionadaPanel.classList.add('hidden');
      atualizarResumoTop();
      atualizarEstadoBotaoGerar();
    }
    state.indiceAtivo = -1;
    abrirListaTops();
  });

  inputTopBusca.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (topListbox.classList.contains('hidden')) abrirListaTops();
      moverDestaqueTops(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moverDestaqueTops(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opcoes = topListbox.querySelectorAll('.combo-option');
      const alvo = opcoes[state.indiceAtivo] || (opcoes.length === 1 ? opcoes[0] : null);
      if (alvo) {
        const top = state.tops.find((t) => String(t.codigoTipoOperacao) === alvo.dataset.codigo);
        selecionarTop(top);
        fecharListaTops();
      }
    } else if (e.key === 'Escape') {
      fecharListaTops();
    }
  });

  inputTopBusca.addEventListener('blur', () => {
    fecharListaTops();
    if (state.topSelecionada) {
      inputTopBusca.value = rotuloTop(state.topSelecionada);
    } else {
      inputTopBusca.value = '';
    }
  });

  btnRecarregarTops.addEventListener('click', () => carregarTops(true));

  // ==========================================================
  // MODAL DE PESQUISA DE PRODUTOS (GET /v1/produtos)
  // ==========================================================
  function abrirModalProdutos() {
    modalPesquisaProdutos.classList.remove('hidden');
    inputBuscaProdutoModal.value = state.modalProdutos.termoBusca;
    btnClearBuscaProduto.classList.toggle('hidden', !state.modalProdutos.termoBusca);
    carregarProdutosModal();
    inputBuscaProdutoModal.focus();
  }

  function fecharModalProdutos() {
    modalPesquisaProdutos.classList.add('hidden');
  }

  btnAbrirModalProdutos.addEventListener('click', abrirModalProdutos);
  btnFecharModalProdutos.addEventListener('click', fecharModalProdutos);
  btnCancelarModalProdutos.addEventListener('click', fecharModalProdutos);

  // Fecha modal ao clicar fora da caixa de diálogo
  modalPesquisaProdutos.addEventListener('click', (e) => {
    if (e.target === modalPesquisaProdutos) {
      fecharModalProdutos();
    }
  });

  async function carregarProdutosModal(resetPage = false, forcarRefresh = false) {
    const ms = state.modalProdutos;
    if (ms.carregando) return;

    if (resetPage) {
      ms.page = 0;
    }

    ms.carregando = true;
    produtosLoadingOverlay.classList.remove('hidden');
    produtosEmptyState.classList.add('hidden');
    btnProdutoPagAnterior.disabled = true;
    btnProdutoPagProxima.disabled = true;

    try {
      const params = new URLSearchParams();
      params.append('page', ms.page);
      if (ms.termoBusca.trim()) {
        params.append('termo', ms.termoBusca.trim());
      }
      if (forcarRefresh) {
        params.append('refresh', 'true');
      }

      const url = `/api/produtos?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.sucesso) {
        throw new Error(data.mensagem || 'Falha ao consultar produtos no Sankhya.');
      }

      ms.produtos = data.dados.produtos || [];
      ms.temMaisRegistros = Boolean(data.dados.temMaisRegistros);

      if (data.dados.buscaPorCodigo) {
        produtoPaginaInfo.textContent = 'Busca por código (1 resultado)';
        btnProdutoPagAnterior.disabled = true;
        btnProdutoPagProxima.disabled = true;
      } else {
        produtoPaginaInfo.textContent = `Página ${ms.page + 1} (${ms.produtos.length} produtos)`;
        btnProdutoPagAnterior.disabled = ms.page === 0;
        btnProdutoPagProxima.disabled = !ms.temMaisRegistros;
      }

      renderizarTabelaProdutosModal();
    } catch (err) {
      showToast(err.message, 'error');
      produtosModalTableBody.replaceChildren();
      produtosEmptyState.classList.remove('hidden');
      produtosEmptySubtext.textContent = err.message;
    } finally {
      ms.carregando = false;
      produtosLoadingOverlay.classList.add('hidden');
    }
  }

  function renderizarTabelaProdutosModal() {
    const ms = state.modalProdutos;
    const termo = ms.termoBusca.trim().toLowerCase();

    // Filtro adicional local sobre os itens carregados
    let exibidos = ms.produtos;
    if (termo) {
      exibidos = ms.produtos.filter((p) => {
        const cod = String(p.codigoProduto || '');
        const nome = (p.nome || '').toLowerCase();
        const comp = (p.complemento || '').toLowerCase();
        const ref = (p.referencia || '').toLowerCase();
        const vol = (p.volume || '').toLowerCase();
        const grupo = (p.nomeGrupoProduto || '').toLowerCase();
        return cod.includes(termo)
          || nome.includes(termo)
          || comp.includes(termo)
          || ref.includes(termo)
          || vol.includes(termo)
          || grupo.includes(termo);
      });
    }

    produtosModalTableBody.replaceChildren();

    if (exibidos.length === 0) {
      produtosEmptyState.classList.remove('hidden');
      produtosEmptySubtext.textContent = termo
        ? `Nenhum produto corresponde a "${termo}". Tente alterar o termo ou clicar em "Buscar" para pesquisar no servidor.`
        : 'Nenhum produto cadastrado retornado para esta página.';
      return;
    }

    produtosEmptyState.classList.add('hidden');

    exibidos.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="search-record-code font-mono">${p.codigoProduto}</td>
        <td>
          <div class="search-record-name">${p.nome || 'Sem descrição'}</div>
          ${p.complemento ? `<span class="search-record-sub">${p.complemento}</span>` : ''}
          ${p.nomeGrupoProduto ? `<span class="search-record-sub text-muted">Grupo: ${p.nomeGrupoProduto}</span>` : ''}
        </td>
        <td class="text-center font-mono font-bold">${p.volume || '-'}</td>
        <td class="text-center">
          <span class="badge ${p.ativo ? 'badge-success' : 'badge-danger'}">
            ${p.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td class="text-center">
          <button type="button" class="btn-select-record" data-cod="${p.codigoProduto}" title="Selecionar este produto">
            Selecionar
          </button>
        </td>
      `;

      tr.querySelector('.btn-select-record').addEventListener('click', (e) => {
        e.stopPropagation();
        aplicarProdutoSelecionado(p);
        fecharModalProdutos();
      });

      tr.addEventListener('click', () => {
        aplicarProdutoSelecionado(p);
        fecharModalProdutos();
      });

      produtosModalTableBody.appendChild(tr);
    });
  }

  function aplicarProdutoSelecionado(produto) {
    inputCodProd.value = produto.codigoProduto;
    produtoInfoHint.textContent = `${produto.nome} (${produto.volume || 'UN'}) - ${produto.ativo ? 'Ativo' : 'Inativo'}`;
    produtoInfoHint.style.color = produto.ativo ? '#818cf8' : '#f87171';

    // Seleção de local de estoque e controle
    if (produto.codigoLocalPadrao) {
      if (inputLocalEstoque) inputLocalEstoque.value = produto.codigoLocalPadrao;
      if (localEstoqueHint) localEstoqueHint.textContent = `Local padrão no ERP: ${produto.codigoLocalPadrao}`;
    } else if (Number(produto.codigoProduto) === 3) {
      if (inputLocalEstoque) inputLocalEstoque.value = '20000000';
      if (localEstoqueHint) localEstoqueHint.textContent = 'Local TGFEST na Empresa 4: 20000000 (CD)';
    }

    if (produto.controleSugerido) {
      if (inputControle) inputControle.value = produto.controleSugerido;
      if (controleHint) controleHint.textContent = `Controle no ERP: ${produto.controleSugerido}`;
    } else if (Number(produto.codigoProduto) === 3) {
      if (inputControle) inputControle.value = 'NL';
      if (controleHint) controleHint.textContent = 'Controle TGFEST na Empresa 4: NL';
    } else {
      if (inputControle) inputControle.value = '';
      if (controleHint) controleHint.textContent = 'Controle TGFEST (opcional, deixe vazio se não houver)';
    }

    if (produto.ativo) {
      showToast(`Produto ${produto.codigoProduto} selecionado: ${produto.nome}`, 'success');
    } else {
      showToast(`Produto ${produto.codigoProduto} selecionado (Atenção: produto marcado como Inativo no Sankhya)`, 'warning');
    }

    inputQuantidade.focus();
  }

  // Filtragem dinâmica e submissão de busca
  inputBuscaProdutoModal.addEventListener('input', (e) => {
    state.modalProdutos.termoBusca = e.target.value;
    btnClearBuscaProduto.classList.toggle('hidden', !e.target.value);
    renderizarTabelaProdutosModal();
  });

  inputBuscaProdutoModal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      carregarProdutosModal(true);
    }
  });

  if (btnBuscarProdutoModal) {
    btnBuscarProdutoModal.addEventListener('click', () => {
      carregarProdutosModal(true);
    });
  }

  btnClearBuscaProduto.addEventListener('click', () => {
    inputBuscaProdutoModal.value = '';
    state.modalProdutos.termoBusca = '';
    btnClearBuscaProduto.classList.add('hidden');
    carregarProdutosModal(true);
    inputBuscaProdutoModal.focus();
  });

  btnRecarregarProdutosModal.addEventListener('click', () => {
    carregarProdutosModal(false, true);
  });

  btnProdutoPagAnterior.addEventListener('click', () => {
    if (state.modalProdutos.page > 0) {
      state.modalProdutos.page--;
      carregarProdutosModal();
    }
  });

  btnProdutoPagProxima.addEventListener('click', () => {
    if (state.modalProdutos.temMaisRegistros) {
      state.modalProdutos.page++;
      carregarProdutosModal();
    }
  });

  // Consulta por código do produto ao digitar e sair do campo (blur/change)
  inputCodProd.addEventListener('change', async () => {
    const cod = parseInt(inputCodProd.value, 10);
    if (!cod || cod <= 0) {
      produtoInfoHint.textContent = 'Código numérico do produto (ou clique em Pesquisar)';
      produtoInfoHint.style.color = '';
      return;
    }

    produtoInfoHint.textContent = `Consultando produto ${cod} no Sankhya...`;
    produtoInfoHint.style.color = 'var(--text-muted)';

    try {
      const res = await fetch(`/api/produtos/${cod}`);
      const data = await res.json();
      if (res.ok && data.sucesso && data.produto) {
        const p = data.produto;
        produtoInfoHint.textContent = `${p.nome} (${p.volume || 'UN'}) - ${p.ativo ? 'Ativo' : 'Inativo'}`;
        produtoInfoHint.style.color = p.ativo ? '#818cf8' : '#f87171';

        if (p.codigoLocalPadrao) {
          if (inputLocalEstoque) inputLocalEstoque.value = p.codigoLocalPadrao;
          if (localEstoqueHint) localEstoqueHint.textContent = `Local padrão no ERP: ${p.codigoLocalPadrao}`;
        } else if (Number(p.codigoProduto) === 3) {
          if (inputLocalEstoque) inputLocalEstoque.value = '20000000';
          if (localEstoqueHint) localEstoqueHint.textContent = 'Local TGFEST na Empresa 4: 20000000 (CD)';
        }

        if (p.controleSugerido) {
          if (inputControle) inputControle.value = p.controleSugerido;
          if (controleHint) controleHint.textContent = `Controle no ERP: ${p.controleSugerido}`;
        } else if (Number(p.codigoProduto) === 3) {
          if (inputControle) inputControle.value = 'NL';
          if (controleHint) controleHint.textContent = 'Controle TGFEST na Empresa 4: NL';
        } else {
          if (inputControle) inputControle.value = '';
          if (controleHint) controleHint.textContent = 'Controle TGFEST (opcional, deixe vazio se não houver)';
        }
      } else {
        produtoInfoHint.textContent = data.mensagem || `Produto ${cod} não encontrado no Sankhya Sandbox.`;
        produtoInfoHint.style.color = '#f87171';
      }
    } catch {
      produtoInfoHint.textContent = 'Não foi possível validar o código do produto no momento.';
      produtoInfoHint.style.color = '#f87171';
    }
  });

  // ==========================================================
  // ADIÇÃO E GESTÃO DE ITENS DO PEDIDO
  // ==========================================================
  formAdicionarItem.addEventListener('submit', (e) => {
    e.preventDefault();

    const codProd = parseInt(inputCodProd.value, 10);
    const quantidade = parseFloat(inputQuantidade.value);
    const valorUnitario = parseFloat(inputValorUnitario.value);
    const localEstoqueRaw = inputLocalEstoque ? inputLocalEstoque.value.trim() : '';
    const localEstoque = parseInt(localEstoqueRaw, 10);
    const controle = inputControle ? inputControle.value.trim() : '';

    if (!codProd || codProd <= 0) {
      showToast('Informe um código de produto (CODPROD) válido.', 'error');
      inputCodProd.focus();
      return;
    }

    if (isNaN(quantidade) || quantidade <= 0) {
      showToast('A quantidade deve ser maior que zero.', 'error');
      inputQuantidade.focus();
      return;
    }

    if (isNaN(valorUnitario) || valorUnitario < 0) {
      showToast('O preço unitário deve ser maior ou igual a zero.', 'error');
      inputValorUnitario.focus();
      return;
    }

    if (isNaN(localEstoque) || localEstoque < 0) {
      showToast('Informe um local de estoque válido (número inteiro >= 0).', 'error');
      if (inputLocalEstoque) inputLocalEstoque.focus();
      return;
    }

    const subtotal = Math.round(quantidade * valorUnitario * 100) / 100;

    const novoItem = {
      id: Date.now() + Math.random(),
      sequencia: state.itens.length + 1,
      codigoProduto: codProd,
      descricao: produtoInfoHint.textContent !== 'Código numérico do produto (ou clique em Pesquisar)' ? produtoInfoHint.textContent : '',
      quantidade: quantidade,
      valorUnitario: valorUnitario,
      subtotal: subtotal,
      codigoLocalEstoque: localEstoque,
      controle: controle
    };

    state.itens.push(novoItem);
    renderizarTabelaItens();

    // Limpa campos para novo produto mantendo valores padrão seguros
    inputCodProd.value = '';
    inputValorUnitario.value = '';
    inputQuantidade.value = '1';
    produtoInfoHint.textContent = 'Código numérico do produto (ou clique em Pesquisar)';
    produtoInfoHint.style.color = '';
    inputCodProd.focus();

    showToast(`Produto ${codProd} adicionado ao pedido (Local: ${localEstoque}${controle ? `, Controle: ${controle}` : ''})!`, 'success');
  });

  function removerItem(id) {
    state.itens = state.itens.filter((item) => item.id !== id);
    // Reindexar sequência conforme documentação Sankhya (1, 2, 3...)
    state.itens.forEach((item, index) => {
      item.sequencia = index + 1;
    });
    renderizarTabelaItens();
    showToast('Item removido do pedido.', 'info');
  }

  function renderizarTabelaItens() {
    if (state.itens.length === 0) {
      emptyRow.classList.remove('hidden');
      const rows = itensTableBody.querySelectorAll('tr:not(#emptyRow)');
      rows.forEach((r) => r.remove());
    } else {
      emptyRow.classList.add('hidden');
      const rows = itensTableBody.querySelectorAll('tr:not(#emptyRow)');
      rows.forEach((r) => r.remove());

      state.itens.forEach((item) => {
        const localTexto = item.codigoLocalEstoque !== undefined ? String(item.codigoLocalEstoque) : '0';
        const controleBadge = item.controle
          ? `<span class="badge badge-info" style="font-size: 0.7rem; margin-left: 4px;">Ctrl: ${item.controle}</span>`
          : '<span class="text-muted" style="font-size: 0.72rem;">(Sem ctrl)</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="font-mono text-muted">${item.sequencia}</td>
          <td>
            <strong class="font-mono">${item.codigoProduto}</strong>
            ${item.descricao ? `<span class="search-record-sub">${item.descricao}</span>` : ''}
          </td>
          <td>
            <span class="font-mono font-bold">${localTexto}</span>
            ${controleBadge}
          </td>
          <td class="text-right font-mono">${formatadorNumero.format(item.quantidade)}</td>
          <td class="text-right font-mono">${formatadorMoeda.format(item.valorUnitario)}</td>
          <td class="text-right font-mono font-bold">${formatadorMoeda.format(item.subtotal)}</td>
          <td class="text-center">
            <button type="button" class="btn-remove-item" data-id="${item.id}" title="Remover item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </td>
        `;

        tr.querySelector('.btn-remove-item').addEventListener('click', () => {
          removerItem(item.id);
        });

        itensTableBody.appendChild(tr);
      });
    }

    const totalItens = state.itens.length;
    const totalValor = state.itens.reduce((acc, curr) => acc + curr.subtotal, 0);

    itemCountBadge.textContent = `${totalItens} ${totalItens === 1 ? 'item' : 'itens'}`;
    summaryTotalItens.textContent = String(totalItens);
    summaryTotalValor.textContent = formatadorMoeda.format(totalValor);

    atualizarEstadoBotaoGerar();
  }

  function atualizarEstadoBotaoGerar() {
    const codParc = parseInt(inputCodParc.value, 10);
    const temCliente = Boolean(codParc && codParc > 0);
    const temItens = state.itens.length > 0;
    const top = state.topSelecionada;
    const topPronta = Boolean(top && top.compatibilidade.prontaParaPedido);

    const pendencias = [];
    if (!temCliente) pendencias.push('informe o cliente (CODPARC)');
    if (!top) pendencias.push('escolha a TOP');
    if (!temItens) pendencias.push('adicione pelo menos um produto');

    if (pendencias.length === 0 && topPronta) {
      btnGerarPedido.disabled = false;
      orderActionNote.textContent = `Pronto para validar no backend com a TOP ${top.codigoTipoOperacao} e nota modelo ${top.compatibilidade.notaModelo}.`;
      orderActionNote.style.color = '#34d399';
      return;
    }

    btnGerarPedido.disabled = true;
    orderActionNote.style.color = 'var(--text-muted)';
    if (pendencias.length) {
      const texto = pendencias.join(', ');
      orderActionNote.textContent = texto.charAt(0).toUpperCase() + texto.slice(1) + '.';
    } else {
      orderActionNote.textContent = `A TOP ${top.codigoTipoOperacao} não está pronta para pedido: ${top.compatibilidade.pendencias.join(' ')}`;
      orderActionNote.style.color = 'var(--color-warning)';
    }
  }

  // ==========================================================
  // VALIDAÇÃO NO BACKEND + MODAL (NENHUM PEDIDO É GRAVADO)
  // ==========================================================
  btnGerarPedido.addEventListener('click', async () => {
    if (state.isSubmitting || !state.topSelecionada) return;

    state.isSubmitting = true;
    btnGerarPedido.disabled = true;
    const textoOriginal = btnGerarPedido.innerHTML;
    btnGerarPedido.textContent = 'Validando no backend...';

    const codParc = parseInt(inputCodParc.value, 10);
    const tipoPagamento = parseInt(selectTipoPagamento?.value, 10) || 16;
    const dataVencimento = (inputDataVencimento?.value || '').trim();

    const dadosEnvio = {
      codigoCliente: codParc,
      codigoTop: state.topSelecionada.codigoTipoOperacao,
      tipoPagamento: tipoPagamento,
      dataVencimento: dataVencimento,
      itens: state.itens.map((i) => ({
        codigoProduto: i.codigoProduto,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
        codigoLocalEstoque: i.codigoLocalEstoque,
        controle: i.controle
      }))
    };
    state.ultimoPedidoDados = dadosEnvio;

    try {
      const response = await fetch('/api/pedidos/preparar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosEnvio)
      });
      const data = await response.json();

      if (!response.ok || !data.sucesso) {
        throw new Error(data.mensagem || `Falha ao validar pedido (HTTP ${response.status}).`);
      }

      abrirModalConfirmacao(data, codParc);
      showToast(`Pedido validado com a TOP ${data.top.codigo}. Nada foi gravado no Sankhya.`, 'success', 6000);
    } catch (err) {
      showToast(err.message, 'error', 7000);
    } finally {
      state.isSubmitting = false;
      btnGerarPedido.innerHTML = textoOriginal;
      atualizarEstadoBotaoGerar();
    }
  });

  function abrirModalConfirmacao(resultado, codParc) {
    state.ultimoPedidoPreparado = resultado;
    const cliente = state.clienteSelecionado;

    modalCodParc.textContent = `${codParc}${cliente ? ` (${cliente.nome || cliente.razao})` : ''}`;
    modalTop.textContent = `${resultado.top.codigo} - ${resultado.top.descricao || 'Sem descrição'}`;
    modalNotaModelo.textContent = String(resultado.notaModelo);
    modalEmpresa.textContent = resultado.codigoEmpresa
      ? String(resultado.codigoEmpresa)
      : 'Definida pela nota modelo';
    if (modalEmpresaNegociacao) {
      modalEmpresaNegociacao.textContent = resultado.empresaNegociacao
        ? String(resultado.empresaNegociacao)
        : 'Definida pela nota modelo';
    }
    if (modalTipoVenda) {
      modalTipoVenda.textContent = resultado.tipoVenda
        ? String(resultado.tipoVenda)
        : 'Definido pela nota modelo';
    }
    modalTotalItens.textContent = String(resultado.totalItens);
    modalTotalValor.textContent = formatadorMoeda.format(resultado.totalEstimado);
    modalJsonPreview.textContent = JSON.stringify(resultado.payloadGerado, null, 2);

    const mensagens = [...(resultado.avisos || []), ...(resultado.pendenciasParaEnvio || [])];
    modalAvisos.replaceChildren(...mensagens.map((m) => {
      const li = document.createElement('li');
      li.textContent = m;
      return li;
    }));

    // Reset de estado da salvaguarda de envio
    if (chkConfirmarEnvioSandbox) chkConfirmarEnvioSandbox.checked = false;
    if (btnConfirmarEmissao) {
      btnConfirmarEmissao.disabled = true;
      btnConfirmarEmissao.textContent = 'Enviar Pedido ao Sankhya Sandbox';
    }
    if (envioResultadoPanel) envioResultadoPanel.classList.add('hidden');
    if (rowNunotaRetornado) rowNunotaRetornado.style.display = 'none';

    confirmModal.classList.remove('hidden');
    btnCancelarModal.focus();
  }

  function fecharModalConfirmacao() {
    confirmModal.classList.add('hidden');
  }

  btnFecharModal.addEventListener('click', fecharModalConfirmacao);
  btnCancelarModal.addEventListener('click', fecharModalConfirmacao);

  // Habilitação da gravação apenas com confirmação explícita
  if (chkConfirmarEnvioSandbox) {
    chkConfirmarEnvioSandbox.addEventListener('change', () => {
      if (btnConfirmarEmissao) {
        btnConfirmarEmissao.disabled = !chkConfirmarEnvioSandbox.checked;
      }
    });
  }

  // ==========================================================
  // ETAPA 2 & 3: ENVIO REAL E CONTROLADO AO SANKHYA SANDBOX
  // ==========================================================
  if (btnConfirmarEmissao) {
    btnConfirmarEmissao.addEventListener('click', async () => {
      if (!chkConfirmarEnvioSandbox || !chkConfirmarEnvioSandbox.checked) {
        showToast('Confirmação obrigatória: marque a caixa para autorizar o envio ao Sandbox.', 'warning');
        return;
      }

      if (!state.ultimoPedidoDados) {
        showToast('Nenhum pedido preparado. Valide o pedido novamente antes de enviar.', 'error');
        return;
      }

      // Salvaguardas: desabilitar botões para prevenir duplo clique ou reenvios em trânsito
      btnConfirmarEmissao.disabled = true;
      btnCancelarModal.disabled = true;
      btnFecharModal.disabled = true;
      chkConfirmarEnvioSandbox.disabled = true;

      envioResultadoPanel.classList.remove('hidden');
      envioResultadoIcon.textContent = '⏳';
      envioResultadoTitulo.textContent = 'Enviando ao Sankhya Sandbox...';
      envioResultadoStatusBadge.textContent = 'Em trânsito';
      envioResultadoStatusBadge.className = 'badge badge-warning';
      envioResultadoMensagem.textContent = 'Enviando POST para https://api.sandbox.sankhya.com.br/v1/vendas/pedidos. Aguarde a confirmação oficial do gateway...';
      envioResultadoJson.textContent = 'Aguardando resposta do ERP...';
      rowNunotaRetornado.style.display = 'none';

      try {
        const payloadEnvio = {
          ...state.ultimoPedidoDados,
          confirmacaoUsuario: true
        };

        const response = await fetch('/api/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadEnvio)
        });

        const data = await response.json();
        const httpStatus = data.statusHttp || response.status;

        envioResultadoStatusBadge.textContent = `HTTP ${httpStatus}`;
        envioResultadoJson.textContent = JSON.stringify(data.respostaSankhya || data, null, 2);

        if (response.ok && data.sucesso && data.criado) {
          envioResultadoIcon.textContent = '🎉';
          envioResultadoTitulo.textContent = 'Pedido Criado com Sucesso no Sankhya Sandbox!';
          envioResultadoStatusBadge.className = 'badge badge-success';
          envioResultadoMensagem.textContent = data.mensagem || 'O pedido foi aceito pelo ERP Sankhya e registrado com sucesso.';

          if (data.codigoPedido) {
            rowNunotaRetornado.style.display = 'flex';
            txtNunotaRetornado.textContent = String(data.codigoPedido);
          }

          showToast(`Pedido #${data.codigoPedido || ''} criado com sucesso no Sankhya Sandbox!`, 'success', 10000);
        } else {
          envioResultadoIcon.textContent = '❌';
          envioResultadoTitulo.textContent = 'Rejeição da API Sankhya Sandbox';
          envioResultadoStatusBadge.className = 'badge badge-danger';
          envioResultadoMensagem.textContent = data.mensagem || 'O pedido foi recusado pelo ERP Sankhya.';
          showToast(`Rejeição do Sankhya: ${data.mensagem}`, 'error', 10000);
        }
      } catch (err) {
        envioResultadoIcon.textContent = '⚠️';
        envioResultadoTitulo.textContent = 'Falha de Comunicação / Timeout';
        envioResultadoStatusBadge.textContent = 'TIMEOUT / ERRO REDE';
        envioResultadoStatusBadge.className = 'badge badge-danger';
        envioResultadoMensagem.textContent = `${err.message}. Por segurança contra duplicidade, o envio NÃO foi repetido automaticamente.`;
        envioResultadoJson.textContent = JSON.stringify({ erro: err.message }, null, 2);
        showToast(err.message, 'error', 10000);
      } finally {
        btnCancelarModal.disabled = false;
        btnFecharModal.disabled = false;
        chkConfirmarEnvioSandbox.disabled = false;
      }
    });
  }

  // Fechamento de qualquer modal aberto ao teclar ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!confirmModal.classList.contains('hidden')) fecharModalConfirmacao();
      if (!modalPesquisaClientes.classList.contains('hidden')) fecharModalClientes();
      if (!modalPesquisaProdutos.classList.contains('hidden')) fecharModalProdutos();
    }
  });

  // ==========================================================
  // INICIALIZAÇÃO
  // ==========================================================
  // Inicializa data de vencimento com data de hoje
  const hoje = new Date();
  const diaFmt = String(hoje.getDate()).padStart(2, '0');
  const mesFmt = String(hoje.getMonth() + 1).padStart(2, '0');
  const anoFmt = hoje.getFullYear();
  if (inputDataVencimento && !inputDataVencimento.value) {
    inputDataVencimento.value = `${diaFmt}/${mesFmt}/${anoFmt}`;
  }

  verificarStatusBackend();
  carregarTops();
});
