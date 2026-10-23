const config = require('../config/sankhya');
const topService = require('../services/topService');

/**
 * Converte erros do serviço em respostas HTTP padronizadas (sem expor credenciais).
 */
function responderErro(res, error) {
  const status = error.statusHttp || 500;
  return res.status(status).json({
    sucesso: false,
    mensagem: error.message,
    statusSankhya: error.statusSankhya || null,
    diagnostico: error.diagnostico || null
  });
}

class TopController {
  /**
   * GET /api/tops?q=<busca>&atualizar=1
   * Lista TOPs ativas de Pedido de Venda, com filtro opcional por código ou descrição.
   */
  async listar(req, res) {
    try {
      const forcarAtualizacao = req.query.atualizar === '1' || req.query.atualizar === 'true';
      const resultado = await topService.listarTopsPedidoVenda({ forcarAtualizacao });

      const termo = String(req.query.q || '').trim().toLowerCase();
      const tops = termo
        ? resultado.tops.filter((t) =>
            String(t.codigoTipoOperacao).includes(termo) || t.nome.toLowerCase().includes(termo))
        : resultado.tops;

      const sugerida = config.sankhya.topSugerida;
      const sugestaoDisponivel = sugerida
        ? resultado.tops.find((t) => t.codigoTipoOperacao === sugerida) || null
        : null;

      return res.json({
        sucesso: true,
        origem: resultado.origem,
        endpoint: `GET /v1/tipos-operacao?tipoMovimento=${config.sankhya.tipoMovimentoPedidoVenda}&page=N`,
        paginasLidas: resultado.paginasLidas,
        totalRecebidas: resultado.totalRecebidas,
        totalDescartadas: resultado.totalDescartadas,
        estruturaResposta: resultado.estruturaResposta,
        total: tops.length,
        topSugerida: {
          codigo: sugerida,
          disponivel: Boolean(sugestaoDisponivel),
          prontaParaPedido: sugestaoDisponivel ? sugestaoDisponivel.compatibilidade.prontaParaPedido : false
        },
        tops
      });
    } catch (error) {
      return responderErro(res, error);
    }
  }

  /**
   * GET /api/tops/:codigo
   * Consulta uma TOP específica direto no Sankhya e devolve a avaliação de compatibilidade.
   */
  async buscarPorCodigo(req, res) {
    try {
      const resultado = await topService.buscarPorCodigo(req.params.codigo);
      if (!resultado.encontrada) {
        return res.status(404).json({ sucesso: false, mensagem: resultado.mensagem });
      }
      return res.json({ sucesso: true, top: resultado.top });
    } catch (error) {
      return responderErro(res, error);
    }
  }
}

module.exports = new TopController();
