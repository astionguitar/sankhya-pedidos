const authService = require('../services/authService');
const clienteService = require('../services/clienteService');

class ClienteController {
  /**
   * Retorna o status da configuração e conectividade local
   */
  async getStatus(req, res) {
    try {
      const status = authService.getStatus();
      return res.json({
        sucesso: true,
        status
      });
    } catch (error) {
      return res.status(500).json({
        sucesso: false,
        mensagem: error.message
      });
    }
  }

  /**
   * Endpoint para testar especificamente a autenticação Sandbox
   */
  async testAuth(req, res) {
    try {
      const auth = await authService.getAccessToken(true); // Força autenticação limpa para o teste
      return res.json({
        sucesso: true,
        mensagem: 'Autenticação no Sandbox Sankhya realizada com sucesso!',
        expiresInSeconds: auth.expiresInSeconds,
        tokenType: auth.tokenType
      });
    } catch (error) {
      return res.status(401).json({
        sucesso: false,
        mensagem: `Falha na autenticação: ${error.message}`
      });
    }
  }

  /**
   * Endpoint para testar a conectividade completa (Autenticação + Consulta de Clientes)
   */
  async testConexao(req, res) {
    try {
      const resultado = await clienteService.testarConexao();
      return res.json({
        sucesso: true,
        mensagem: 'Conexão e consulta de clientes realizadas com sucesso no Sandbox!',
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
   * Lista clientes da Sankhya com paginação
   */
  async listar(req, res) {
    try {
      const page = req.query.page !== undefined ? parseInt(req.query.page, 10) : 0;
      const sortOrder = (req.query.sortOrder || req.query.sort_order || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      const termo = req.query.termo || req.query.q || req.query.busca || '';
      const resultado = await clienteService.listarClientes(isNaN(page) ? 0 : page, sortOrder, termo);
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
   * Busca um cliente por CODPARC
   */
  async buscarPorCodigo(req, res) {
    try {
      const { codParc } = req.params;
      const resultado = await clienteService.buscarPorCodigo(codParc);
      if (!resultado.encontrado) {
        return res.status(404).json({
          sucesso: false,
          mensagem: resultado.mensagem
        });
      }
      return res.json({
        sucesso: true,
        cliente: resultado.cliente
      });
    } catch (error) {
      return res.status(400).json({
        sucesso: false,
        mensagem: error.message
      });
    }
  }
}

module.exports = new ClienteController();
