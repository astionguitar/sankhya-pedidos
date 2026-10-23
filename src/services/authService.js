const config = require('../config/sankhya');

class AuthService {
  constructor() {
    this.accessToken = null;
    this.expiresAt = 0; // Timestamp em milissegundos
    this.tokenType = 'Bearer';
    this.isAuthenticating = null; // Promise lock para evitar requisições concorrentes de login
  }

  /**
   * Verifica se o token atual ainda é válido (com margem de segurança de 30 segundos)
   */
  isTokenValido() {
    const margemSegurancaMs = 30 * 1000;
    return this.accessToken && (Date.now() + margemSegurancaMs) < this.expiresAt;
  }

  /**
   * Obtém um token Bearer válido, reutilizando o cache ou renovando automaticamente
   * @param {boolean} forcarRenovacao - Se true, força a geração de um novo token
   * @returns {Promise<string>} access_token
   */
  async getAccessToken(forcarRenovacao = false) {
    if (!forcarRenovacao && this.isTokenValido()) {
      const segundosRestantes = Math.round((this.expiresAt - Date.now()) / 1000);
      return {
        token: this.accessToken,
        tokenType: this.tokenType,
        cached: true,
        expiresInSeconds: segundosRestantes
      };
    }

    // Se já houver uma autenticação em andamento, aguarda a resolução para evitar chamadas duplicadas
    if (this.isAuthenticating) {
      return this.isAuthenticating;
    }

    this.isAuthenticating = this._autenticar();
    try {
      const resultado = await this.isAuthenticating;
      return resultado;
    } finally {
      this.isAuthenticating = null;
    }
  }

  /**
   * Executa a requisição oficial de autenticação OAuth 2.0 (Client Credentials)
   * Endpoint: POST /authenticate
   * Headers:
   *   - Authorization: Basic <base64(client_id:client_secret)>
   *   - X-Token: <token_gateway>
   *   - Content-Type: application/x-www-form-urlencoded
   *   - Accept: application/json
   * Body:
   *   - grant_type: client_credentials
   */
  async _autenticar() {
    const validacao = config.validarConfiguracoes();
    if (!validacao.valido) {
      throw new Error(`Credenciais incompletas no arquivo .env: ${validacao.ausentes.join(', ')}`);
    }

    const authUrl = `${config.sankhya.apiUrl}/authenticate`;
    const basicAuthCredentials = Buffer.from(
      `${config.sankhya.clientId}:${config.sankhya.clientSecret}`
    ).toString('base64');

    const headers = {
      'Authorization': `Basic ${basicAuthCredentials}`,
      'X-Token': config.sankhya.xToken,
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const body = new URLSearchParams({
      grant_type: 'client_credentials'
    }).toString();

    console.log(`[AuthService] Solicitando token de autenticação em: ${config.sankhya.apiUrl}/authenticate...`);

    let response;
    try {
      response = await fetch(authUrl, {
        method: 'POST',
        headers,
        body
      });
    } catch (networkError) {
      console.error('[AuthService] Falha de comunicação de rede ao tentar conectar com Sankhya Sandbox');
      throw new Error(`Não foi possível conectar ao servidor da Sankhya: ${networkError.message}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { rawResponse: text };
      }
    }

    if (!response.ok) {
      console.error(`[AuthService] Falha na autenticação. Status HTTP: ${response.status}`);
      let mensagemErro = `Erro na autenticação (HTTP ${response.status})`;

      if (response.status === 401) {
        mensagemErro = 'Credenciais inválidas: verifique SANKHYA_CLIENT_ID, SANKHYA_CLIENT_SECRET e SANKHYA_X_TOKEN no .env';
      } else if (response.status === 400) {
        mensagemErro = `Requisição inválida (HTTP 400): ${JSON.stringify(data.error_description || data.error || data)}`;
      } else if (data && (data.error_description || data.error || data.mensagem)) {
        mensagemErro = `${mensagemErro}: ${data.error_description || data.error || data.mensagem}`;
      }

      throw new Error(mensagemErro);
    }

    if (!data.access_token) {
      throw new Error('A resposta da Sankhya não retornou o campo "access_token".');
    }

    const expiresIn = Number(data.expires_in) || 300;
    this.accessToken = data.access_token;
    this.tokenType = data.token_type || 'Bearer';
    this.expiresAt = Date.now() + (expiresIn * 1000);

    console.log(`[AuthService] Token de acesso obtido com sucesso! Válido por ${expiresIn} segundos.`);

    return {
      token: this.accessToken,
      tokenType: this.tokenType,
      cached: false,
      expiresInSeconds: expiresIn
    };
  }

  /**
   * Invalida o token atual em cache, forçando a obtenção de um novo na próxima requisição
   */
  invalidarToken() {
    this.accessToken = null;
    this.expiresAt = 0;
  }

  /**
   * Executa uma requisição HTTP autenticada contra a API da Sankhya.
   * Se a API responder HTTP 401 (token expirado ou invalidado), limpa o cache,
   * gera um novo Bearer token automaticamente e repete a chamada uma vez.
   * @param {string} caminhoOuUrl - Endpoint (ex: /v1/produtos) ou URL completa
   * @param {Object} options - Parâmetros do fetch (method, body, headers adicionais)
   */
  async executarRequisicao(caminhoOuUrl, options = {}) {
    let auth = await this.getAccessToken();
    const url = caminhoOuUrl.startsWith('http') ? caminhoOuUrl : `${config.sankhya.apiUrl}${caminhoOuUrl}`;

    const montarHeaders = (tok) => ({
      'Authorization': `Bearer ${tok}`,
      'Accept': 'application/json',
      ...(options.headers || {})
    });

    let response = await fetch(url, { ...options, headers: montarHeaders(auth.token) });

    if (response.status === 401) {
      console.warn('[AuthService] HTTP 401 recebido da API Sankhya. Renovando token e tentando novamente...');
      this.invalidarToken();
      auth = await this.getAccessToken(true);
      response = await fetch(url, { ...options, headers: montarHeaders(auth.token) });
    }

    return response;
  }

  /**
   * Retorna o status atual da autenticação sem expor tokens
   */
  getStatus() {
    const configurado = config.validarConfiguracoes();
    const valido = this.isTokenValido();
    const segundosRestantes = valido ? Math.round((this.expiresAt - Date.now()) / 1000) : 0;

    return {
      configurado: configurado.valido,
      variaveisAusentes: configurado.ausentes,
      apiUrl: config.sankhya.apiUrl,
      sandbox: config.isSandbox(),
      tokenAtivo: valido,
      segundosRestantes,
      topSugerida: config.sankhya.topSugerida,
      topsComNotaModelo: Object.keys(config.sankhya.notasModelo).map(Number),
      errosConfiguracao: config.sankhya.errosConfiguracao
    };
  }
}

module.exports = new AuthService();
