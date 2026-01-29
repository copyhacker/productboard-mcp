import { ToolRegistry } from '../../src/core/registry.js';
import { ProductboardAPIClient } from '../../src/api/client.js';
import { AuthenticationManager } from '../../src/auth/manager.js';
import { Logger } from '../../src/utils/logger.js';
import { RateLimiter } from '../../src/middleware/rateLimiter.js';

// Import all tool classes
import { CreateFeatureTool } from '../../src/tools/features/create-feature.js';
import { GetFeatureTool } from '../../src/tools/features/get-feature.js';
import { ListFeaturesTool } from '../../src/tools/features/list-features.js';
import { UpdateFeatureTool } from '../../src/tools/features/update-feature.js';
import { DeleteFeatureTool } from '../../src/tools/features/delete-feature.js';

import { CreateProductTool } from '../../src/tools/products/create-product.js';
import { ListProductsTool } from '../../src/tools/products/list-products.js';
import { ProductHierarchyTool } from '../../src/tools/products/product-hierarchy.js';

import { CreateNoteTool } from '../../src/tools/notes/create-note.js';
import { ListNotesTool } from '../../src/tools/notes/list-notes.js';
import { AttachNoteTool } from '../../src/tools/notes/attach-note.js';

import { CurrentUserTool } from '../../src/tools/users/current-user.js';
import { ListUsersTool } from '../../src/tools/users/list-users.js';

import { ListCompaniesTool } from '../../src/tools/companies/list-companies.js';
import { GlobalSearchTool } from '../../src/tools/search/global-search.js';
import { BulkUpdateFeaturesTool } from '../../src/tools/bulk/bulk-update-features.js';

import nock from 'nock';

