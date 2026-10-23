const config = require('../config/sankhya');
const authService = require('./authService');

class ClienteService {
  /**
   * Normaliza os dados do cliente retornados pela API oficial (/v1/parceiros/clientes)
   * garantindo consistência na interface e nas validações.
   */
  _mapearCliente(c) {
    if (!c) return null;
    const camposNaoMapeados = c.camposNaoMapeados || {};
    const endereco = c.endereco || {};
    const cidade = endereco.cidade || {};
    const bairro = endereco.bairro || {};

    const situacaoCodigo = camposNaoMapeados.SITUACAO || '';
    let situacaoDescricao = 'Ativo';
    if (situacaoCodigo === 'B') situacaoDescricao = 'Bom / Ativo';
    else if (situacaoCodigo === 'I') situacaoDescricao = 'Inadimplente';
    else if (situacaoCodigo === 'C') situacaoDescricao = 'Cancelado';
    else if (c.ativo === false || camposNaoMapeados.ATIVO === 'N') situacaoDescricao = 'Inativo';

    const logradouro = endereco.logradouro || camposNaoMapeados.NOMEEND || '';
    const numero = endereco.numero || camposNaoMapeados.NUMEND || '';
    const nomeCidade = cidade.nome ? cidade.nome.trim() : '';
    const uf = cidade.uf || cidade.UnidadeFederativa_UF || '';
    const nomeBairro = bairro.nome ? bairro.nome.trim() : '';

    const partesEndereco = [];
    if (logradouro) partesEndereco.push(numero ? `${logradouro}, ${numero}` : logradouro);
    if (nomeBairro) partesEndereco.push(nomeBairro);
    if (nomeCidade) partesEndereco.push(uf ? `${nomeCidade} - ${uf}` : nomeCidade);

    return {
      codigoCliente: Number(c.codigoCliente || camposNaoMapeados.CODPARC),
      nome: c.nome || camposNaoMapeados.NOMEPARC || '',
      razao: c.razao || camposNaoMapeados.RAZAOSOCIAL || c.nome || '',
      tipo: c.tipo || camposNaoMapeados.TIPPESSOA || 'F', // F = Física, J = Jurídica
      cnpjCpf: c.cnpjCpf || camposNaoMapeados.CGC_CPF || '',
      ieRg: c.ieRg || camposNaoMapeados.IDENTINSCESTAD || '',
      ativo: c.ativo !== false && camposNaoMapeados.ATIVO !== 'N',
      situacao: situacaoDescricao,
      situacaoCodigo,
      email: c.email || camposNaoMapeados.EMAIL || camposNaoMapeados.EMAILNFE || '',
      telefone: c.telefoneNumero || camposNaoMapeados.TELEFONE || '',
      cidade: nomeCidade,
      uf,
      enderecoCompleto: partesEndereco.join(', ') || 'Endereço não informado',
      raw: c
    };
  }

  /**
   * Consulta a lista de clientes no ERP Sankhya utilizando o endpoint oficial:
   * GET /v1/parceiros/clientes
   * @param {number} page - Número da página (iniciando em 0)
   * @param {string} sortOrder - Ordenação ('ASC' ou 'DESC')
   * @param {string} termo - Termo de busca opcional (código ou parte do nome/razão)
   */
  async listarClientes(page = 0, sortOrder = 'ASC', termo = '') {
    const paginaNumero = Math.max(0, parseInt(page, 10) || 0);
    const ordem = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const termoLimpo = (termo || '').trim();

    // 1. Se o termo for numérico, executa busca direta por código
    if (/^\d+$/.test(termoLimpo)) {
      const codNum = parseInt(termoLimpo, 10);
      try {
        const buscaCod = await this.buscarPorCodigo(codNum);
        if (buscaCod.encontrado && buscaCod.cliente) {
          return {
            page: 0,
            numeroRegistros: 1,
            temMaisRegistros: false,
            sortOrder: ordem,
            clientes: [buscaCod.cliente],
            buscaPorCodigo: true,
            termo: termoLimpo
          };
        }
      } catch (err) {
        console.warn(`[ClienteService] Busca direta por código ${codNum} falhou:`, err.message);
      }
    }

    const queryParams = new URLSearchParams({
      page: String(paginaNumero),
      sort_by: 'codigoCliente',
      sort_order: ordem
    });

    const endpoint = `/v1/parceiros/clientes?${queryParams.toString()}`;
    console.log(`[ClienteService] Consultando clientes na página ${paginaNumero} (${ordem}) em: ${config.sankhya.apiUrl}${endpoint}`);

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
      console.error(`[ClienteService] Erro ao consultar clientes. Status HTTP: ${response.status}`);
      let msg = `Erro ao consultar clientes (HTTP ${response.status})`;
      if (data && (data.mensagem || data.error || data.message)) {
        const detalhe = data.mensagem || data.error?.message || data.message;
        msg = typeof detalhe === 'object' ? (detalhe.descricao || JSON.stringify(detalhe)) : detalhe;
      }
      throw new Error(msg);
    }

