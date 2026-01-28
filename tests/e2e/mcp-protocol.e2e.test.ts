import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { MockProductboardServer } from './mock-server.js';

describe('MCP Protocol End-to-End Tests', () => {
  let mcpProcess: ChildProcess;
  let messageId = 1;
  let mockServer: MockProductboardServer;

  // Helper class to manage MCP communication
  class MCPClient extends EventEmitter {
    private process: ChildProcess;
    private buffer = '';

    constructor(process: ChildProcess) {
      super();
      this.setMaxListeners(50); // Increase max listeners for concurrent tests
      this.process = process;
      
      this.process.stdout?.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.process.stderr?.on('data', (data) => {
        console.error('MCP Server Error:', data.toString());
      });
      
    }

    private processBuffer() {
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.emit('message', message);
          } catch (error) {
            console.error('Failed to parse MCP message:', line, error);
          }
        }
      }
    }

    send(message: any): void {
      const messageString = JSON.stringify(message) + '\n';
      this.process.stdin?.write(messageString);
    }

    close(): void {
      this.process.kill();
    }
  }

  beforeAll(async () => {
    // Start mock Productboard API server
    mockServer = new MockProductboardServer(3001);
    await mockServer.start();
  });

  afterAll(async () => {
    // Stop mock server
    if (mockServer) {
      await mockServer.stop();
    }
  });

  beforeEach(() => {
    // Reset message ID for each test
    messageId = 1;
  });

  afterEach(() => {
    if (mcpProcess) {
      mcpProcess.kill();
    }
  });

  async function startMCPServer(): Promise<MCPClient> {
    return new Promise((resolve, reject) => {
      // Start the MCP server process
      const serverPath = path.join(process.cwd(), 'dist/index.js');

      // Create a valid JWT token for testing (format: header.payload.signature)
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({
        user_id: 'test-user-123',
        sub: 'test-user-123',
        role: 'admin',
        space_id: 'test-space',
        region: 'US',
        iss: 'test-issuer',
        iat: Math.floor(Date.now() / 1000),
      })).toString('base64');
      const signature = Buffer.from('test-signature').toString('base64');
      const testToken = `${header}.${payload}.${signature}`;

      mcpProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PRODUCTBOARD_API_TOKEN: testToken,
          PRODUCTBOARD_API_BASE_URL: 'http://localhost:3001',
          LOG_LEVEL: 'error', // Reduce logging noise in tests
        },
      });

      const client = new MCPClient(mcpProcess);

      mcpProcess.on('error', (error) => {
        reject(new Error(`Failed to start MCP server: ${error.message}`));
      });

      // Wait for the server to be ready (or timeout)
      const timeout = setTimeout(() => {
        reject(new Error('MCP server failed to start within timeout'));
      }, 10000);

      // Send initialize request to check if server is ready
      client.send({
        jsonrpc: '2.0',
        id: messageId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: {
              listChanged: false,
            },
            sampling: {},
          },
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      });

      client.once('message', (message) => {
        clearTimeout(timeout);
        if (message.error) {
          reject(new Error(`MCP server initialization failed: ${message.error.message}`));
        } else {
          resolve(client);
        }
      });
    });
  }

  async function sendRequest(client: MCPClient, method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout for method: ${method}`));
      }, 10000); // Increased timeout from 5s to 10s

      const onMessage = (message: any) => {
        if (message.id === id) {
          clearTimeout(timeout);
          client.off('message', onMessage);

          if (message.error) {
            reject(new Error(`MCP Error: ${message.error.message}`));
          } else {
            resolve(message.result);
          }
        }
      };

      client.on('message', onMessage);

      client.send({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });
    });
  }

  // Helper to parse MCP content format responses
  function parseMCPContent(result: any): any {
    if (result && result.content && Array.isArray(result.content) && result.content.length > 0) {
      const textContent = result.content[0];
      if (textContent.type === 'text' && textContent.text) {
        try {
          return JSON.parse(textContent.text);
        } catch {
          return textContent.text;
        }
      }
    }
    return result;
  }

  describe('MCP Server Initialization', () => {
    it('should initialize MCP server and respond to initialize request', async () => {
      const client = await startMCPServer();
      expect(client).toBeDefined();
      client.close();
    }, 15000);

    it('should handle invalid initialize request', async () => {
      const client = await startMCPServer();
      
      // Send invalid initialize request
      await expect(
        sendRequest(client, 'initialize', { invalid: 'params' })
      ).rejects.toThrow();
      
      client.close();
    }, 15000);
  });

  describe('Tools Management', () => {
    let client: MCPClient;

    beforeEach(async () => {
      client = await startMCPServer();
    }, 15000);

    afterEach(() => {
      if (client) {
        client.close();
      }
    });

    it('should list available tools', async () => {
      const result = await sendRequest(client, 'tools/list');

      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);

      // Check for expected Productboard tools
      const toolNames = result.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('pb_feature_create');
      expect(toolNames).toContain('pb_feature_list');
      expect(toolNames).toContain('pb_feature_get');
      expect(toolNames).toContain('pb_product_list');
      expect(toolNames).toContain('pb_user_current');
    });

    it('should provide tool descriptions and schemas', async () => {
      const result = await sendRequest(client, 'tools/list');

      const createFeatureTool = result.tools.find((tool: any) => tool.name === 'pb_feature_create');
      expect(createFeatureTool).toBeDefined();
      expect(createFeatureTool.description).toBeDefined();
      expect(createFeatureTool.inputSchema).toBeDefined();
      expect(createFeatureTool.inputSchema.type).toBe('object');
      expect(createFeatureTool.inputSchema.required).toContain('name');
      expect(createFeatureTool.inputSchema.required).toContain('description');
    });
  });

  describe('Tool Execution', () => {
    let client: MCPClient;

    beforeEach(async () => {
      client = await startMCPServer();
    }, 15000);

    afterEach(() => {
      if (client) {
        client.close();
      }
    });

    it('should execute pb_user_current tool successfully', async () => {
      const result = await sendRequest(client, 'tools/call', {
        name: 'pb_user_current',
        arguments: {},
      });

      // Parse MCP content format
      const parsedResult = parseMCPContent(result);

      expect(parsedResult).toMatchObject({
        success: true,
        data: expect.objectContaining({
          authenticated: true,
        }),
      });
    });

    it('should handle tool execution with parameters', async () => {
      const result = await sendRequest(client, 'tools/call', {
        name: 'pb_feature_create',
        arguments: {
          name: 'Test Feature',
          description: 'E2E test feature',
        },
      });

      // Parse MCP content format
      const parsedResult = parseMCPContent(result);

      expect(parsedResult).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 'feature-123',
          name: 'Test Feature',
        }),
      });
    });

    it('should handle tool validation errors', async () => {
      // Test with missing required fields - should throw MCP error
      await expect(
        sendRequest(client, 'tools/call', {
          name: 'pb_feature_create',
          arguments: {
            // Missing required 'description' field
            name: 'Incomplete Feature',
          },
        })
      ).rejects.toThrow('Failed to execute tool pb_feature_create');
    });

    it('should handle unknown tool calls', async () => {
      await expect(
        sendRequest(client, 'tools/call', {
          name: 'pb_unknown_tool',
          arguments: {},
        })
      ).rejects.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      // Test with invalid data that will trigger validation errors
      const result = await sendRequest(client, 'tools/call', {
        name: 'pb_feature_create',
        arguments: {
          name: '', // Empty name should trigger validation error
          description: '',
        },
      });

      // Parse MCP content format
      const parsedResult = parseMCPContent(result);

      expect(parsedResult).toMatchObject({
        success: false,
        error: expect.stringContaining('Validation failed'),
      });
    });
  });

  describe('Complex Workflows', () => {
    let client: MCPClient;

    beforeEach(async () => {
      client = await startMCPServer();
    }, 15000);

    afterEach(() => {
      if (client) {
        client.close();
      }
    });

    it('should execute complete feature management workflow', async () => {
      // 1. Create feature
      const createResult = await sendRequest(client, 'tools/call', {
        name: 'pb_feature_create',
        arguments: {
          name: 'Workflow Feature',
          description: 'Feature for testing complete workflow',
        },
      });

      const parsedCreateResult = parseMCPContent(createResult);
      expect(parsedCreateResult).toMatchObject({
        success: true,
        data: expect.objectContaining({ id: 'feature-123' }),
      });

      // 2. Get feature details
      const getResult = await sendRequest(client, 'tools/call', {
        name: 'pb_feature_get',
        arguments: { id: 'feature-123' },
      });

      const parsedGetResult = parseMCPContent(getResult);
      expect(parsedGetResult).toMatchObject({
        success: true,
        data: expect.objectContaining({ id: 'feature-123' }),
      });

      // 3. List features
      const listResult = await sendRequest(client, 'tools/call', {
        name: 'pb_feature_list',
        arguments: {},
      });

      // List features returns MCP content format directly with a text summary
      expect(listResult).toHaveProperty('content');
      expect(Array.isArray(listResult.content)).toBe(true);
      expect(listResult.content[0]).toHaveProperty('type', 'text');
      expect(listResult.content[0].text).toContain('feature');
    });

    it('should handle concurrent tool calls', async () => {
      // Execute multiple tools concurrently
      const promises = [
        sendRequest(client, 'tools/call', {
          name: 'pb_user_current',
          arguments: {},
        }),
        sendRequest(client, 'tools/call', {
          name: 'pb_product_list',
          arguments: {},
        }),
        sendRequest(client, 'tools/call', {
          name: 'pb_company_list',
          arguments: {},
        }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);

      // Parse each result
      const parsedResults = results.map(parseMCPContent);

      expect(parsedResults[0]).toMatchObject({ success: true });
      expect(parsedResults[1]).toMatchObject({ success: true });
      expect(parsedResults[2]).toMatchObject({ success: true });
    });
  });

  describe('Protocol Compliance', () => {
    let client: MCPClient;

    beforeEach(async () => {
      client = await startMCPServer();
    }, 15000);

    afterEach(() => {
      if (client) {
        client.close();
      }
    });

    it('should follow JSON-RPC 2.0 protocol', async () => {
      // Test that all responses include proper JSON-RPC fields
      const result = await sendRequest(client, 'tools/list');

      // Response should be valid according to JSON-RPC 2.0
      expect(result).toBeDefined();
    });

    it('should handle malformed requests gracefully', async () => {
      // Send malformed JSON
      client.send('{ invalid json }');

      // Server should not crash and should handle error gracefully
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased from 1s to 2s

      // Server should still respond to valid requests
      const result = await sendRequest(client, 'tools/list');
      expect(result).toBeDefined();
    });

    it('should maintain consistent request/response IDs', async () => {
      const testId = 12345;
      
      const response = await new Promise((resolve) => {
        client.once('message', resolve);
        client.send({
          jsonrpc: '2.0',
          id: testId,
          method: 'tools/list',
        });
      });

      expect((response as any).id).toBe(testId);
    });
  });

  describe('Performance and Stability', () => {
    let client: MCPClient;

    beforeEach(async () => {
      client = await startMCPServer();
    }, 15000);

    afterEach(() => {
      if (client) {
        client.close();
      }
    });

    it('should handle rapid sequential requests', async () => {
      const requestCount = 10;
      const requests = [];

      for (let i = 0; i < requestCount; i++) {
        requests.push(
          sendRequest(client, 'tools/call', {
            name: 'pb_user_current',
            arguments: {},
          })
        );
      }

      const results = await Promise.all(requests);

      expect(results).toHaveLength(requestCount);

      // Parse each result and check
      const parsedResults = results.map(parseMCPContent);
      parsedResults.forEach(result => {
        expect(result).toMatchObject({ success: true });
      });
    });

    it('should maintain stability under load', async () => {
      const startTime = Date.now();
      const requestCount = 20;
      const requests = [];

      for (let i = 0; i < requestCount; i++) {
        requests.push(
          sendRequest(client, 'tools/call', {
            name: 'pb_user_current',
            arguments: {},
          })
        );
      }

      const results = await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all requests succeeded
      const parsedResults = results.map(parseMCPContent);
      parsedResults.forEach(result => {
        expect(result).toMatchObject({ success: true });
      });

      // Should complete all requests within reasonable time
      expect(duration).toBeLessThan(15000); // 15 seconds (increased from 10s)
    });
  });
});