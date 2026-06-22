import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ApiClient } from "@mondaydotcomorg/api";

const app = express();
app.use(express.json({ limit: "25mb" }));

const port = Number(process.env.PORT ?? 3000);
const mondayToken = process.env.MONDAY_API_TOKEN;
const mcpAuthToken = process.env.MCP_AUTH_TOKEN;

if (!mondayToken) {
  throw new Error("Missing MONDAY_API_TOKEN environment variable.");
}

if (!mcpAuthToken) {
  throw new Error("Missing MCP_AUTH_TOKEN environment variable.");
}

const client = new ApiClient({
  token: mondayToken,
  apiVersion: "2026-01"
});

function assertAuthorized(req: express.Request) {
  const authorization = req.header("authorization");
  if (authorization !== `Bearer ${mcpAuthToken}`) {
    const error = new Error("Unauthorized");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
}

function createServer() {
  const server = new McpServer({
    name: "Monday Upload Status Report",
    version: "1.0.0"
  });

  server.tool(
    "attach_pdf_to_file_column",
    "Uploads a PDF to a monday.com file column on an item. Use only for PDFs generated as Status Reports.",
    {
      boardId: z.string().describe("monday.com board ID. Example: 18417855948"),
      itemId: z.string().describe("monday.com item ID. Example: 12281560755"),
      columnId: z.string().describe("monday.com file column ID. Example: file_mm4ck1yj"),
      fileName: z.string().describe("PDF filename, including .pdf extension."),
      contentType: z.string().default("application/pdf").describe("Must be application/pdf."),
      fileBase64: z.string().describe("Base64 encoded PDF content.")
    },
    async ({ itemId, columnId, fileName, contentType, fileBase64 }) => {
      if (contentType !== "application/pdf") {
        throw new Error("Only application/pdf uploads are allowed.");
      }

      const fileBytes = Buffer.from(fileBase64, "base64");
      if (!fileBytes.length || fileBytes.subarray(0, 4).toString("ascii") !== "%PDF") {
        throw new Error("fileBase64 does not appear to contain a valid PDF.");
      }

      const file = new File([fileBytes], fileName, { type: contentType });

      const result = await client.request<{
        add_file_to_column: {
          id: string;
          name: string;
          url: string;
        };
      }>(
        `mutation AttachPdf($file: File!, $itemId: ID!, $columnId: String!) {
          add_file_to_column(file: $file, item_id: $itemId, column_id: $columnId) {
            id
            name
            url
          }
        }`,
        {
          file,
          itemId,
          columnId
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              assetId: result.add_file_to_column.id,
              fileName: result.add_file_to_column.name,
              url: result.add_file_to_column.url
            })
          }
        ]
      };
    }
  );

  return server;
}

const transports: Record<string, StreamableHTTPServerTransport> = {};

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "monday-upload-status-report-mcp" });
});

app.post("/mcp", async (req, res) => {
  try {
    assertAuthorized(req);

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports[newSessionId] = transport;
        }
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      const server = createServer();
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: no valid MCP session ID"
        },
        id: null
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    res.status(status).json({
      error: error instanceof Error ? error.message : "Unexpected error"
    });
  }
});

app.get("/mcp", async (req, res) => {
  try {
    assertAuthorized(req);
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports[sessionId] : undefined;

    if (!transport) {
      res.status(400).send("Invalid or missing MCP session ID");
      return;
    }

    await transport.handleRequest(req, res);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    res.status(status).send(error instanceof Error ? error.message : "Unexpected error");
  }
});

app.delete("/mcp", async (req, res) => {
  try {
    assertAuthorized(req);
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports[sessionId] : undefined;

    if (!transport) {
      res.status(400).send("Invalid or missing MCP session ID");
      return;
    }

    await transport.handleRequest(req, res);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    res.status(status).send(error instanceof Error ? error.message : "Unexpected error");
  }
});

app.listen(port, () => {
  console.log(`Monday upload MCP listening on port ${port}`);
});
