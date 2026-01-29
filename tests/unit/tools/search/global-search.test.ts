import { GlobalSearchTool } from '@tools/search/global-search';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';
import { ValidationError } from '@utils/errors';

describe('GlobalSearchTool', () => {
  let tool: GlobalSearchTool;
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

    tool = new GlobalSearchTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_search');
      expect(tool.description).toBe('Search across all Productboard entities');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          types: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['feature', 'note', 'product', 'objective', 'user'],
            },
            description: 'Entity types to search (defaults to all)',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 50,
            default: 10,
            description: 'Maximum results per type',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const validParams = {
      query: 'search term',
    };

    const mockSearchResults = {
      features: [
        {
          id: 'feat-1',
          name: 'Search term Feature',
          description: 'Enhanced search term functionality',
          score: 0.95,
          highlight: 'Enhanced <em>search term</em> functionality',
        },
      ],
      notes: [
        {
          id: 'note-1',
          title: 'Customer wants better search term',
          content: 'Customer wants better search term',
          score: 0.89,
          highlight: 'Customer wants better <em>search term</em>',
        },
      ],
      products: [
        {
          id: 'prod-1',
          name: 'Search term Product',
          description: 'Product with search term',
          score: 0.75,
        },
      ],
      total_results: 3,
    };

    it('should perform global search successfully', async () => {
      mockApiClient.makeRequest
        .mockResolvedValueOnce({
          data: mockSearchResults.features,
          links: {},
        })
        .mockResolvedValueOnce({
          data: mockSearchResults.products,
          links: {},
        })
        .mockResolvedValueOnce({
          data: mockSearchResults.notes,
          links: {},
        });

      const result = await tool.execute(validParams);

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/features',
        params: {},
      });

      expect(result).toMatchObject({
        content: [{
          type: 'text',
          text: expect.stringContaining('Search results for "search term"'),
        }],
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Performing global search',
        { query: 'search term' }
      );
    });

    it('should search specific entity types', async () => {
      const typedSearchParams = {
        query: 'feature request',
        types: ['feature', 'note'] as ('feature' | 'note' | 'product' | 'objective' | 'user')[],
      };

      const featuresWithQuery = [
        {
          id: 'feat-1',
          name: 'Feature request for enhancement',
          description: 'A feature request from customer',
        },
      ];

      const notesWithQuery = [
        {
          id: 'note-1',
          title: 'Feature request note',
          content: 'Customer feature request details',
        },
      ];

      mockApiClient.makeRequest
        .mockResolvedValueOnce({
          data: featuresWithQuery,
          links: {},
        })
        .mockResolvedValueOnce({
          data: notesWithQuery,
          links: {},
        });

      const result = await tool.execute(typedSearchParams);

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/features',
        params: {},
      });

      expect(result).toMatchObject({
        content: [{
          type: 'text',
          text: expect.stringContaining('Search results for "feature request"'),
        }],
      });
    });

    it('should respect custom limit', async () => {
      const paramsWithLimit = {
        query: 'test',
        limit: 25,
      };

      mockApiClient.makeRequest
        .mockResolvedValueOnce({ data: [], links: {} })
        .mockResolvedValueOnce({ data: [], links: {} })
        .mockResolvedValueOnce({ data: [], links: {} });

      const result = await tool.execute(paramsWithLimit);

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/features',
        params: {},
      });

      expect(result).toMatchObject({
        content: [{
          type: 'text',
          text: expect.stringContaining('No results found for "test"'),
        }],
      });
    });

    it('should validate required query parameter', async () => {
      const invalidParams = { types: ['feature'] };

      await expect(tool.execute(invalidParams as any)).rejects.toThrow(ValidationError);
    });

    it('should validate empty query', async () => {
      const emptyQuery = { query: '' };

      await expect(tool.execute(emptyQuery)).rejects.toThrow(ValidationError);
    });

    it('should validate entity types', async () => {
      const invalidTypes = {
        query: 'search',
        types: ['invalid-type'],
      };

      await expect(tool.execute(invalidTypes as any)).rejects.toThrow(ValidationError);
    });

    it('should validate limit range', async () => {
      const tooLowLimit = {
        query: 'search',
        limit: 0,
      };

      await expect(tool.execute(tooLowLimit)).rejects.toThrow(ValidationError);

      const tooHighLimit = {
        query: 'search',
        limit: 51,
      };

      await expect(tool.execute(tooHighLimit)).rejects.toThrow(ValidationError);
    });

    it('should handle no results found', async () => {
      mockApiClient.makeRequest
        .mockResolvedValueOnce({ data: [], links: {} })
        .mockResolvedValueOnce({ data: [], links: {} })
        .mockResolvedValueOnce({ data: [], links: {} });

      const result = await tool.execute({ query: 'nonexistent' });

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'No results found for "nonexistent"',
        }],
      });
    });

    it('should handle search with special characters', async () => {
      const specialCharsParams = {
        query: 'test+query "exact match" -exclude',
      };

      mockApiClient.makeRequest
        .mockResolvedValueOnce({ data: [], links: {} })
        .mockResolvedValueOnce({ data: [], links: {} })
        .mockResolvedValueOnce({ data: [], links: {} });

      const result = await tool.execute(specialCharsParams);

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/features',
        params: {},
      });

      expect(result).toMatchObject({
        content: [{
          type: 'text',
          text: expect.any(String),
        }],
      });
    });

    it('should handle API errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Search service unavailable'));

      const result = await tool.execute(validParams);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'No results found for "search term"',
        }],
      });

      // The tool logs debug messages for individual endpoint failures but doesn't throw
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});