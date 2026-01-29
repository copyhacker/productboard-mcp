import { ProductHierarchyTool } from '@tools/products/product-hierarchy';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('ProductHierarchyTool', () => {
  let tool: ProductHierarchyTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockApiClient = {
      makeRequest: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn(),
    } as any;

    tool = new ProductHierarchyTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_product_hierarchy');
      expect(tool.description).toBe('Get the product hierarchy with components');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'Specific product ID to get hierarchy for (optional, defaults to all products)',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const mockProducts = [
      {
        id: 'prod-1',
        name: 'Product A',
        description: 'Main product',
        owner: { email: 'owner@example.com' },
      },
      {
        id: 'prod-2',
        name: 'Product B',
        description: 'Another product',
      },
    ];

    const mockComponents = [
      {
        id: 'comp-1',
        name: 'Component 1',
        description: 'Component for Product A',
        parent: { product: { id: 'prod-1' } },
        owner: { email: 'comp-owner@example.com' },
      },
      {
        id: 'comp-2',
        name: 'Component 2',
        parent: { product: { id: 'prod-1' } },
      },
      {
        id: 'comp-3',
        name: 'Component 3',
        parent: { product: { id: 'prod-2' } },
      },
    ];

    it('should retrieve full hierarchy with all products', async () => {
      (mockApiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockProducts })
        .mockResolvedValueOnce({ data: mockComponents });

      const result = await tool.execute({});

      expect(mockApiClient.get).toHaveBeenCalledWith('/products');
      expect(mockApiClient.get).toHaveBeenCalledWith('/components');
      expect(mockApiClient.get).toHaveBeenCalledTimes(2);

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });

      const text = (result as any).content[0].text;
      expect(text).toContain('Product Hierarchy (2 products)');
      expect(text).toContain('Product A');
      expect(text).toContain('Product B');
      expect(text).toContain('Component 1');
      expect(text).toContain('Component 2');
      expect(text).toContain('Component 3');

      expect(mockLogger.info).toHaveBeenCalledWith('Building product hierarchy');
    });

    it('should retrieve hierarchy for specific product', async () => {
      (mockApiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockProducts })
        .mockResolvedValueOnce({ data: mockComponents });

      const result = await tool.execute({ productId: 'prod-1' });

      expect(mockApiClient.get).toHaveBeenCalledWith('/products');
      expect(mockApiClient.get).toHaveBeenCalledWith('/components');

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });

      const text = (result as any).content[0].text;
      expect(text).toContain('Product Hierarchy (1 products)');
      expect(text).toContain('Product A');
      expect(text).not.toContain('Product B');
      expect(text).toContain('Component 1');
      expect(text).toContain('Component 2');
      expect(text).not.toContain('Component 3');
    });

    it('should handle product not found', async () => {
      (mockApiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockProducts })
        .mockResolvedValueOnce({ data: mockComponents });

      const result = await tool.execute({ productId: 'non-existent' });

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: 'Product not found: non-existent'
          })
        ])
      });
    });

    it('should handle products without components', async () => {
      const productsWithoutComponents = [
        {
          id: 'prod-lonely',
          name: 'Lonely Product',
          description: 'No components',
        },
      ];

      (mockApiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: productsWithoutComponents })
        .mockResolvedValueOnce({ data: [] });

      const result = await tool.execute({});

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });

      const text = (result as any).content[0].text;
      expect(text).toContain('Lonely Product');
      expect(text).toContain('Components: None');
    });

    it('should handle empty product list', async () => {
      (mockApiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });

      const result = await tool.execute({});

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: 'No products found.'
          })
        ])
      });
    });

    it('should include owner information when available', async () => {
      (mockApiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockProducts })
        .mockResolvedValueOnce({ data: mockComponents });

      const result = await tool.execute({ productId: 'prod-1' });

      const text = (result as any).content[0].text;
      expect(text).toContain('owner@example.com');
      expect(text).toContain('comp-owner@example.com');
    });

    it('should format hierarchy text correctly', async () => {
      (mockApiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: [mockProducts[0]] })
        .mockResolvedValueOnce({ data: [mockComponents[0]] });

      const result = await tool.execute({ productId: 'prod-1' });

      const text = (result as any).content[0].text;
      // Check for proper formatting
      expect(text).toMatch(/1\. Product A/);
      expect(text).toMatch(/ID: prod-1/);
      expect(text).toMatch(/Owner: owner@example\.com/);
      expect(text).toMatch(/Description: Main product/);
      expect(text).toMatch(/Components \(1\):/);
      expect(text).toMatch(/1\. Component 1 \(comp-1\)/);
    });
  });
});