    const lista = Array.isArray(data.clientes) ? data.clientes : [];
    const pagination = data.pagination || {};
    const temMais = pagination.hasMore !== undefined
      ? (pagination.hasMore === true || pagination.hasMore === 'true')
      : Boolean(data.temMaisRegistros || lista.length === 50);

    let clientesMapeados = lista.map(c => this._mapearCliente(c));

    // 2. Se houver termo textual, filtra na lista mapeada
    if (termoLimpo) {
      const termLower = termoLimpo.toLowerCase();
      const termNum = termoLimpo.replace(/\D/g, '');
      clientesMapeados = clientesMapeados.filter(c => {
        const cod = String(c.codigoCliente || '');
        const nome = (c.nome || '').toLowerCase();
        const razao = (c.razao || '').toLowerCase();
        const cnpjCpf = (c.cnpjCpf || '').replace(/\D/g, '');
        return cod.includes(termLower)
          || nome.includes(termLower)
          || razao.includes(termLower)
          || (termNum && cnpjCpf.includes(termNum));
      });
    }

    return {
      page: pagination.page !== undefined ? Number(pagination.page) : paginaNumero,
      numeroRegistros: clientesMapeados.length,
      totalPaginaOriginal: lista.length,
      temMaisRegistros: temMais,
      sortOrder: ordem,
      clientes: clientesMapeados,
      termo: termoLimpo
    };
  }

  /**
   * Busca um cliente específico pelo código (CODPARC / codigoCliente)
   * Estratégia inteligente: se o código for alto (ex: >= 3000 como o 7352),
   * pesquisa com sort_order=DESC para localizá-lo logo na primeira página.
   * @param {number|string} codParc - Código do parceiro
   */
  async buscarPorCodigo(codParc) {
    const codigoNumero = parseInt(codParc, 10);
    if (!codigoNumero || isNaN(codigoNumero) || codigoNumero <= 0) {
      throw new Error('Código do cliente inválido. Informe um número inteiro positivo.');
    }

    const ordens = codigoNumero >= 3000 ? ['DESC', 'ASC'] : ['ASC', 'DESC'];
    const maxPaginas = 5;

    for (const ordem of ordens) {
      let paginaAtual = 0;
      while (paginaAtual < maxPaginas) {
        const resultado = await this.listarClientes(paginaAtual, ordem);
        const clienteEncontrado = resultado.clientes.find(
          c => Number(c.codigoCliente) === codigoNumero
        );

        if (clienteEncontrado) {
          return {
            encontrado: true,
            cliente: clienteEncontrado
          };
        }

        if (!resultado.temMaisRegistros || resultado.clientes.length === 0) {
          break;
        }
        paginaAtual++;
      }
    }

    return {
      encontrado: false,
      mensagem: `Cliente com código ${codigoNumero} não foi localizado no Sandbox da Sankhya.`
    };
  }

  /**
   * Testa a conectividade completa com o Sandbox da Sankhya
   */
  async testarConexao() {
    console.log('[ClienteService] Iniciando teste de conectividade com Sandbox...');
    const auth = await authService.getAccessToken();
    const resultado = await this.listarClientes(0, 'ASC');

    return {
      sucesso: true,
      ambiente: 'Sandbox',
      apiUrl: config.sankhya.apiUrl,
      tokenValido: true,
      segundosValidadeToken: auth.expiresInSeconds,
      totalClientesRetornados: resultado.clientes.length,
      primeirosClientes: resultado.clientes.slice(0, 3).map(c => ({
        codigoCliente: c.codigoCliente,
        nome: c.nome,
        razao: c.razao,
        tipo: c.tipo,
        cnpjCpf: c.cnpjCpf,
        situacao: c.situacao
      }))
    };
  }
}

module.exports = new ClienteService();
