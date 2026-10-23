const authService = require('c:/Users/israel.cursino/.gemini/antigravity-ide/scratch/sankhya-pedidos/src/services/authService');
const config = require('c:/Users/israel.cursino/.gemini/antigravity-ide/scratch/sankhya-pedidos/src/config/sankhya');

async function probe() {
  const auth = await authService.getAccessToken();
  const headers = { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' };

  async function get(url) {
    const res = await fetch(`${config.sankhya.apiUrl}${url}`, { headers });
    let text = await res.text();
    try {
      return { status: res.status, json: JSON.parse(text) };
    } catch (e) {
      return { status: res.status, text: text.substring(0, 300) };
    }
  }

  console.log('--- 1. LOCAIS DE ESTOQUE ---');
  const locais = await get('/v1/estoque/locais');
  console.log('GET /v1/estoque/locais:', locais.status, JSON.stringify(locais.json || locais.text, null, 2));

  console.log('\n--- 2. LOCAL DE ESTOQUE 0 ---');
  const local0 = await get('/v1/estoque/locais/0');
  console.log('GET /v1/estoque/locais/0:', local0.status, JSON.stringify(local0.json || local0.text, null, 2));

  console.log('\n--- 3. PRODUTO 3 ---');
  const prod3 = await get('/v1/produtos?page=0');
  console.log('GET /v1/produtos:', prod3.status);
  if (prod3.json && prod3.json.data) {
    const item3 = prod3.json.data.find(p => p.codigoProduto === 3 || p.CODPROD === 3);
    console.log('Produto 3 encontrado:', item3);
  }

  console.log('\n--- 4. TIPOS DE PAGAMENTO (TÍTULOS) ---');
  const pagtos = await get('/v1/financeiros/tipos-pagamento?page=0');
  console.log('GET /v1/financeiros/tipos-pagamento:', pagtos.status, JSON.stringify(pagtos.json || pagtos.text, null, 2));

  console.log('\n--- 5. CLIENTE 106 ---');
  const cli106 = await get('/v1/parceiros/clientes?page=0&sort_by=codigoCliente&sort_order=ASC');
  if (cli106.json && cli106.json.data) {
    const c106 = cli106.json.data.find(c => c.codigoCliente === 106);
    console.log('Cliente 106 na página 0:', c106);
  }
}

probe().catch(console.error);
