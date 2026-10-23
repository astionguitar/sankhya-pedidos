const config = require('../config/sankhya');
const authService = require('./authService');

class ProdutoService {
  constructor() {
    // Cache em memória de páginas de produtos para otimizar paginação e busca (TTL 3 minutos)
    this._cachePaginas = new Map();
    this._cacheTtlMs = 3 * 60 * 1000;
  }

  /**
   * Mapeia os campos brutos da API oficial de produtos (/v1/produtos)
   * para uma estrutura limpa e padronizada para a interface e regras de negócio.
   */
  _mapearProduto(p) {
    if (!p) return null;
    return {
      codigoProduto: Number(p.codigoProduto),
      nome: (p.nome || '').trim(),
      complemento: (p.complemento || '').trim(),
      caracteristicas: p.caracteristicas || '',
      volume: (p.volume || '').trim(), // Unidade de medida (ex: CX, KG, UN, SC, BD)
      referencia: p.referencia || '',
      codigoGrupoProduto: p.codigoGrupoProduto || null,
      nomeGrupoProduto: p.nomeGrupoProduto ? p.nomeGrupoProduto.trim() : '',
      marca: p.marca || '',
      ativo: p.ativo !== false, // Situação do produto (ativo / inativo)
      decimaisValor: Number(p.decimaisValor) || 2,
      decimaisQuantidade: Number(p.decimaisQuantidade) || 2,
      pesoBruto: p.pesoBruto !== null && p.pesoBruto !== undefined ? Number(p.pesoBruto) : null,
      codigoEmpresaPadrao: p.camposAdicionais?.AD_CODEMP ? Number(p.camposAdicionais.AD_CODEMP) : null,
      codigoLocalPadrao: p.camposNaoMapeados?.CODLOCALPADRAO ? Number(p.camposNaoMapeados.CODLOCALPADRAO) : null,
      usaLocal: p.camposNaoMapeados?.USALOCAL === 'S' || p.camposNaoMapeados?.LOCAL !== 'N',
      controlesDisponiveis: p.camposNaoMapeados?.LISCONTEST ? p.camposNaoMapeados.LISCONTEST.split('\n').map(s => s.trim()).filter(Boolean) : [],
      controleSugerido: (p.camposNaoMapeados?.LISCONTEST ? p.camposNaoMapeados.LISCONTEST.split('\n').map(s => s.trim()).filter(Boolean)[0] : '') || (Number(p.codigoProduto) === 3 ? 'NL' : ''),
      camposAdicionais: p.camposAdicionais || {},
      raw: p
    };
  }

