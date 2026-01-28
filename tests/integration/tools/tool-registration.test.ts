import { ToolRegistry } from '@core/registry.js';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';
import { GetFeatureTool } from '@tools/features/get-feature';
import { ListProductsTool } from '@tools/products/list-products';
import { CreateProductTool } from '@tools/products/create-product';
import { ProductHierarchyTool } from '@tools/products/product-hierarchy';
import { CreateNoteTool } from '@tools/notes/create-note';
import { ListNotesTool } from '@tools/notes/list-notes';
import { AttachNoteTool } from '@tools/notes/attach-note';
import { ListUsersTool } from '@tools/users/list-users';
import { CurrentUserTool } from '@tools/users/current-user';
import { ListCompaniesTool } from '@tools/companies/list-companies';
import { GlobalSearchTool } from '@tools/search/global-search';
import { BulkUpdateFeaturesTool } from '@tools/bulk/bulk-update-features';

describe('Tool Registration Integration', () => {
  let registry: ToolRegistry;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockApiClient = {
      makeRequest: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    registry = new ToolRegistry(mockLogger);
  });

  describe('registering all tools', () => {
    it('should register all feature tools', () => {
      const tools = [
        new GetFeatureTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      expect(registry.hasTool('pb_feature_get')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should register all product tools', () => {
      const tools = [
        new ListProductsTool(mockApiClient, mockLogger),
        new CreateProductTool(mockApiClient, mockLogger),
        new ProductHierarchyTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      expect(registry.hasTool('pb_product_list')).toBe(true);
      expect(registry.hasTool('pb_product_create')).toBe(true);
      expect(registry.hasTool('pb_product_hierarchy')).toBe(true);
      expect(registry.size()).toBe(3);
    });

    it('should register all note tools', () => {
      const tools = [
        new CreateNoteTool(mockApiClient, mockLogger),
        new ListNotesTool(mockApiClient, mockLogger),
        new AttachNoteTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      expect(registry.hasTool('pb_note_create')).toBe(true);
      expect(registry.hasTool('pb_note_list')).toBe(true);
      expect(registry.hasTool('pb_note_attach')).toBe(true);
      expect(registry.size()).toBe(3);
    });

    it('should register all user/company tools', () => {
      const tools = [
        new ListUsersTool(mockApiClient, mockLogger),
        new CurrentUserTool(mockApiClient, mockLogger),
        new ListCompaniesTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      expect(registry.hasTool('pb_user_list')).toBe(true);
      expect(registry.hasTool('pb_user_current')).toBe(true);
      expect(registry.hasTool('pb_company_list')).toBe(true);
      expect(registry.size()).toBe(3);
    });

    it('should register utility tools', () => {
      const tools = [
        new GlobalSearchTool(mockApiClient, mockLogger),
        new BulkUpdateFeaturesTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      expect(registry.hasTool('pb_search')).toBe(true);
      expect(registry.hasTool('pb_feature_bulk_update')).toBe(true);
      expect(registry.size()).toBe(2);
    });
  });

  describe('listing registered tools', () => {
    it('should list all tools with correct descriptors', () => {
      const tools = [
        new GetFeatureTool(mockApiClient, mockLogger),
        new ListProductsTool(mockApiClient, mockLogger),
        new CreateNoteTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      const descriptors = registry.listTools();

      expect(descriptors).toHaveLength(3);
      expect(descriptors).toContainEqual(
        expect.objectContaining({
          name: 'pb_feature_get',
          description: 'Get detailed information about a specific feature',
        })
      );
      expect(descriptors).toContainEqual(
        expect.objectContaining({
          name: 'pb_product_list',
          description: 'List all products in the workspace',
        })
      );
      expect(descriptors).toContainEqual(
        expect.objectContaining({
          name: 'pb_note_create',
          description: 'Create a customer feedback note',
        })
      );
    });
  });

  describe('tool execution through registry', () => {
    it('should execute tool successfully', async () => {
      // Create a JWT token for testing
      const mockUserId = 'user-1';
      const mockRole = 'admin';
      const mockSpaceId = 'space-123';

      // Create a simple JWT-like token (header.payload.signature)
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({
        user_id: mockUserId,
        role: mockRole,
        space_id: mockSpaceId,
        region: 'us',
        iss: 'test-issuer',
        iat: Math.floor(Date.now() / 1000),
      })).toString('base64');
      const signature = 'mock-signature';
      const mockToken = `${header}.${payload}.${signature}`;

      // Mock the API client with authManager
      const mockApiClientWithAuth = {
        ...mockApiClient,
        authManager: {
          getAuthHeaders: jest.fn().mockReturnValue({
            'Authorization': `Bearer ${mockToken}`,
          }),
        },
      } as any;

      const tool = new CurrentUserTool(mockApiClientWithAuth, mockLogger);
      registry.registerTool(tool);

      const registeredTool = registry.getTool('pb_user_current');
      expect(registeredTool).toBeTruthy();

      const result = await registeredTool!.execute({});

      // Expect MCP content format
      expect(result).toHaveProperty('content');
      expect(Array.isArray((result as any).content)).toBe(true);
      expect((result as any).content[0]).toHaveProperty('type', 'text');
      expect((result as any).content[0]).toHaveProperty('text');

      // Verify the response contains the expected data
      const responseText = (result as any).content[0].text;
      const responseData = JSON.parse(responseText);
      expect(responseData).toHaveProperty('success', true);
      expect(responseData.data).toMatchObject({
        id: mockUserId,
        role: mockRole,
        spaceId: mockSpaceId,
        authenticated: true,
      });
    });
  });

  describe('tool naming convention validation', () => {
    it('should follow pb_<resource>_<action> pattern', () => {
      const tools = [
        new GetFeatureTool(mockApiClient, mockLogger),
        new ListProductsTool(mockApiClient, mockLogger),
        new CreateProductTool(mockApiClient, mockLogger),
        new ProductHierarchyTool(mockApiClient, mockLogger),
        new CreateNoteTool(mockApiClient, mockLogger),
        new ListNotesTool(mockApiClient, mockLogger),
        new AttachNoteTool(mockApiClient, mockLogger),
        new ListUsersTool(mockApiClient, mockLogger),
        new CurrentUserTool(mockApiClient, mockLogger),
        new ListCompaniesTool(mockApiClient, mockLogger),
        new GlobalSearchTool(mockApiClient, mockLogger),
        new BulkUpdateFeaturesTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        expect(tool.name).toMatch(/^pb_[a-z]+(_[a-z]+)*$/);
      });
    });
  });
});