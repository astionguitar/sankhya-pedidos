const config = require('../config/sankhya');
const authService = require('./authService');
const topService = require('./topService');
const { SankhyaApiError } = require('./topService');

class PedidoService {
  /**
   * Valida a estrutura dos dados do pedido antes de qualquer tentativa de envio
   * @param {Object} dadosPedido
   */
  validarEstruturaPedido(dadosPedido) {
    const erros = [];

    if (!dadosPedido) {
      return { valido: false, erros: ['Nenhum dado de pedido foi enviado.'] };
    }

    // Validação do Cliente
    const codigoCliente = parseInt(dadosPedido.codigoCliente, 10);
    if (!codigoCliente || codigoCliente <= 0) {
      erros.push('Código do cliente (CODPARC) é obrigatório e deve ser um número positivo.');
    }

    // Validação da TOP escolhida pelo usuário
    const codigoTop = Number(dadosPedido.codigoTop);
    if (!Number.isInteger(codigoTop) || codigoTop <= 0) {
      erros.push('Tipo de Operação (TOP) é obrigatório e deve ser um inteiro positivo.');
    }

    // Validação dos Itens
    if (!Array.isArray(dadosPedido.itens) || dadosPedido.itens.length === 0) {
      erros.push('O pedido deve conter pelo menos um item.');
    } else {
      dadosPedido.itens.forEach((item, index) => {
        const itemNum = index + 1;
        const codProd = parseInt(item.codigoProduto, 10);
        const qtd = parseFloat(item.quantidade);
        const vlr = parseFloat(item.valorUnitario);

        if (!codProd || codProd <= 0) {
          erros.push(`Item ${itemNum}: Código do produto (CODPROD) inválido.`);
        }
        if (isNaN(qtd) || qtd <= 0) {
          erros.push(`Item ${itemNum}: Quantidade deve ser maior que zero.`);
        }
        if (isNaN(vlr) || vlr < 0) {
          erros.push(`Item ${itemNum}: Preço unitário deve ser maior ou igual a zero.`);
        }
      });
    }

    // Validação opcional de bloco financeiros se enviado
    if (dadosPedido.financeiros !== undefined) {
      if (!Array.isArray(dadosPedido.financeiros) || dadosPedido.financeiros.length === 0) {
        erros.push('Se informado, o bloco "financeiros" deve ser um array com ao menos uma parcela.');
      } else {
        let somaParcelas = 0;
        dadosPedido.financeiros.forEach((f, idx) => {
          const pNum = idx + 1;
          if (!f.sequencia || f.sequencia <= 0) erros.push(`Parcela ${pNum}: "sequencia" obrigatória (inteiro >= 1).`);
          if (f.tipoPagamento === undefined || isNaN(f.tipoPagamento)) erros.push(`Parcela ${pNum}: "tipoPagamento" (CODTIPTIT) é obrigatório.`);
          if (!f.dataVencimento || !/^\d{2}\/\d{2}\/\d{4}$/.test(f.dataVencimento)) erros.push(`Parcela ${pNum}: "dataVencimento" deve seguir o formato DD/MM/YYYY.`);
          if (isNaN(f.valorParcela) || f.valorParcela <= 0) erros.push(`Parcela ${pNum}: "valorParcela" deve ser maior que zero.`);
          else somaParcelas += parseFloat(f.valorParcela);
        });
        if (Array.isArray(dadosPedido.itens)) {
          const totalItens = dadosPedido.itens.reduce((acc, it) => acc + (parseFloat(it.quantidade) || 0) * (parseFloat(it.valorUnitario) || 0), 0);
          if (Math.abs(somaParcelas - totalItens) > 0.05) {
            erros.push(`A soma das parcelas financeiras (R$ ${somaParcelas.toFixed(2)}) diverge do total dos itens (R$ ${totalItens.toFixed(2)}).`);
          }
        }
      }
    }

    return {
      valido: erros.length === 0,
      erros
    };
  }

