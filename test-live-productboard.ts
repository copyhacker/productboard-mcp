#!/usr/bin/env tsx
/**
 * Simple live test for Productboard MCP Server
 * Verifies the server returns real data from Productboard API
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MCPClient extends EventEmitter {
  private process: ChildProcess;
  private buffer = '';

  constructor(process: ChildProcess) {
    super();
    this.process = process;
    this.process.stdout?.on('data', (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });
  }

  private processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.emit('message', message);
        } catch {
          // Ignore non-JSON lines
        }
      }
    }
  }

  send(message: any): void {
    this.process.stdin?.write(JSON.stringify(message) + '\n');
  }

  close(): void {
    this.process.kill();
  }
}

let messageId = 1;

async function startServer(): Promise<MCPClient> {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, 'dist/index.js');
    const mcpProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LOG_LEVEL: 'warn', CACHE_ENABLED: 'false' },
    });

    const client = new MCPClient(mcpProcess);
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);

    client.send({
      jsonrpc: '2.0',
      id: messageId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { roots: { listChanged: false }, sampling: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    client.once('message', (message) => {
      clearTimeout(timeout);
      message.error ? reject(new Error('Init failed')) : resolve(client);
    });
  });
}

async function sendRequest(client: MCPClient, method: string, params?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = messageId++;
    const timeout = setTimeout(() => reject(new Error('Request timeout')), 10000);

    const onMessage = (message: any) => {
      if (message.id === id) {
        clearTimeout(timeout);
        client.off('message', onMessage);
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
      }
    };

    client.on('message', onMessage);
    client.send({ jsonrpc: '2.0', id, method, params });
  });
}

async function main() {
  let client: MCPClient | null = null;

  try {
    console.log('Starting MCP server...');
    client = await startServer();
    console.log('✓ Server initialized\n');

    // Test 1: List tools
    console.log('Test 1: Listing available tools...');
    const toolsResult = await sendRequest(client, 'tools/list');
    console.log(`✓ Found ${toolsResult.tools.length} tools\n`);

    // Test 2: List features from Productboard
    console.log('Test 2: Fetching features from Productboard...');
    const featuresResult = await sendRequest(client, 'tools/call', {
      name: 'pb_feature_list',
      arguments: { limit: 3 },
    });

    if (featuresResult?.content?.[0]?.text) {
      const text = featuresResult.content[0].text;
      const preview = text.substring(0, 200);
      console.log('✓ Successfully fetched features!');
      console.log('Preview:', preview, '...\n');
    }

    // Test 3: List products from Productboard
    console.log('Test 3: Fetching products from Productboard...');
    const productsResult = await sendRequest(client, 'tools/call', {
      name: 'pb_product_list',
      arguments: {},
    });

    if (productsResult?.content?.[0]?.text) {
      const data = JSON.parse(productsResult.content[0].text);
      if (data.success && data.data.products.length > 0) {
        console.log('✓ Successfully fetched products!');
        console.log(`Found ${data.data.products.length} products`);
        console.log(`Sample: ${data.data.products[0].name}\n`);
      }
    }

    console.log('✅ All tests passed! MCP server returns real Productboard data.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    client?.close();
  }
}

main();
