const http = require('http');

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3001,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let resData = '';
        res.on('data', (c) => (resData += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(resData) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: resData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port: 3001, path }, (res) => {
      let resData = '';
      res.on('data', (c) => (resData += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resData) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resData });
        }
      });
    });
    req.on('error', reject);
  });
}

async function runTests() {
  console.log('--- TESTE E2E: TOP 3199 E MODELO 799010 ---');

  // 1. GET /api/tops
  console.log('\n[1] Consultando /api/tops...');
  const resTops = await getJson('/api/tops');
  console.log('Status HTTP:', resTops.status);
  console.log('Sucesso:', resTops.body.sucesso);
  console.log('TOP sugerida:', resTops.body.topSugerida);

  const top3199 = (resTops.body.tops || []).find((t) => t.codigoTipoOperacao === 3199);
  if (!top3199) {
    throw new Error('ERRO: TOP 3199 não encontrada na lista retornada!');
  }
  console.log('TOP 3199 encontrada:');
  console.log('  Nome:', top3199.nome);
  console.log('  Tipo de Movimento:', top3199.tipoMovimento, `(${top3199.tipoMovimentoDescricao})`);
  console.log('  Ativo:', top3199.ativo);
  console.log('  Compatibilidade:', top3199.compatibilidade);

  if (!top3199.compatibilidade.prontaParaPedido) {
    throw new Error('ERRO: TOP 3199 deveria estar prontaParaPedido = true!');
  }
  if (top3199.compatibilidade.notaModelo !== 799010) {
    throw new Error(`ERRO: notaModelo esperado 799010, obtido ${top3199.compatibilidade.notaModelo}`);
  }
  if (top3199.compatibilidade.codigoEmpresa !== 4) {
    throw new Error(`ERRO: codigoEmpresa (documento) esperado 4, obtido ${top3199.compatibilidade.codigoEmpresa}`);
  }
  if (top3199.compatibilidade.empresaNegociacao !== 1) {
    throw new Error(`ERRO: empresaNegociacao esperado 1, obtido ${top3199.compatibilidade.empresaNegociacao}`);
  }
  if (top3199.compatibilidade.tipoVenda !== 2) {
    throw new Error(`ERRO: tipoVenda esperado 2, obtido ${top3199.compatibilidade.tipoVenda}`);
  }
  console.log('>> [OK] TOP 3199 associada corretamente à notaModelo 799010 com CODEMP=4, CODEMPNEGOC=1 e CODTIPVENDA=2');

  // 2. POST /api/pedidos/preparar
  console.log('\n[2] Testando /api/pedidos/preparar com TOP 3199...');
  const resPrep = await postJson('/api/pedidos/preparar', {
    codigoCliente: 7352,
    codigoTop: 3199,
    itens: [
      { codigoProduto: 1, quantidade: 2.5, valorUnitario: 100.0 }
    ]
  });

  console.log('Status HTTP:', resPrep.status);
  console.log('Resultado:', {
    sucesso: resPrep.body.sucesso,
    notaModelo: resPrep.body.notaModelo,
    codigoEmpresa: resPrep.body.codigoEmpresa,
    empresaNegociacao: resPrep.body.empresaNegociacao,
    tipoVenda: resPrep.body.tipoVenda,
    totalEstimado: resPrep.body.totalEstimado,
    envioHabilitado: resPrep.body.envioHabilitado
  });
  console.log('\nPayload JSON gerado para a API Sankhya:');
  console.log(JSON.stringify(resPrep.body.payloadGerado, null, 2));

  const payload = resPrep.body.payloadGerado;
  const payloadSob = resPrep.body.payloadComSobrescritas;

  if (payload.notaModelo !== 799010) throw new Error('payload.notaModelo incorreto!');
  if (payload.codigoCliente !== 7352) throw new Error('payload.codigoCliente incorreto!');
  if (!Array.isArray(payload.financeiros) || payload.financeiros.length === 0) {
    throw new Error('payload.financeiros deve estar presente!');
  }

  // Validação do payload com sobrescrita explícita
  if (payloadSob.CODEMP !== 4) throw new Error('payloadSob.CODEMP incorreto! Esperado: 4');
  if (payloadSob.CODEMPNEGOC !== 1) throw new Error('payloadSob.CODEMPNEGOC incorreto! Esperado: 1');
  if (payloadSob.CODTIPOPER !== 3199) throw new Error('payloadSob.CODTIPOPER incorreto! Esperado: 3199');
  if (payloadSob.CODTIPVENDA !== 2) throw new Error('payloadSob.CODTIPVENDA incorreto! Esperado: 2');

  console.log('\nPendências para envio futuro:');
  (resPrep.body.pendenciasParaEnvio || []).forEach((p) => console.log('  -', p));
  console.log('>> [OK] Payload preparado com fidelidade aos campos e distinção de CODEMP e CODEMPNEGOC!');

  // 3. POST /api/pedidos (Gravação bloqueada)
  console.log('\n[3] Testando POST /api/pedidos (deve estar bloqueado)...');
  const resBloc = await postJson('/api/pedidos', {
    codigoCliente: 7352,
    codigoTop: 3199,
    itens: [{ codigoProduto: 1, quantidade: 1, valorUnitario: 10 }]
  });
  console.log('Status HTTP:', resBloc.status);
  console.log('Resposta:', resBloc.body);
  if (resBloc.status !== 501) {
    throw new Error(`ERRO: POST /api/pedidos deveria retornar status 501, retornou ${resBloc.status}`);
  }
  console.log('>> [OK] Gravação confirmada como desabilitada (HTTP 501).');

  console.log('\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===');
}

runTests().catch((err) => {
  console.error('FALHA NOS TESTES:', err);
  process.exit(1);
});