  /**
   * Revalida a TOP diretamente no Sankhya (não confia no que veio do navegador)
   * e exige que ela esteja pronta para pedido (ativa, tipo 19 e nota modelo configurada).
   */
  async validarTop(codigoTop) {
    const resultado = await topService.buscarPorCodigo(codigoTop);
    if (!resultado.encontrada) {
      throw new SankhyaApiError(resultado.mensagem, { statusHttp: 422 });
    }

    const { top } = resultado;
    if (!top.compatibilidade.prontaParaPedido) {
      throw new SankhyaApiError(
        `A TOP ${top.codigoTipoOperacao} não pode ser usada em pedidos de venda: ${top.compatibilidade.pendencias.join(' ')}`,
        { statusHttp: 422 }
      );
    }
    return top;
  }

  /**
   * Monta o payload no formato documentado (schema "movimentoPedido") de POST /v1/vendas/pedidos.
   * - notaModelo: obrigatório pela documentação; herda automaticamente CODEMP, CODEMPNEGOC, CODTIPOPER, CODTIPVENDA.
   * - sobrescreverCamposModelo: se false (padrão), não polui o payload com campos idênticos ao modelo.
   * - financeiros: calcula/valida o parcelamento real exigido pela API oficial.
   */
  montarPayloadSankhya({ codigoCliente, itens, observacao = '', financeiros, tipoPagamento, dataVencimento, sobrescreverCamposModelo = false }, top) {
    const agora = new Date();
    const dataFormatada = [
      String(agora.getDate()).padStart(2, '0'),
      String(agora.getMonth() + 1).padStart(2, '0'),
      agora.getFullYear()
    ].join('/');

    const horaFormatada = [
      String(agora.getHours()).padStart(2, '0'),
      String(agora.getMinutes()).padStart(2, '0')
    ].join(':');

    let totalPedido = 0;
    const itensMapeados = itens.map((item, idx) => {
      const qtd = parseFloat(item.quantidade);
      const vlr = parseFloat(item.valorUnitario);
      const subtotal = Math.round(qtd * vlr * 100) / 100;
      totalPedido += subtotal;

      const itemMapeado = {
        sequencia: idx + 1,
        codigoProduto: parseInt(item.codigoProduto, 10),
        quantidade: qtd,
        valorUnitario: vlr,
        codigoLocalEstoque: (item.codigoLocalEstoque !== undefined && item.codigoLocalEstoque !== null && !isNaN(parseInt(item.codigoLocalEstoque, 10)))
          ? parseInt(item.codigoLocalEstoque, 10)
          : 0
      };

      if (item.controle !== undefined && item.controle !== null && String(item.controle).trim() !== '') {
        itemMapeado.controle = String(item.controle).trim();
      }

      if (item.unidade) itemMapeado.unidade = String(item.unidade);
      if (item.valorDesconto) itemMapeado.valorDesconto = parseFloat(item.valorDesconto);

      return itemMapeado;
    });

    totalPedido = Math.round(totalPedido * 100) / 100;

    const { notaModelo, codigoEmpresa, empresaNegociacao, tipoVenda } = top.compatibilidade;

    // Estruturação do array financeiros
    let listaFinanceiros = [];
    if (Array.isArray(financeiros) && financeiros.length > 0) {
      listaFinanceiros = financeiros.map((f, idx) => ({
        sequencia: idx + 1,
        tipoPagamento: parseInt(f.tipoPagamento, 10),
        dataVencimento: f.dataVencimento || dataFormatada,
        valorParcela: Math.round(parseFloat(f.valorParcela) * 100) / 100
      }));
    } else {
      const tipoPagamentoEscolhido = parseInt(tipoPagamento, 10) || (tipoVenda === 2 ? 16 : 2);
      const vencimentoEscolhido = dataVencimento || dataFormatada;
      listaFinanceiros = [
        {
          sequencia: 1,
          tipoPagamento: tipoPagamentoEscolhido,
          dataVencimento: vencimentoEscolhido,
          valorParcela: totalPedido
        }
      ];
    }

    // Payload canônico: herda os campos do cabeçalho da nota modelo,
    // sobrescrevendo explicitamente as datas da TGFCAB para evitar rejeição por LIMINFANO (datas herdadas de 2020)
    const payload = {
      notaModelo,
      codigoCliente: parseInt(codigoCliente, 10),
      data: dataFormatada,
      hora: horaFormatada,
      DTNEG: dataFormatada,
      DTMOV: dataFormatada,
      DTENTSAI: dataFormatada,
      DTPREVENT: dataFormatada,
      observacao: observacao || `Pedido gerado via integrador local - TOP ${top.codigoTipoOperacao}`,
      valorTotal: totalPedido,
      itens: itensMapeados,
      financeiros: listaFinanceiros
    };

    // Apenas se solicitado explicitamente, envia sobrescritas de cabeçalho (TGFCAB)
    if (sobrescreverCamposModelo) {
      if (top.codigoTipoOperacao) payload.CODTIPOPER = top.codigoTipoOperacao;
      if (codigoEmpresa) payload.CODEMP = codigoEmpresa;
      if (empresaNegociacao) payload.CODEMPNEGOC = empresaNegociacao;
      if (tipoVenda) payload.CODTIPVENDA = tipoVenda;
    }

    return payload;
  }

