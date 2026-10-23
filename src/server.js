const path = require('path');
const express = require('express');
const config = require('./config/sankhya');
const apiRoutes = require('./routes/api');

const app = express();

// Middlewares essenciais
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rotas da API local
app.use('/api', apiRoutes);

// Fallback amigável para a SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  console.error('[Servidor] Erro não tratado:', err.message);
  res.status(500).json({
    sucesso: false,
    mensagem: 'Ocorreu um erro interno no servidor local.'
  });
});

/**
 * Função para iniciar o servidor com tratamento resiliente de porta em uso
 */
function iniciarServidor(portaDesejada) {
  const server = app.listen(portaDesejada, config.host, () => {
    console.log('====================================================');
    console.log('       INTEGRADOR SANKHYA - PEDIDOS DE VENDA        ');
    console.log('====================================================');
    console.log(` Servidor local rodando em: http://${config.host}:${portaDesejada}`);
    console.log(` Acesso no navegador: http://localhost:${portaDesejada}`);
    console.log(` Ambiente Sankhya configurado: ${config.sankhya.apiUrl}`);
    console.log(` TOP sugerida (opcional): ${config.sankhya.topSugerida || 'nenhuma'}`);
    console.log(` Notas modelo mapeadas: ${Object.keys(config.sankhya.notasModelo).length}`);
    console.log('====================================================');

    if (!config.isSandbox()) {
      console.warn('[Atenção] SANKHYA_API_URL não aponta para o Sandbox. As consultas de TOP serão bloqueadas.');
    }
    config.sankhya.errosConfiguracao.forEach((e) => console.warn(`[Configuração] ${e}`));
    if (config.sankhya.variaveisDescontinuadas.length) {
      console.warn(`[Configuração] Variáveis não utilizadas mais: ${config.sankhya.variaveisDescontinuadas.join(', ')}. Use SANKHYA_TOP_SUGERIDA e SANKHYA_NOTAS_MODELO.`);
    }

    const validacao = config.validarConfiguracoes();
    if (!validacao.valido) {
      console.warn(`[Atenção] Variáveis pendentes no .env: ${validacao.ausentes.join(', ')}`);
      console.warn('Preencha seu arquivo .env com suas credenciais do Sandbox para testar a comunicação.');
    } else {
      console.log('[Configuração] Credenciais Sandbox detectadas no arquivo .env.');
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const proximaPorta = portaDesejada + 1;
      console.warn(`\n[Porta ${portaDesejada} em uso] Já existe um processo rodando na porta ${portaDesejada}.`);
      console.log(`[Alternativa automática] Tentando vincular na porta ${proximaPorta}...\n`);
      iniciarServidor(proximaPorta);
    } else {
      console.error('[Servidor] Erro crítico ao iniciar:', err.message);
    }
  });

  return server;
}

iniciarServidor(config.port);

module.exports = { app };