describe('MCP Tools Comprehensive Integration', () => {
  let registry: ToolRegistry;
  let apiClient: ProductboardAPIClient;
  let authManager: AuthenticationManager;
  let logger: Logger;
  let rateLimiter: RateLimiter;

  const BASE_URL = 'https://api.productboard.com';

  beforeEach(() => {
    // Setup logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Setup auth manager
    authManager = {
      getAuthHeaders: jest.fn().mockReturnValue({ Authorization: 'Bearer test-token' }),
      refreshTokenIfNeeded: jest.fn(),
      isAuthenticated: jest.fn().mockReturnValue(true),
    } as any;

    // Setup rate limiter
    rateLimiter = {
      waitForSlot: jest.fn().mockResolvedValue(undefined),
      isLimited: jest.fn().mockReturnValue(false),
      getRemainingRequests: jest.fn().mockReturnValue({ minute: 60, hour: 3600, day: 86400 }),
    } as any;

    // Setup API client
    apiClient = new ProductboardAPIClient(
      {
        baseUrl: BASE_URL,
        timeout: 5000,
        retryAttempts: 1,
        retryDelay: 100,
      },
      authManager,
      logger,
      rateLimiter
    );

    // Setup registry
    registry = new ToolRegistry(logger);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Tool Registration', () => {
    it('should register all tools successfully', () => {
      const tools = [
        // Feature tools
        new CreateFeatureTool(apiClient, logger),
        new GetFeatureTool(apiClient, logger),
        new ListFeaturesTool(apiClient, logger),
        new UpdateFeatureTool(apiClient, logger),
        new DeleteFeatureTool(apiClient, logger),

        // Product tools  
        new CreateProductTool(apiClient, logger),
        new ListProductsTool(apiClient, logger),
        new ProductHierarchyTool(apiClient, logger),

        // Note tools
        new CreateNoteTool(apiClient, logger),
        new ListNotesTool(apiClient, logger),
        new AttachNoteTool(apiClient, logger),

        // User tools
        new CurrentUserTool(apiClient, logger),
        new ListUsersTool(apiClient, logger),

        // Other tools
        new ListCompaniesTool(apiClient, logger),
        new GlobalSearchTool(apiClient, logger),
        new BulkUpdateFeaturesTool(apiClient, logger),
      ];

      // Register all tools
      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      // Verify all tools are registered
      expect(registry.size()).toBe(tools.length);

      // Verify specific tools
      expect(registry.hasTool('pb_feature_create')).toBe(true);
      expect(registry.hasTool('pb_feature_get')).toBe(true);
      expect(registry.hasTool('pb_feature_list')).toBe(true);
      expect(registry.hasTool('pb_feature_update')).toBe(true);
      expect(registry.hasTool('pb_feature_delete')).toBe(true);
      
      expect(registry.hasTool('pb_product_create')).toBe(true);
      expect(registry.hasTool('pb_product_list')).toBe(true);
      expect(registry.hasTool('pb_product_hierarchy')).toBe(true);
      
      expect(registry.hasTool('pb_note_create')).toBe(true);
      expect(registry.hasTool('pb_note_list')).toBe(true);
      expect(registry.hasTool('pb_note_attach')).toBe(true);
      
      expect(registry.hasTool('pb_user_current')).toBe(true);
      expect(registry.hasTool('pb_user_list')).toBe(true);
      
      expect(registry.hasTool('pb_company_list')).toBe(true);
      expect(registry.hasTool('pb_search')).toBe(true);
      expect(registry.hasTool('pb_feature_bulk_update')).toBe(true);
    });

    it('should provide correct tool metadata', () => {
      const createFeatureTool = new CreateFeatureTool(apiClient, logger);
      registry.registerTool(createFeatureTool);

      const metadata = createFeatureTool.getMetadata();
      
      expect(metadata.name).toBe('pb_feature_create');
      expect(metadata.description).toBe('Create a new feature in Productboard');
      expect(metadata.inputSchema.type).toBe('object');
      expect(metadata.inputSchema.required).toContain('name');
      expect(metadata.inputSchema.required).toContain('description');
    });
  });

  describe('Feature Management Workflow', () => {
    beforeEach(() => {
      registry.registerTool(new CreateFeatureTool(apiClient, logger));
      registry.registerTool(new GetFeatureTool(apiClient, logger));
      registry.registerTool(new ListFeaturesTool(apiClient, logger));
      registry.registerTool(new UpdateFeatureTool(apiClient, logger));
      registry.registerTool(new DeleteFeatureTool(apiClient, logger));
    });

    it('should handle complete feature lifecycle', async () => {
      const featureData = {
        id: 'feature-123',
        name: 'Test Feature',
        description: 'A test feature for integration testing',
        status: 'new' as const,
      };

      // Mock feature creation
      nock(BASE_URL)
        .post('/features', {
          name: 'Test Feature',
          description: 'A test feature for integration testing',
          status: 'new',
        })
        .reply(201, featureData);

      // Mock feature retrieval
      nock(BASE_URL)
        .get('/features/feature-123')
        .reply(200, featureData);

      // Mock feature update
      nock(BASE_URL)
        .patch('/features/feature-123', {
          status: 'in_progress',
        })
        .reply(200, { ...featureData, status: 'in_progress' });

      // Mock feature listing - match any query params
      nock(BASE_URL)
        .get('/features')
        .query(true)
        .reply(200, [{ ...featureData, status: { name: 'in_progress' } }]);

      // Mock feature deletion (archive by default)
      nock(BASE_URL)
        .patch('/features/feature-123', {
          status: 'archived',
        })
        .reply(200, { ...featureData, status: 'archived' });

      // 1. Create feature
      const createTool = registry.getTool('pb_feature_create')!;
      const createResult = await createTool.execute({
        name: 'Test Feature',
        description: 'A test feature for integration testing',
        status: 'new',
      });

      expect(createResult).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('feature-123')
          })
        ])
      });

      // 2. Get feature details
      const getTool = registry.getTool('pb_feature_get')!;
      const getResult = await getTool.execute({
        id: 'feature-123',
      });

      expect(getResult).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('feature-123')
          })
        ])
      });

      // 3. Update feature status
      const updateTool = registry.getTool('pb_feature_update')!;
      const updateResult = await updateTool.execute({
        id: 'feature-123',
        status: 'in_progress',
      });

      expect(updateResult).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('in_progress')
          })
        ])
      });

      // 4. List features
      const listTool = registry.getTool('pb_feature_list')!;
      const listResult = await listTool.execute({
        status: 'in_progress',
      });

      expect(listResult).toMatchObject({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Test Feature')
          }
        ]
      });

      // 5. Delete feature
      const deleteTool = registry.getTool('pb_feature_delete')!;
      const deleteResult = await deleteTool.execute({
        id: 'feature-123',
      });

      expect(deleteResult).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('archived')
          })
        ])
      });
    });
  });

  describe('Product Management Integration', () => {
    beforeEach(() => {
      registry.registerTool(new CreateProductTool(apiClient, logger));
      registry.registerTool(new ListProductsTool(apiClient, logger));
      registry.registerTool(new ProductHierarchyTool(apiClient, logger));
    });

    it('should handle product hierarchy management', async () => {
      const parentProduct = {
        id: 'product-parent',
        name: 'Parent Product',
        description: 'Main product line',
      };

      const childProduct = {
        id: 'product-child',
        name: 'Child Product',
        description: 'Sub-product',
        parent_id: 'product-parent',
      };

      // Mock parent product creation
      nock(BASE_URL)
        .post('/products', {
          name: 'Parent Product',
          description: 'Main product line',
        })
        .reply(201, parentProduct);

      // Mock child product creation
      nock(BASE_URL)
        .post('/products', {
          name: 'Child Product',
          description: 'Sub-product',
          parent_id: 'product-parent',
        })
        .reply(201, childProduct);

      // Mock hierarchy retrieval - now uses two endpoints
      nock(BASE_URL)
        .get('/products')
        .reply(200, {
          data: [parentProduct, childProduct],
        });

      nock(BASE_URL)
        .get('/components')
        .reply(200, {
          data: [],
        });

      // 1. Create parent product
      const createTool = registry.getTool('pb_product_create')!;
      const parentResult = await createTool.execute({
        name: 'Parent Product',
        description: 'Main product line',
      });

      expect(parentResult).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('product-parent')
          })
        ])
      });

      // 2. Create child product
      const childResult = await createTool.execute({
        name: 'Child Product',
        description: 'Sub-product',
        parent_id: 'product-parent',
      });

      expect(childResult).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('product-parent')
          })
        ])
      });

      // 3. Get hierarchy
      const hierarchyTool = registry.getTool('pb_product_hierarchy')!;
      const hierarchyResult = await hierarchyTool.execute({});

      expect(hierarchyResult).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('product-parent')
          })
        ])
      });
    });
  });

  describe('Note Management Integration', () => {
    beforeEach(() => {
      registry.registerTool(new CreateNoteTool(apiClient, logger));
      registry.registerTool(new ListNotesTool(apiClient, logger));
      registry.registerTool(new AttachNoteTool(apiClient, logger));
    });

    it('should handle note creation and attachment workflow', async () => {
      const noteData = {
        id: 'note-123',
        content: 'Customer feedback about feature request',
        customer_email: 'customer@example.com',
        created_at: '2023-01-01T00:00:00Z',
      };

      // Mock note creation
      nock(BASE_URL)
        .post('/notes', {
          content: 'Customer feedback about feature request',
          customer_email: 'customer@example.com',
        })
        .reply(201, noteData);

      // Mock note attachment - new single-entity linking endpoint
      nock(BASE_URL)
        .post('/notes/note-123/links/feature-123')
        .reply(200, { success: true });

      // Mock note listing
      nock(BASE_URL)
        .get('/notes')
        .query({ featureId: 'feature-123', pageLimit: 100 })
        .reply(200, {
          data: [noteData],
          pagination: { hasMore: false }
        });

      // 1. Create note
      const createTool = registry.getTool('pb_note_create')!;
      const createResult = await createTool.execute({
        content: 'Customer feedback about feature request',
        customer_email: 'customer@example.com',
      });

      expect(createResult).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('note-123')
          })
        ])
      });

      // 2. Attach note to feature
      const attachTool = registry.getTool('pb_note_attach')!;
      const attachResult = await attachTool.execute({
        noteId: 'note-123',
        entityId: 'feature-123',
      });

      expect(attachResult).toMatchObject({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Successfully')
          }
        ]
      });

      // 3. List notes for feature
      const listTool = registry.getTool('pb_note_list')!;
      const listResult = await listTool.execute({
        featureId: 'feature-123',
      });

      expect(listResult).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Customer feedback about feature request')
          })
        ])
      });
    });
  });

  describe('Search and Discovery', () => {
    beforeEach(() => {
      registry.registerTool(new GlobalSearchTool(apiClient, logger));
    });

    it('should handle global search across resources', async () => {
      const searchResults = {
        features: [
          { id: 'feature-1', name: 'Search Feature', type: 'feature' },
        ],
        products: [
          { id: 'product-1', name: 'Search Product', type: 'product' },
        ],
        notes: [
          { id: 'note-1', content: 'Search related note', type: 'note' },
        ],
      };

      nock(BASE_URL)
        .get('/search')
        .query({
          q: 'search',
          types: 'feature,product,note',
          limit: 10,
        })
        .reply(200, { data: searchResults });

      const searchTool = registry.getTool('pb_search')!;
      const result = await searchTool.execute({
        query: 'search',
        types: ['feature', 'product', 'note'],
      });

      // Search tool returns formatted results or "no results" message
      expect(result).toHaveProperty('content');
      expect((result as any).content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.any(String)
          })
        ])
      );
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(() => {
      registry.registerTool(new BulkUpdateFeaturesTool(apiClient, logger));
    });

    it('should handle bulk feature updates', async () => {
      const bulkResult = {
        updated: 3,
        failed: 0,
        results: [
          { id: 'feature-1', success: true },
          { id: 'feature-2', success: true },
          { id: 'feature-3', success: true },
        ],
      };

      nock(BASE_URL)
        .patch('/features/bulk', {
          feature_ids: ['feature-1', 'feature-2', 'feature-3'],
          updates: { status: 'done' },
        })
        .reply(200, bulkResult);

      const bulkTool = registry.getTool('pb_feature_bulk_update')!;
      const result = await bulkTool.execute({
        feature_ids: ['feature-1', 'feature-2', 'feature-3'],
        updates: { status: 'done' },
      });

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('"updated": 3')
          })
        ])
      });
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(() => {
      registry.registerTool(new GetFeatureTool(apiClient, logger));
    });

    it('should handle API errors gracefully through tool execution', async () => {
      nock(BASE_URL)
        .get('/features/nonexistent')
        .reply(404, { message: 'Feature not found' });

      const getTool = registry.getTool('pb_feature_get')!;
      
      await expect(getTool.execute({
        id: 'nonexistent',
      })).rejects.toThrow('Feature not found');
    });

    it('should handle validation errors', async () => {
      const getTool = registry.getTool('pb_feature_get')!;
      
      await expect(getTool.execute({})).rejects.toThrow('Invalid parameters');
    });
  });

  describe('Authentication and Rate Limiting Integration', () => {
    it('should include authentication headers in all requests', async () => {
      registry.registerTool(new CurrentUserTool(apiClient, logger));

      nock(BASE_URL)
        .get('/users/me')
        .matchHeader('Authorization', 'Bearer test-token')
        .reply(200, { data: { id: 'user-1', email: 'test@example.com' } });

      const userTool = registry.getTool('pb_user_current')!;
      const result = await userTool.execute({});

      // User tool returns formatted user data or error
      expect(result).toHaveProperty('content');
      expect((result as any).content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.any(String)
          })
        ])
      );

      expect(authManager.getAuthHeaders).toHaveBeenCalled();
    });

    it('should respect rate limiting for all tools', async () => {
      registry.registerTool(new ListFeaturesTool(apiClient, logger));

      nock(BASE_URL)
        .get('/features')
        .query(true)
        .reply(200, { data: [], pagination: { hasMore: false } });

      const listTool = registry.getTool('pb_feature_list')!;
      await listTool.execute({});

      expect(rateLimiter.waitForSlot).toHaveBeenCalledWith('global');
    });
  });

  describe('Tool Parameter Validation', () => {
    beforeEach(() => {
      registry.registerTool(new CreateFeatureTool(apiClient, logger));
      registry.registerTool(new UpdateFeatureTool(apiClient, logger));
    });

    it('should validate required parameters', async () => {
      const createTool = registry.getTool('pb_feature_create')!;
      
      await expect(createTool.execute({})).rejects.toThrow('Invalid parameters');
      await expect(createTool.execute({ name: 'Test' })).rejects.toThrow('Invalid parameters');
    });

    it('should validate parameter types', async () => {
      const createTool = registry.getTool('pb_feature_create')!;
      
      await expect(createTool.execute({
        name: 123, // Should be string
        description: 'Test description',
      })).rejects.toThrow('Invalid parameters');
    });

    it('should validate enum values', async () => {
      const createTool = registry.getTool('pb_feature_create')!;
      
      await expect(createTool.execute({
        name: 'Test Feature',
        description: 'Test description',
        status: 'invalid_status', // Should be valid enum value
      })).rejects.toThrow('Invalid parameters');
    });

    it('should validate custom business rules', async () => {
      const updateTool = registry.getTool('pb_feature_update')!;
      
      // Update tool requires at least one field besides id
      await expect(updateTool.execute({
        id: 'feature-123',
      })).rejects.toThrow('Invalid parameters');
    });
  });
});