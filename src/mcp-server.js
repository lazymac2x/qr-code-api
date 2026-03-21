#!/usr/bin/env node

/**
 * QR Code MCP Server
 * Model Context Protocol server for QR code generation.
 * Communicates via stdio (JSON-RPC 2.0).
 */

const { generate, buildVCard, buildWifi, buildEmail, buildPhone, toBase64 } = require('./generator');

const SERVER_INFO = {
  name: 'qr-code-api',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'generate_qr',
    description: 'Generate a QR code from text or URL. Returns base64 PNG data URL.',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Text or URL to encode' },
        size: { type: 'number', description: 'Image width in pixels (default 300)' },
        errorCorrectionLevel: { type: 'string', enum: ['L', 'M', 'Q', 'H'], description: 'Error correction level' },
        darkColor: { type: 'string', description: 'Dark module color (hex, e.g. #000000)' },
        lightColor: { type: 'string', description: 'Light module color (hex, e.g. #ffffff)' },
      },
      required: ['data'],
    },
  },
  {
    name: 'generate_vcard_qr',
    description: 'Generate a QR code from vCard contact information. Returns base64 PNG data URL.',
    inputSchema: {
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        org: { type: 'string' },
        title: { type: 'string' },
        url: { type: 'string' },
        address: { type: 'string' },
        size: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'generate_wifi_qr',
    description: 'Generate a QR code for WiFi network credentials. Returns base64 PNG data URL.',
    inputSchema: {
      type: 'object',
      properties: {
        ssid: { type: 'string', description: 'WiFi network name' },
        password: { type: 'string', description: 'WiFi password' },
        encryption: { type: 'string', enum: ['WPA', 'WEP', 'nopass'], description: 'Encryption type (default WPA)' },
        size: { type: 'number' },
      },
      required: ['ssid'],
    },
  },
  {
    name: 'generate_email_qr',
    description: 'Generate a QR code for a mailto link. Returns base64 PNG data URL.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Email address' },
        subject: { type: 'string' },
        body: { type: 'string' },
        size: { type: 'number' },
      },
      required: ['to'],
    },
  },
  {
    name: 'generate_phone_qr',
    description: 'Generate a QR code for a phone number (tel: link). Returns base64 PNG data URL.',
    inputSchema: {
      type: 'object',
      properties: {
        number: { type: 'string', description: 'Phone number' },
        size: { type: 'number' },
      },
      required: ['number'],
    },
  },
];

// --- JSON-RPC helpers ---

function jsonrpcResponse(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function jsonrpcError(id, code, message) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

// --- Tool handlers ---

async function handleToolCall(name, args) {
  const opts = { size: args.size, errorCorrectionLevel: args.errorCorrectionLevel, darkColor: args.darkColor, lightColor: args.lightColor };

  switch (name) {
    case 'generate_qr': {
      const b64 = await toBase64(args.data, opts);
      return [{ type: 'text', text: b64 }];
    }
    case 'generate_vcard_qr': {
      const vcard = buildVCard(args);
      const b64 = await toBase64(vcard, opts);
      return [{ type: 'text', text: b64 }];
    }
    case 'generate_wifi_qr': {
      const wifi = buildWifi(args);
      const b64 = await toBase64(wifi, opts);
      return [{ type: 'text', text: b64 }];
    }
    case 'generate_email_qr': {
      const mailto = buildEmail(args);
      const b64 = await toBase64(mailto, opts);
      return [{ type: 'text', text: b64 }];
    }
    case 'generate_phone_qr': {
      const tel = buildPhone(args);
      const b64 = await toBase64(tel, opts);
      return [{ type: 'text', text: b64 }];
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- Message handler ---

async function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      return jsonrpcResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case 'notifications/initialized':
      return null; // no response needed

    case 'tools/list':
      return jsonrpcResponse(id, { tools: TOOLS });

    case 'tools/call': {
      try {
        const content = await handleToolCall(params.name, params.arguments || {});
        return jsonrpcResponse(id, { content });
      } catch (err) {
        return jsonrpcResponse(id, {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        });
      }
    }

    default:
      return jsonrpcError(id, -32601, `Method not found: ${method}`);
  }
}

// --- stdio transport ---

let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep incomplete line in buffer

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      const response = await handleMessage(msg);
      if (response) {
        process.stdout.write(response + '\n');
      }
    } catch (err) {
      const errResp = jsonrpcError(null, -32700, `Parse error: ${err.message}`);
      process.stdout.write(errResp + '\n');
    }
  }
});

process.stderr.write('QR Code MCP Server started (stdio)\n');
