# Monday Upload Status Report MCP

Mini servidor MCP com uma unica ferramenta:

`attach_pdf_to_file_column`

Ela recebe um PDF em base64 e anexa o arquivo em uma coluna de arquivo de um item do monday.com.

## Variaveis de ambiente

Configure no Render:

```text
MONDAY_API_TOKEN=<seu token do monday>
MCP_AUTH_TOKEN=<um token interno longo para proteger o MCP>
```

## Render

Campos sugeridos:

```text
Name: monday-upload-status-report-mcp
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm start
```

Depois do deploy, use esta URL no ChatGPT:

```text
https://SEU-SERVICO.onrender.com/mcp
```

## ChatGPT

Crie um MCP Personalizado:

```text
Nome: Monday Upload Status Report
Descricao: Ferramenta para anexar PDFs de Status Report em colunas de arquivo do Monday.com.
URL do servidor MCP: https://SEU-SERVICO.onrender.com/mcp
Autenticacao: Bearer Token
Token: o mesmo valor de MCP_AUTH_TOKEN
```

## Teste inicial

Use o quadro DEMO:

```text
boardId: 18417855948
itemId: 12281560755
columnId: file_mm4ck1yj
```