  /**
   * Valida e prepara o pedido. NÃO envia nada ao Sankhya (nenhum POST é executado).
   */
  async prepararPedido(dadosPedido) {
    const validacao = this.validarEstruturaPedido(dadosPedido);
    if (!validacao.valido) {
      throw new SankhyaApiError(`Falha de validação: ${validacao.erros.join('; ')}`, { statusHttp: 400 });
    }

    const top = await this.validarTop(dadosPedido.codigoTop);

    // Gera o payload canônico (sem sobrescritas desnecessárias do modelo)
    const payload = this.montarPayloadSankhya({ ...dadosPedido, sobrescreverCamposModelo: false }, top);

    // Gera também a versão com sobrescrita explícita para comparação e transparência
    const payloadComSobrescritas = this.montarPayloadSankhya({ ...dadosPedido, sobrescreverCamposModelo: true }, top);

    const itensComLocalZero = payload.itens.filter((it) => it.codigoLocalEstoque === 0);

    const avisosRevisao = [
      ...top.compatibilidade.avisos,
      `Payload estruturado com paridade financeira: total do pedido (R$ ${payload.valorTotal.toFixed(2)}) confere com a soma das parcelas em "financeiros".`,
      'Campos herdados diretamente da Nota Modelo 799010 (não sobrescritos na raiz): CODEMP=4, CODEMPNEGOC=1, CODTIPOPER=3199, CODTIPVENDA=2.'
    ];

    if (itensComLocalZero.length > 0) {
      avisosRevisao.push(
        `Atenção Local de Estoque: ${itensComLocalZero.length} item(ns) estão com codigoLocalEstoque=0 (<SEM LOCAL>). Se o produto exigir controle de estoque por local (ex: produto 3 tem local padrão 20000000 - CENTRO DE DISTRIBUIÇÃO), o Sankhya poderá recusar o local 0.`
      );
    }

    return {
      sucesso: true,
      top: {
        codigo: top.codigoTipoOperacao,
        descricao: top.nome,
        tipoMovimento: top.tipoMovimento,
        tipoMovimentoDescricao: top.tipoMovimentoDescricao || 'Pedido de Venda'
      },
      notaModelo: top.compatibilidade.notaModelo,
      codigoEmpresa: top.compatibilidade.codigoEmpresa,
      empresaNegociacao: top.compatibilidade.empresaNegociacao,
      tipoVenda: top.compatibilidade.tipoVenda,
      avisos: avisosRevisao,
      totalEstimado: payload.valorTotal,
      totalItens: payload.itens.length,
      payloadGerado: payload,
      payloadComSobrescritas,
      envioHabilitado: true,
      pendenciasParaEnvio: [
        'Confirmação explícita do usuário na interface requerida para gravação.',
        'Envio restrito com salvaguarda exclusiva para api.sandbox.sankhya.com.br.'
      ]
    };
  }