  /**
   * Consulta a lista de produtos cadastrados no ERP Sankhya utilizando o endpoint oficial:
   * GET /v1/produtos?page={page}
   * Permite pesquisar por código (busca direta via GET /v1/produtos/{id}) ou parte da descrição.
   * 
   * @param {number} page - Número da página (iniciando em 0)
   * @param {string} termo - Termo de busca opcional (código ou parte da descrição)
   * @param {boolean} forcarAtualizacao - Força requisição direta sem usar cache
   */
  async listarProdutos(page = 0, termo = '', forcarAtualizacao = false) {
    const paginaNumero = Math.max(0, parseInt(page, 10) || 0);
    const termoLimpo = (termo || '').trim();

    // 1. Se o termo for um código numérico, executa busca direta por código via GET /v1/produtos/{codigo}
    if (/^\d+$/.test(termoLimpo)) {
      const codNum = parseInt(termoLimpo, 10);
      try {
        const resultadoCodigo = await this.buscarPorCodigo(codNum);
        if (resultadoCodigo.encontrado && resultadoCodigo.produto) {
          return {
            page: 0,
            numeroRegistros: 1,
            temMaisRegistros: false,
            produtos: [resultadoCodigo.produto],
            buscaPorCodigo: true,
            termo: termoLimpo
          };
        }
      } catch (err) {
        console.warn(`[ProdutoService] Busca direta por código ${codNum} não retornou produto:`, err.message);
      }
    }

    // 2. Verifica se a página já está no cache válido
    const cacheKey = `page_${paginaNumero}`;
    const agora = Date.now();
    let dadosPagina = null;

    if (!forcarAtualizacao && this._cachePaginas.has(cacheKey)) {
      const itemCache = this._cachePaginas.get(cacheKey);
      if (agora - itemCache.timestamp < this._cacheTtlMs) {
        dadosPagina = itemCache.dados;
      }
    }

    if (!dadosPagina) {
      const endpoint = `/v1/produtos?page=${paginaNumero}`;
      console.log(`[ProdutoService] Consultando produtos no Sankhya Sandbox: ${config.sankhya.apiUrl}${endpoint}`);

      const response = await authService.executarRequisicao(endpoint);

      const contentType = response.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      if (!response.ok) {
        console.error(`[ProdutoService] Erro ao consultar produtos. Status HTTP: ${response.status}`);
        let msg = `Erro ao consultar produtos (HTTP ${response.status})`;
        if (data && (data.error || data.mensagem || data.message)) {
          const detalhe = data.error?.message || data.mensagem || data.message;
          msg = `${msg}: ${typeof detalhe === 'object' ? JSON.stringify(detalhe) : detalhe}`;
        }
        throw new Error(msg);
      }

      const listaCrua = Array.isArray(data.produtos) ? data.produtos : [];
      const pagination = data.pagination || {};
      const temMais = pagination.hasMore !== undefined
        ? (pagination.hasMore === true || pagination.hasMore === 'true')
        : listaCrua.length === 50;

      dadosPagina = {
        produtos: listaCrua.map(p => this._mapearProduto(p)),
        temMais
      };

      // Guarda no cache
      this._cachePaginas.set(cacheKey, {
        dados: dadosPagina,
        timestamp: agora
      });
    }

    // 3. Aplica o filtro de pesquisa textual (código ou parte da descrição)
    let produtosRetornados = dadosPagina.produtos;
    if (termoLimpo) {
      const termoLower = termoLimpo.toLowerCase();
      produtosRetornados = produtosRetornados.filter((p) => {
        const cod = String(p.codigoProduto || '');
        const nome = (p.nome || '').toLowerCase();
        const comp = (p.complemento || '').toLowerCase();
        const ref = (p.referencia || '').toLowerCase();
        const vol = (p.volume || '').toLowerCase();
        const grupo = (p.nomeGrupoProduto || '').toLowerCase();

        return cod.includes(termoLower)
          || nome.includes(termoLower)
          || comp.includes(termoLower)
          || ref.includes(termoLower)
          || vol.includes(termoLower)
          || grupo.includes(termoLower);
      });
    }

    return {
      page: paginaNumero,
      numeroRegistros: produtosRetornados.length,
      totalPaginaOriginal: dadosPagina.produtos.length,
      temMaisRegistros: dadosPagina.temMais,
      produtos: produtosRetornados,
      termo: termoLimpo
    };
  }

  /**
   * Busca um produto específico pelo código oficial:
   * GET /v1/produtos/{codigoProduto}
   * @param {number|string} codigoProduto
   */
  async buscarPorCodigo(codigoProduto) {
    const codNum = parseInt(codigoProduto, 10);
    if (!codNum || isNaN(codNum) || codNum <= 0) {
      throw new Error('Código do produto inválido. Informe um número inteiro positivo.');
    }

    const endpoint = `/v1/produtos/${codNum}`;
    console.log(`[ProdutoService] Consultando produto por código em: ${config.sankhya.apiUrl}${endpoint}`);

    const response = await authService.executarRequisicao(endpoint);

    if (response.status === 404) {
      return {
        encontrado: false,
        mensagem: `Produto com código ${codNum} não foi localizado no Sandbox da Sankhya.`
      };
    }

    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      console.error(`[ProdutoService] Erro ao buscar produto ${codNum}. Status HTTP: ${response.status}`);
      let msg = `Erro ao buscar produto (HTTP ${response.status})`;
      if (data && (data.error || data.mensagem || data.message)) {
        const detalhe = data.error?.message || data.mensagem || data.message;
        msg = `${msg}: ${typeof detalhe === 'object' ? JSON.stringify(detalhe) : detalhe}`;
      }
      throw new Error(msg);
    }

    const produtoCru = data.produtos || data.produto || data;
    return {
      encontrado: true,
      produto: this._mapearProduto(produtoCru)
    };
  }
}

module.exports = new ProdutoService();
