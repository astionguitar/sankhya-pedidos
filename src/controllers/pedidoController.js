const pedidoService = require('../services/pedidoService');

class PedidoController {
  /**
   * POST /api/pedidos/preparar
   * Valida estrutura + TOP (no Sankhya) + nota modelo e devolve o payload. Não grava nada.
   */
  async preparar(req, res) {
    try {
      const resultado = await pedidoService.prepararPedido(req.body);
      return res.json(resultado);
    } catch (error) {
      return res.status(error.statusHttp || 400).json({
        sucesso: false,
        mensagem: error.message,
        diagnostico: error.diagnostico || null
      });
    }
  }

  /**
   * POST /api/pedidos
   * Envia o pedido de venda ao Sankhya Sandbox com confirmação explícita do usuário.
   */
  async criar(req, res) {
    try {
      if (!req.body || req.body.confirmacaoUsuario !== true) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'A inclusão de pedido no Sankhya exige confirmação explícita do usuário (confirmacaoUsuario: true).'
        });
      }

      const resultado = await pedidoService.enviarPedidoSankhya(req.body);
      const httpStatus = resultado.sucesso ? 200 : (resultado.statusHttp || 400);
      return res.status(httpStatus).json(resultado);
    } catch (error) {
      console.error('[PedidoController] Erro ao enviar pedido ao Sankhya:', error);
      return res.status(error.statusHttp || 500).json({
        sucesso: false,
        statusHttp: error.statusHttp || 500,
        criado: false,
        mensagem: error.message || 'Erro inesperado ao comunicar com o Sankhya Sandbox.',
        diagnostico: error.diagnostico || null
      });
    }
  }
}

module.exports = new PedidoController();