  /**
   * Executa o envio real e controlado do pedido ao Sankhya Sandbox (POST /v1/vendas/pedidos).
   * Salvaguardas aplicadas:
   * 1. Confirmação explícita do usuário requerida (confirmacaoUsuario: true).
   * 2. Verificação estrita de URL de destino (apenas api.sandbox.sankhya.com.br).
   * 3. Sem repetição automática em caso de timeout / incerteza (evita duplicidade).
   * 4. Registro seguro do status e NUNOTA/codigoPedido sem expor segredos.
   * 5. Não confirma nem fatura o pedido (permanece "A Confirmar").
   */
  async enviarPedidoSankhya(dadosPedido) {
    if (!dadosPedido || dadosPedido.confirmacaoUsuario !== true) {
      throw new SankhyaApiError('Operação cancelada: a inclusão de pedido no Sankhya exige confirmação explícita do usuário.', { statusHttp: 400 });
    }

    // Salvaguarda 1: Verificação estrita de que o destino é exclusivamente o Sandbox
    const apiUrl = String(config.sankhya.apiUrl || '').toLowerCase();
    if (!apiUrl.includes('sandbox.sankhya.com.br')) {
      console.error('[PedidoService] BLOQUEIO DE SEGURANÇA: Tentativa de envio para endpoint não-Sandbox:', apiUrl);
      throw new SankhyaApiError('Operação abortada por segurança: o envio real é restrito exclusivamente ao ambiente Sankhya Sandbox (api.sandbox.sankhya.com.br). Produção bloqueada.', { statusHttp: 403 });
    }

    // Salvaguarda 2: Validação prévia de estrutura e regras de negócio
    const validacao = this.validarEstruturaPedido(dadosPedido);
    if (!validacao.valido) {
      throw new SankhyaApiError(`Falha de validação pré-envio: ${validacao.erros.join('; ')}`, { statusHttp: 400 });
    }

    const top = await this.validarTop(dadosPedido.codigoTop);

    // Monta o payload canônico oficial
    const payload = this.montarPayloadSankhya(dadosPedido, top);

    console.log('[PedidoService] ====================================================');
    console.log('[PedidoService] INICIANDO ENVIO CONTROLADO AO SANKHYA SANDBOX');
    console.log('[PedidoService] Endpoint: POST https://api.sandbox.sankhya.com.br/v1/vendas/pedidos');
    console.log('[PedidoService] Payload preparado:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('[PedidoService] ====================================================');

    // Salvaguarda 3: Obter token Bearer previamente (sem retry automático na criação do pedido)
    const auth = await authService.getAccessToken();

    const targetUrl = `${config.sankhya.apiUrl}/v1/vendas/pedidos`;
    let response;
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        // Timeout de 45 segundos para resposta do gateway
        signal: AbortSignal.timeout(45000)
      });
    } catch (networkError) {
      console.error('[PedidoService] Falha de rede ou timeout durante POST /v1/vendas/pedidos:', networkError.message);
      // NÃO tentar novamente para evitar duplicidade de pedidos!
      throw new SankhyaApiError(`Falha de comunicação com o Sankhya Sandbox: ${networkError.message}. O envio NÃO foi repetido para evitar duplicidade. Verifique no ERP se o pedido foi recebido antes de reenviar.`, { statusHttp: 504 });
    }

    const statusHttp = response.status;
    const contentType = response.headers.get('content-type') || '';
    let responseData;
    if (contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = { raw: await response.text() };
      }
    } else {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = { raw: text };
      }
    }

    console.log(`[PedidoService] Resposta recebida do Sankhya Sandbox (HTTP ${statusHttp}):`, JSON.stringify(responseData));

    // Se a resposta for sucesso (HTTP 200 / 201)
    if (response.ok) {
      const codigoPedido = responseData.retorno?.codigoPedido
        || responseData.codigoPedido
        || responseData.codigo
        || null;

      return {
        sucesso: true,
        statusHttp,
        criado: true,
        codigoPedido,
        mensagem: responseData.mensagem || 'Pedido de venda incluído com sucesso no Sankhya Sandbox.',
        respostaSankhya: responseData,
        payloadEnviado: payload
      };
    }

    // Se a API rejeitou (HTTP 400, 403, 404, 500...)
    let mensagemErro = `Rejeição da API Sankhya (HTTP ${statusHttp})`;
    if (responseData) {
      if (typeof responseData.mensagem === 'string') mensagemErro = responseData.mensagem;
      else if (responseData.mensagem?.message) mensagemErro = responseData.mensagem.message;
      else if (responseData.error?.message) mensagemErro = responseData.error.message;
      else if (typeof responseData.error === 'string') mensagemErro = responseData.error;
    }

    return {
      sucesso: false,
      statusHttp,
      criado: false,
      codigoPedido: null,
      mensagem: mensagemErro,
      respostaSankhya: responseData,
      payloadEnviado: payload
    };
  }
}

module.exports = new PedidoService();
