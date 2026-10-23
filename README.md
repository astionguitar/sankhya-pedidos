# Integrador de Pedidos de Venda - Sankhya ERP

Aplicação Web local em **Node.js + Express** para integração com o **ERP Sankhya (Ambiente Sandbox)**, com seleção dinâmica de Tipos de Operação (TOPs) e validação de Notas Modelo.

---

## 🎯 Objetivo da Aplicação

- Fornecer uma interface moderna e segura para:
  - Consultar clientes no Sandbox pelo código (`CODPARC`) via endpoint oficial `GET /v1/parceiros/clientes`.
  - Consultar dinamicamente os **Tipos de Operação (TOP)** ativos de Pedido de Venda via endpoint oficial `GET /v1/tipos-operacao?tipoMovimento=19`.
  - Pesquisar TOPs por código ou descrição com sugestão inicial configurável (`SANKHYA_TOP_SUGERIDA`).
  - Mapear e validar explicitamente a associação entre cada TOP e sua respectiva **Nota Modelo** (`SANKHYA_NOTAS_MODELO`).
  - Adicionar múltiplos produtos (`CODPROD`, quantidade e valor unitário) com recálculo em tempo real.
  - Validar a estrutura do pedido e a compatibilidade da TOP diretamente no backend antes de qualquer submissão.
- Gerenciar a autenticação **OAuth 2.0 Client Credentials** com renovação automática do token Bearer a cada 300 segundos, mantendo todas as credenciais no backend local sem expô-las ao navegador.
- **Ambiente restrito ao Sandbox**: Nenhuma gravação definitiva via `POST /v1/vendas/pedidos` é realizada nesta etapa até a validação completa de TOPs e notas modelo.

---

## 📁 Estrutura do Projeto

```text
sankhya-pedidos/
├── .env                  # Variáveis de ambiente locais (porta, credenciais sandbox, mapeamento TOP/modelo)
├── .env.example          # Modelo documentado com todas as variáveis
├── .gitignore            # Protege arquivos sensíveis (.env, node_modules)
├── package.json          # Dependências e scripts
├── README.md             # Documentação técnica e guia de execução
├── src/
│   ├── server.js         # Servidor Express escutando em 127.0.0.1:3001 (resiliente a portas em uso)
│   ├── config/
│   │   └── sankhya.js    # Configurações, validação de sandbox e parser de SANKHYA_NOTAS_MODELO
│   ├── services/
│   │   ├── authService.js    # OAuth 2.0 Client Credentials (Basic Auth + X-Token) e cache
│   │   ├── clienteService.js # Consulta oficial de clientes (/v1/parceiros/clientes)
│   │   ├── topService.js     # Consulta oficial de TOPs (/v1/tipos-operacao) e avaliação de regras
│   │   └── pedidoService.js  # Validação de regras e montagem do payload do pedido
│   ├── controllers/
│   │   ├── clienteController.js # Endpoints locais de clientes e status
│   │   ├── topController.js     # Endpoints locais de consulta e busca de TOPs
│   │   └── pedidoController.js  # Preparação e validação local de pedidos
│   └── routes/
│       └── api.js        # Definição das rotas REST locais (/api/*)
└── public/
    ├── index.html        # Interface Web moderna com seletor pesquisável de TOP
    ├── css/
    │   └── style.css     # Estilização com design tokens, combobox e responsividade
    └── js/
        └── app.js        # Lógica frontend: combobox de TOPs, produtos e modal
```

---

## ⚙️ Pré-requisitos

- **Node.js** (v18 ou superior)
- **NPM** instalado

---

## 🚀 Instalação e Execução

### 1. Navegar até a pasta do projeto
```bash
cd "C:\Users\israel.cursino\.gemini\antigravity-ide\scratch\sankhya-pedidos"
```

### 2. Instalar dependências (se necessário)
```bash
npm install
```

### 3. Configurar o arquivo `.env`
Edite o arquivo `.env` na raiz com suas credenciais do Sandbox:

```env
PORT=3001
SANKHYA_API_URL=https://api.sandbox.sankhya.com.br

# Credenciais Sandbox (Área do Desenvolvedor)
SANKHYA_CLIENT_ID=seu_client_id_aqui
SANKHYA_CLIENT_SECRET=seu_client_secret_aqui
SANKHYA_X_TOKEN=seu_x_token_aqui

# TOP sugerida inicialmente no combobox (opcional, ex: 3100)
SANKHYA_TOP_SUGERIDA=3100

# Mapeamento explícito TOP -> Nota Modelo (JSON)
# Exemplo 1 (apenas modelo):
# SANKHYA_NOTAS_MODELO={"3100": 1050, "3101": 1051}
# Exemplo 2 (modelo + empresa):
# SANKHYA_NOTAS_MODELO={"3100": {"notaModelo": 1050, "codigoEmpresa": 1}}
SANKHYA_NOTAS_MODELO=
```

### 4. Iniciar a aplicação
```bash
npm run dev
```

### 5. Acessar no Navegador
👉 [http://localhost:3001](http://localhost:3001)

---

## 🔌 Rotas Locais da API

| Método | Rota Local | Descrição | Integração Sankhya |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/status` | Diagnóstico de credenciais e status de conexão | Local / Cache |
| `POST` | `/api/auth/test` | Força teste de autenticação OAuth 2.0 | `POST /authenticate` |
| `POST` | `/api/conexao/test` | Testa autenticação + consulta de clientes | `GET /v1/parceiros/clientes` |
| `GET` | `/api/tops` | Lista TOPs ativas de Pedido de Venda (`?q=` filtra busca) | `GET /v1/tipos-operacao?tipoMovimento=19` |
| `GET` | `/api/tops/:codigo` | Detalha uma TOP e avalia compatibilidade | `GET /v1/tipos-operacao/{codigo}` |
| `GET` | `/api/clientes` | Lista parceiros clientes com paginação | `GET /v1/parceiros/clientes` |
| `GET` | `/api/clientes/:codParc` | Consulta um cliente específico por código | `GET /v1/parceiros/clientes` |
| `POST` | `/api/pedidos/preparar` | Valida cliente, TOP e itens; monta payload | `GET /v1/tipos-operacao/{codigo}` |
| `POST` | `/api/pedidos` | Bloqueado com HTTP 501 nesta etapa | Não executa gravação |
