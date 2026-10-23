const authService = require('c:/Users/israel.cursino/.gemini/antigravity-ide/scratch/sankhya-pedidos/src/services/authService');
const config = require('c:/Users/israel.cursino/.gemini/antigravity-ide/scratch/sankhya-pedidos/src/config/sankhya');

async function checkProdCli() {
  const auth = await authService.getAccessToken();
  const headers = { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' };

  // 1. Estoque do produto 3
  const est3 = await fetch(`${config.sankhya.apiUrl}/v1/produtos/3/estoques`, { headers });
  console.log('GET /v1/produtos/3/estoques:', est3.status, await est3.text());

  // 2. Outra rota de estoque: GET /v1/estoque/produtos?codigoProduto=3
  const estProd = await fetch(`${config.sankhya.apiUrl}/v1/estoque/produtos?codigoProduto=3`, { headers });
  console.log('GET /v1/estoque/produtos?codigoProduto=3:', estProd.status, await estProd.text());

  // 3. Cliente 106
  const cli106 = await fetch(`${config.sankhya.apiUrl}/v1/parceiros/clientes/106`, { headers });
  console.log('GET /v1/parceiros/clientes/106:', cli106.status, await cli106.text());

  // 4. Produto 3 direto
  const p3 = await fetch(`${config.sankhya.apiUrl}/v1/produtos/3`, { headers });
  console.log('GET /v1/produtos/3:', p3.status, await p3.text());
}

checkProdCli().catch(console.error);
