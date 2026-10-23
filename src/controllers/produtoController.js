const produtoService = require('../services/produtoService');

class ProdutoController {
  /**
   * Lista produtos cadastrados com paginação
   * GET /api/produtos?page=0
   */
  async listar(req, res) {
    try {
      const page = req.query.page !== undefined ? parseInt(req.query.page, 10) : 0;
      const termo = req.query.termo || req.query.q || req.query.busca || '';
      const forcar = req.query.refresh === 'true' || req.query.recarregar === 'true';

      const resultado = await produtoService.listarProdutos(
        isNaN(page) ? 0 : page,
        termo,
        forcar
      );

      return res.json({
        sucesso: true,
        dados: resultado
      });
    } catch (error) {
      return res.status(500).json({
        sucesso: false,
        mensagem: error.message
      });
    }
  }

  /**
   * Busca um produto por código
   * GET /api/produtos/:codigo
   */
  async buscarPorCodigo(req, res) {
    try {
      const { codigo } = req.params;
      const resultado = await produtoService.buscarPorCodigo(codigo);
      if (!resultado.encontrado) {
        return res.status(404).json({
          sucesso: false,
          mensagem: resultado.mensagem
        });
      }
      return res.json({
        sucesso: true,
        produto: resultado.produto
      });
    } catch (error) {
      return res.status(400).json({
        sucesso: false,
        mensagem: error.message
      });
    }
  }
}

module.exports = new ProdutoController();
