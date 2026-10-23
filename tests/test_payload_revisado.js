const pedidoService = require('../src/services/pedidoService');

async function testarPayloadRevisado() {
  console.log('=== TESTE DE REVISÃO DO PAYLOAD (TOP 3199 + NOTA MODELO 799010 + PROD 3 + CLI 106) ===\n');

  const pedidoExemplo = {
    codigoCliente: 106,
    codigoTop: 3199,
    itens: [
      {
        codigoProduto: 3,
        quantidade: 1,
        valorUnitario: 20,
        codigoLocalEstoque: 0 // local 0 para testar alerta
      }
    ]
  };

  const resultado = await pedidoService.prepararPedido(pedidoExemplo);

  console.log('[1] Sucesso da preparação:', resultado.sucesso);
  console.log('[2] TOP validada:', resultado.top);
  console.log('[3] Nota Modelo herdada:', resultado.notaModelo);
  console.log('[4] Total Estimado:', resultado.totalEstimado);

  console.log('\n--- PAYLOAD CANÔNICO (HERDANDO DA NOTA MODELO, SEM SOBRESCRITA DESNECESSÁRIA) ---');
  console.log(JSON.stringify(resultado.payloadGerado, null, 2));

  console.log('\n--- PAYLOAD COM SOBRESCRITA EXPLÍCITA (SE DESEJADO FORÇAR TGFCAB) ---');
  console.log(JSON.stringify(resultado.payloadComSobrescritas, null, 2));

  console.log('\n--- AVISOS DE VALIDAÇÃO ---');
  resultado.avisos.forEach((a, i) => console.log(` ${i + 1}. ${a}`));

  console.log('\n--- PENDÊNCIAS PARA ENVIO DEFINITIVO ---');
  resultado.pendenciasParaEnvio.forEach((p, i) => console.log(` ${i + 1}. ${p}`));

  // Validações automáticas
  const payload = resultado.payloadGerado;
  if (payload.notaModelo !== 799010) throw new Error('notaModelo deve ser 799010');
  if (payload.codigoCliente !== 106) throw new Error('codigoCliente deve ser 106');
  if (payload.valorTotal !== 20) throw new Error('valorTotal deve ser 20');
  if (!Array.isArray(payload.financeiros) || payload.financeiros.length !== 1) {
    throw new Error('financeiros deve conter 1 parcela para depósito à vista');
  }
  if (payload.financeiros[0].valorParcela !== 20) {
    throw new Error('valorParcela deve ser 20');
  }
  if (payload.CODEMP !== undefined) {
    throw new Error('Payload canônico não deve sobrescrever CODEMP sem necessidade');
  }

  console.log('\n>> [SUCESSO] Todas as regras de negócio e exigências da API oficial foram atendidas!');
}

testarPayloadRevisado().catch((err) => {
  console.error('FALHA:', err);
  process.exit(1);
});
