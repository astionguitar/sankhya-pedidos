const config = require('../src/config/sankhya');
const parser = config.interpretarMapaNotasModelo;

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
  console.log('PASS:', message);
}

// Teste 1: Formato existente - apenas número
const t1 = parser('{"3100": 1050}');
assert(t1.mapa[3100]?.notaModelo === 1050, 'Formato número simples: notaModelo 1050');
assert(t1.mapa[3100]?.codigoEmpresa === null, 'Formato número simples: codigoEmpresa null');
assert(t1.erros.length === 0, 'Formato número simples: sem erros');

// Teste 2: Formato existente - objeto com notaModelo e codigoEmpresa
const t2 = parser('{"3188": {"notaModelo": 1050, "codigoEmpresa": 1}}');
assert(t2.mapa[3188]?.notaModelo === 1050, 'Formato objeto existente: notaModelo 1050');
assert(t2.mapa[3188]?.codigoEmpresa === 1, 'Formato objeto existente: codigoEmpresa 1');
assert(t2.mapa[3188]?.empresaNegociacao === null, 'Formato objeto existente: empresaNegociacao null');
assert(t2.erros.length === 0, 'Formato objeto existente: sem erros');

// Teste 3: Novo formato com empresaNegociacao e tipoVenda (TOP 3199 com modelo 799010)
const t3 = parser('{"3199": {"notaModelo": 799010, "codigoEmpresa": 4, "empresaNegociacao": 1, "tipoVenda": 2}}');
assert(t3.mapa[3199]?.notaModelo === 799010, 'Novo formato TOP 3199: notaModelo 799010');
assert(t3.mapa[3199]?.codigoEmpresa === 4, 'Novo formato TOP 3199: codigoEmpresa (documento) 4');
assert(t3.mapa[3199]?.empresaNegociacao === 1, 'Novo formato TOP 3199: empresaNegociacao 1');
assert(t3.mapa[3199]?.tipoVenda === 2, 'Novo formato TOP 3199: tipoVenda (CODTIPVENDA) 2');
assert(t3.erros.length === 0, 'Novo formato TOP 3199: sem erros');

// Teste 4: Formato com aliases CODEMP e CODEMPNEGOC
const t4 = parser('{"3199": {"notaModelo": 799010, "CODEMP": 4, "CODEMPNEGOC": 1, "CODTIPVENDA": 2}}');
assert(t4.mapa[3199]?.codigoEmpresa === 4, 'Aliases ERP: CODEMP 4');
assert(t4.mapa[3199]?.empresaNegociacao === 1, 'Aliases ERP: CODEMPNEGOC 1');
assert(t4.mapa[3199]?.tipoVenda === 2, 'Aliases ERP: CODTIPVENDA 2');

// Teste 5: Multiplas TOPs juntas (3188 e 3199)
const t5 = parser('{"3188": {"notaModelo": 1050, "codigoEmpresa": 1}, "3199": {"notaModelo": 799010, "codigoEmpresa": 4, "empresaNegociacao": 1, "tipoVenda": 2}}');
assert(t5.mapa[3188]?.notaModelo === 1050, 'Múltiplas TOPs: 3188 notaModelo 1050');
assert(t5.mapa[3199]?.notaModelo === 799010, 'Múltiplas TOPs: 3199 notaModelo 799010');
assert(t5.mapa[3199]?.codigoEmpresa === 4, 'Múltiplas TOPs: 3199 empresa 4');
assert(t5.mapa[3199]?.empresaNegociacao === 1, 'Múltiplas TOPs: 3199 negociacao 1');
assert(t5.erros.length === 0, 'Múltiplas TOPs: sem erros');

// Teste 6: Entradas inválidas
const t6 = parser('{"3199": {"notaModelo": -1}}');
assert(t6.erros.length > 0, 'Validação de erro: notaModelo negativo rejeitada');

console.log('TODOS OS TESTES DO PARSER PASSARAM COM SUCESSO!');
