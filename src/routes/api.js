const express = require('express');
const router = express.Router();

const clienteController = require('../controllers/clienteController');
const pedidoController = require('../controllers/pedidoController');
const produtoController = require('../controllers/produtoController');
const topController = require('../controllers/topController');

// Rotas de Status e Diagnóstico
router.get('/status', (req, res) => clienteController.getStatus(req, res));
router.post('/auth/test', (req, res) => clienteController.testAuth(req, res));
router.post('/conexao/test', (req, res) => clienteController.testConexao(req, res));

// Rotas de Tipos de Operação (TOP) - somente leitura
router.get('/tops', (req, res) => topController.listar(req, res));
router.get('/tops/:codigo', (req, res) => topController.buscarPorCodigo(req, res));

// Rotas de Clientes
router.get('/clientes', (req, res) => clienteController.listar(req, res));
router.get('/clientes/:codParc', (req, res) => clienteController.buscarPorCodigo(req, res));

// Rotas de Produtos
router.get('/produtos', (req, res) => produtoController.listar(req, res));
router.get('/produtos/:codigo', (req, res) => produtoController.buscarPorCodigo(req, res));

// Rotas de Pedidos de Venda
router.post('/pedidos/preparar', (req, res) => pedidoController.preparar(req, res));
router.post('/pedidos', (req, res) => pedidoController.criar(req, res));

module.exports = router;
