require('dotenv').config();

/**
 * Código oficial do Tipo de Movimento "Pedido de Venda" na API Sankhya
 * (GET /v1/tipos-operacao -> parâmetro/atributo "tipoMovimento", valor 19).
 * Fonte: https://developer.sankhya.com.br/reference/get_v1-tipos-operacao
 */
const TIPO_MOVIMENTO_PEDIDO_VENDA = 19;

/**
 * Interpreta o mapeamento explícito TOP -> Nota Modelo definido em SANKHYA_NOTAS_MODELO.
 *
 * Formatos aceitos (JSON):
 *   {"3100": 12345}                                   -> apenas a nota modelo
 *   {"3100": {"notaModelo": 12345, "codigoEmpresa": 4}} -> nota modelo + empresa do documento (CODEMP)
 *   {"3199": {"notaModelo": 799010, "codigoEmpresa": 4, "empresaNegociacao": 1, "tipoVenda": 2}}
 *
 * Campos suportados:
 *   - notaModelo (obrigatório, inteiro > 0): NUNOTA do modelo de nota no ERP
 *   - codigoEmpresa / empresa / CODEMP (opcional, inteiro > 0): Empresa do documento (CODEMP)
 *   - empresaNegociacao / CODEMPNEGOC (opcional, inteiro > 0): Empresa da negociação (CODEMPNEGOC)
 *   - tipoVenda / CODTIPVENDA (opcional, inteiro > 0): Tipo de negociação / venda (CODTIPVENDA)
 */
function interpretarMapaNotasModelo(valorBruto) {
  const resultado = { mapa: {}, erros: [] };
  if (!valorBruto || !valorBruto.trim()) return resultado;

  let json;
  try {
    json = JSON.parse(valorBruto);
  } catch (e) {
    resultado.erros.push(`SANKHYA_NOTAS_MODELO não é um JSON válido: ${e.message}`);
    return resultado;
  }

  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    resultado.erros.push('SANKHYA_NOTAS_MODELO deve ser um objeto JSON no formato {"<TOP>": <notaModelo>}.');
    return resultado;
  }

  const inteiroPositivo = (v) => Number.isInteger(v) && v > 0;

  for (const [chave, valor] of Object.entries(json)) {
    const codigoTop = Number(chave);
    if (!inteiroPositivo(codigoTop)) {
      resultado.erros.push(`Chave "${chave}" ignorada: o código da TOP deve ser inteiro positivo.`);
      continue;
    }

    const entrada = typeof valor === 'object' && valor !== null ? valor : { notaModelo: valor };
    const notaModelo = Number(entrada.notaModelo);
    if (!inteiroPositivo(notaModelo)) {
      resultado.erros.push(`TOP ${codigoTop} ignorada: "notaModelo" deve ser inteiro positivo.`);
      continue;
    }

    // Empresa do documento (CODEMP na TGFCAB)
    let codigoEmpresa = null;
    const valorEmpresa = entrada.codigoEmpresa ?? entrada.empresa ?? entrada.CODEMP;
    if (valorEmpresa !== undefined && valorEmpresa !== null && valorEmpresa !== '') {
      codigoEmpresa = Number(valorEmpresa);
      if (!inteiroPositivo(codigoEmpresa)) {
        resultado.erros.push(`TOP ${codigoTop} ignorada: "codigoEmpresa" deve ser inteiro positivo.`);
        continue;
      }
    }

    // Empresa da negociação (CODEMPNEGOC na TGFCAB)
    let empresaNegociacao = null;
    const valorEmpresaNeg = entrada.empresaNegociacao ?? entrada.codigoEmpresaNegociacao ?? entrada.CODEMPNEGOC;
    if (valorEmpresaNeg !== undefined && valorEmpresaNeg !== null && valorEmpresaNeg !== '') {
      empresaNegociacao = Number(valorEmpresaNeg);
      if (!inteiroPositivo(empresaNegociacao)) {
        resultado.erros.push(`TOP ${codigoTop} ignorada: "empresaNegociacao" deve ser inteiro positivo.`);
        continue;
      }
    }

    // Tipo de Venda / Negociação (CODTIPVENDA na TGFCAB)
    let tipoVenda = null;
    const valorTipoVenda = entrada.tipoVenda ?? entrada.codigoTipoVenda ?? entrada.CODTIPVENDA;
    if (valorTipoVenda !== undefined && valorTipoVenda !== null && valorTipoVenda !== '') {
      tipoVenda = Number(valorTipoVenda);
      if (!inteiroPositivo(tipoVenda)) {
        resultado.erros.push(`TOP ${codigoTop} ignorada: "tipoVenda" deve ser inteiro positivo.`);
        continue;
      }
    }

    resultado.mapa[codigoTop] = {
      notaModelo,
      codigoEmpresa,
      empresaNegociacao,
      tipoVenda
    };
  }

  return resultado;
}

const mapaNotas = interpretarMapaNotasModelo(process.env.SANKHYA_NOTAS_MODELO);

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  host: '127.0.0.1', // Executar o servidor estritamente em localhost
  sankhya: {
    apiUrl: process.env.SANKHYA_API_URL || 'https://api.sandbox.sankhya.com.br',
    clientId: process.env.SANKHYA_CLIENT_ID || '',
    clientSecret: process.env.SANKHYA_CLIENT_SECRET || '',
    xToken: process.env.SANKHYA_X_TOKEN || '',
    // TOP apenas SUGERIDA na interface (não é obrigatória nem fixa)
    topSugerida: parseInt(process.env.SANKHYA_TOP_SUGERIDA, 10) || null,
    tipoMovimentoPedidoVenda: TIPO_MOVIMENTO_PEDIDO_VENDA,
    notasModelo: mapaNotas.mapa,
    errosConfiguracao: mapaNotas.erros,
    // Variáveis antigas que não são mais utilizadas (apenas para aviso)
    variaveisDescontinuadas: ['SANKHYA_TOP_PADRAO', 'SANKHYA_NOTA_MODELO']
      .filter((nome) => process.env[nome] !== undefined && process.env[nome] !== '')
  }
};

/**
 * Valida se as variáveis de ambiente essenciais foram fornecidas
 */
config.validarConfiguracoes = () => {
  const ausentes = [];
  if (!config.sankhya.clientId) ausentes.push('SANKHYA_CLIENT_ID');
  if (!config.sankhya.clientSecret) ausentes.push('SANKHYA_CLIENT_SECRET');
  if (!config.sankhya.xToken) ausentes.push('SANKHYA_X_TOKEN');

  return {
    valido: ausentes.length === 0,
    ausentes
  };
};

/**
 * Garante que só o ambiente Sandbox seja utilizado nesta fase do projeto.
 */
config.isSandbox = () => /sandbox/i.test(config.sankhya.apiUrl);

/**
 * Retorna a configuração explícita de nota modelo de uma TOP (ou null).
 */
config.obterConfigNotaModelo = (codigoTop) => config.sankhya.notasModelo[Number(codigoTop)] || null;
config.interpretarMapaNotasModelo = interpretarMapaNotasModelo;

module.exports = config;
