const config = require('../config/sankhya');
const authService = require('./authService');

/**
 * Erro de integração com informações úteis para o controller (status HTTP e diagnóstico),
 * sem jamais carregar tokens ou credenciais.
 */
class SankhyaApiError extends Error {
  constructor(mensagem, { statusHttp = 502, statusSankhya = null, diagnostico = null } = {}) {
    super(mensagem);
    this.name = 'SankhyaApiError';
    this.statusHttp = statusHttp;
    this.statusSankhya = statusSankhya;
    this.diagnostico = diagnostico;
  }
}

const NOMES_TIPO_MOVIMENTO = {
  19: 'Pedido de Venda'
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const MAX_PAGINAS = 20; // limite de segurança para a paginação

/**
 * Diagnóstico exibido quando o endpoint REST oficial não está acessível.
 * O fallback via CRUDServiceProvider.loadRecords (entidade TipoOperacao / tabela TGFTOP)
 * NÃO é executado automaticamente: precisa ser validado manualmente antes.
 */
function diagnosticoFallback(status) {
  if (![403, 404, 501].includes(status)) return null;
  return {
    fallbackExecutado: false,
    alternativaDocumentada: 'CRUDServiceProvider.loadRecords (entidade TipoOperacao / tabela TGFTOP), somente leitura',
    motivo: status === 403
      ? 'O usuário/aplicação de integração não tem permissão para GET /v1/tipos-operacao.'
      : 'O endpoint GET /v1/tipos-operacao não está disponível neste ambiente.',
    proximosPassos: [
      'Confirmar no Portal do Desenvolvedor se a aplicação possui o escopo exigido pela documentação (read:financeiro).',
      'Confirmar a versão do Sankhya Om do Sandbox.',
      'Somente após essa validação avaliar o uso do loadRecords, com permissão de leitura na TGFTOP.'
    ]
  };
}

class TopService {
  constructor() {
    this.cache = null; // { carregadoEm, tops, paginasLidas, estruturaResposta }
  }

  /**
   * Executa um GET autenticado no Sankhya e devolve { status, data }.
   */
  async _get(caminho) {
    if (!config.isSandbox()) {
      throw new SankhyaApiError(
        `Bloqueado: SANKHYA_API_URL (${config.sankhya.apiUrl}) não aponta para o Sandbox.`,
        { statusHttp: 403 }
      );
    }

    console.log(`[TopService] GET ${config.sankhya.apiUrl}${caminho}`);

    let response;
    try {
      response = await authService.executarRequisicao(caminho, { method: 'GET' });
    } catch (networkError) {
      throw new SankhyaApiError(`Falha de rede ao consultar o Sankhya: ${networkError.message}`, { statusHttp: 502 });
    }

    const texto = await response.text();
    let data;
    try {
      data = texto ? JSON.parse(texto) : null;
    } catch {
      data = { raw: texto.slice(0, 500) };
    }

    return { status: response.status, ok: response.ok, data };
  }

  /**
   * Extrai a mensagem de erro no formato documentado pela Sankhya (mensagem.descricao / error / message).
   */
  _mensagemErro(data, status) {
    if (!data) return `HTTP ${status}`;
    const m = data.mensagem || data.error || data.message;
    if (typeof m === 'string') return m;
    if (m && typeof m === 'object') return m.descricao || m.message || m.details || JSON.stringify(m);
    return `HTTP ${status}`;
  }

  /**
   * Localiza o array ou objeto de TOPs de forma defensiva para suportar envelopes
   * como { data: [...] } ou { data: { codigoTipoOperacao: ... } }.
   */
  _extrairLista(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];

    // Se data.data for um array direto
    if (Array.isArray(data.data)) return data.data;

    // Se data.data for um único objeto TipoOperacao (ex: GET /v1/tipos-operacao/{id})
    if (data.data && typeof data.data === 'object' && data.data.codigoTipoOperacao !== undefined) {
      return [data.data];
    }

    const candidatos = ['tiposOperacao', 'tipoOperacao', 'tipos', 'results', 'registros'];
    for (const chave of candidatos) {
      if (Array.isArray(data[chave])) return data[chave];
    }
    const primeiroArray = Object.values(data).find(Array.isArray);
    if (primeiroArray) return primeiroArray;

    // Resposta direta com um único objeto TipoOperacao
    if (data.codigoTipoOperacao !== undefined) return [data];
    return [];
  }

  /**
   * Normaliza apenas os campos documentados.
   */
  _normalizar(t) {
    return {
      codigoTipoOperacao: Number(t.codigoTipoOperacao),
      nome: t.nome ? String(t.nome).trim() : '',
      tipoMovimento: t.tipoMovimento !== undefined ? Number(t.tipoMovimento) : null,
      tipoMovimentoDescricao: NOMES_TIPO_MOVIMENTO[Number(t.tipoMovimento)] || null,
      ativo: t.ativo === true || t.ativo === 'S'
    };
  }

  /**
   * Avalia a compatibilidade da TOP com a criação de pedidos de venda.
   * Ser ativa e do tipo 19 é condição NECESSÁRIA, mas não SUFICIENTE:
   * também exigimos uma nota modelo explicitamente configurada para a TOP.
   */
  avaliarCompatibilidade(top) {
    const pendencias = [];
    const avisos = [];

    if (!top.ativo) pendencias.push('TOP inativa no Sankhya Om.');
    if (top.tipoMovimento !== config.sankhya.tipoMovimentoPedidoVenda) {
      pendencias.push(`Tipo de movimento ${top.tipoMovimento} não corresponde a Pedido de Venda (19).`);
    }

    const cfgNota = config.obterConfigNotaModelo(top.codigoTipoOperacao);
    if (!cfgNota) {
      pendencias.push(`Nenhuma nota modelo configurada para a TOP ${top.codigoTipoOperacao} em SANKHYA_NOTAS_MODELO.`);
    } else {
      avisos.push(
        `A nota modelo ${cfgNota.notaModelo} precisa ter sido cadastrada no Sankhya Om com a TOP ${top.codigoTipoOperacao}. ` +
        'Essa associação não pode ser verificada pela API REST e será confirmada pelo Sankhya na inclusão do pedido.'
      );
      if (cfgNota.codigoEmpresa) {
        avisos.push(`Empresa do documento (CODEMP): ${cfgNota.codigoEmpresa}.`);
      } else {
        avisos.push('A empresa do documento (CODEMP) será a definida na nota modelo, pois nenhuma empresa foi informada no mapeamento.');
      }
      if (cfgNota.empresaNegociacao) {
        avisos.push(`Empresa da negociação (CODEMPNEGOC): ${cfgNota.empresaNegociacao}.`);
      }
      if (cfgNota.tipoVenda) {
        avisos.push(`Tipo de negociação/venda (CODTIPVENDA): ${cfgNota.tipoVenda}.`);
      }
    }

    avisos.push('Regras fiscais, natureza, parceiro e estoque continuam sendo validadas pelo Sankhya Om.');

    const elegivel = top.ativo && top.tipoMovimento === config.sankhya.tipoMovimentoPedidoVenda;

    return {
      elegivelParaSelecao: elegivel,
      prontaParaPedido: elegivel && Boolean(cfgNota),
      notaModelo: cfgNota ? cfgNota.notaModelo : null,
      codigoEmpresa: cfgNota ? cfgNota.codigoEmpresa : null,
      empresaNegociacao: cfgNota ? cfgNota.empresaNegociacao : null,
      tipoVenda: cfgNota ? cfgNota.tipoVenda : null,
      pendencias,
      avisos
    };
  }

  /**
   * Lista TOPs de Pedido de Venda via endpoint oficial:
   * Tenta primeiramente com o filtro documentado ?tipoMovimento=19.
   * Caso o Gateway responda 404 por incompatibilidade de parâmetro de query,
   * pagina o endpoint /v1/tipos-operacao (com índice 0 ou 1) e filtra localmente
   * tipoMovimento === 19 de forma 100% segura e oficial.
   */
  async listarTopsPedidoVenda({ forcarAtualizacao = false } = {}) {
    if (!forcarAtualizacao && this.cache && Date.now() - this.cache.carregadoEm < CACHE_TTL_MS) {
      return { ...this.cache, origem: 'cache' };
    }

    const todas = [];
    const vistos = new Set();
    let estruturaResposta = null;
    let paginasLidas = 0;

    // Teste inicial: verifica se o Gateway aceita o query param tipoMovimento=19
    let suportaFiltroQuery = true;
    const testeFiltro = await this._get(`/v1/tipos-operacao?tipoMovimento=${config.sankhya.tipoMovimentoPedidoVenda}&page=0`);
    if (!testeFiltro.ok && testeFiltro.status === 404) {
      suportaFiltroQuery = false;
      console.log('[TopService] Gateway não suporta filtro query tipoMovimento; paginando /v1/tipos-operacao com filtro local.');
    }

    const basePage = 0; // O Gateway do Sandbox utiliza índice de página iniciando em 0

    for (let page = basePage; page <= (basePage + MAX_PAGINAS); page++) {
      const qs = new URLSearchParams({ page: String(page) });
      if (suportaFiltroQuery) {
        qs.set('tipoMovimento', String(config.sankhya.tipoMovimentoPedidoVenda));
      }

      const { status, ok, data } = await this._get(`/v1/tipos-operacao?${qs.toString()}`);

      if (!ok) {
        if (page > basePage && status === 404) break; // Fim das páginas
        throw new SankhyaApiError(
          `Erro ao consultar Tipos de Operação (HTTP ${status}): ${this._mensagemErro(data, status)}`,
          { statusHttp: status === 401 ? 401 : status === 403 ? 403 : 502, statusSankhya: status, diagnostico: diagnosticoFallback(status) }
        );
      }

      paginasLidas++;
      if (!estruturaResposta) {
        estruturaResposta = Array.isArray(data) ? ['<array>'] : Object.keys(data || {});
      }

      const lista = this._extrairLista(data);
      let novos = 0;
      for (const item of lista) {
        const top = this._normalizar(item);
        if (!Number.isInteger(top.codigoTipoOperacao) || vistos.has(top.codigoTipoOperacao)) continue;
        vistos.add(top.codigoTipoOperacao);
        todas.push(top);
        novos++;
      }

      const temMais = data && data.pagination && data.pagination.hasMore !== undefined
        ? (data.pagination.hasMore === true || data.pagination.hasMore === 'true')
        : (data?.temMaisRegistros ?? data?.hasMore ?? null);

      if (lista.length === 0 || novos === 0) break;
      if (temMais === false || temMais === 'false') break;
    }

    // Filtro defensivo: garantimos que apenas TOPs ativas de Pedido de Venda (tipo 19) sejam retornadas
    const filtradas = todas
      .filter((t) => t.ativo && t.tipoMovimento === config.sankhya.tipoMovimentoPedidoVenda)
      .sort((a, b) => a.codigoTipoOperacao - b.codigoTipoOperacao)
      .map((t) => ({ ...t, compatibilidade: this.avaliarCompatibilidade(t) }));

    this.cache = {
      carregadoEm: Date.now(),
      tops: filtradas,
      totalRecebidas: todas.length,
      totalDescartadas: todas.length - filtradas.length,
      paginasLidas,
      estruturaResposta
    };

    return { ...this.cache, origem: 'sankhya' };
  }

  /**
   * Consulta uma TOP específica via endpoint oficial:
   *   GET /v1/tipos-operacao/{codigoTipoOperacao}
   */
  async buscarPorCodigo(codigo) {
    const codigoNum = Number(codigo);
    if (!Number.isInteger(codigoNum) || codigoNum <= 0) {
      throw new SankhyaApiError('Código da TOP inválido. Informe um inteiro positivo.', { statusHttp: 400 });
    }

    const { status, ok, data } = await this._get(`/v1/tipos-operacao/${codigoNum}`);

    if (status === 404) {
      return { encontrada: false, mensagem: `TOP ${codigoNum} não encontrada no Sankhya Om.` };
    }
    if (!ok) {
      throw new SankhyaApiError(
        `Erro ao consultar a TOP ${codigoNum} (HTTP ${status}): ${this._mensagemErro(data, status)}`,
        { statusHttp: status === 401 ? 401 : status === 403 ? 403 : 502, statusSankhya: status, diagnostico: diagnosticoFallback(status) }
      );
    }

    const lista = this._extrairLista(data);
    const bruto = lista.find((t) => Number(t.codigoTipoOperacao) === codigoNum) || lista[0];
    if (!bruto) {
      return { encontrada: false, mensagem: `A resposta do Sankhya não trouxe dados da TOP ${codigoNum}.` };
    }

    const top = this._normalizar(bruto);
    return { encontrada: true, top: { ...top, compatibilidade: this.avaliarCompatibilidade(top) } };
  }
}

module.exports = new TopService();
module.exports.SankhyaApiError = SankhyaApiError;
