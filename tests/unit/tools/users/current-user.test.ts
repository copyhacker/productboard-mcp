import { CurrentUserTool } from '@tools/users/current-user';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('CurrentUserTool', () => {
  let tool: CurrentUserTool;
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

    tool = new CurrentUserTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_user_current');
      expect(tool.description).toBe('Get current authenticated user information from API token');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        properties: {},
      });
    });
  });

  describe('execute', () => {
    const mockJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiY3VycmVudC11c2VyIiwicm9sZSI6ImNvbnRyaWJ1dG9yIiwic3BhY2VfaWQiOiJ3b3Jrc3BhY2UtMSIsInJlZ2lvbiI6InVzIiwiaXNzIjoicHJvZHVjdGJvYXJkIiwiaWF0IjoxNjQwOTk1MjAwfQ.test';

    beforeEach(() => {
      // Mock the authManager to return our test token
      (mockApiClient as any).authManager = {
        getAuthHeaders: jest.fn().mockReturnValue({
          Authorization: `Bearer ${mockJwtToken}`,
        }),
      };
    });

    it('should get current user information from JWT token successfully', async () => {
      const result = await tool.execute({});

      const parsedResult = JSON.parse((result as any).content[0].text);

      expect(parsedResult).toEqual({
        success: true,
        data: {
          id: 'current-user',
          role: 'contributor',
          spaceId: 'workspace-1',
          region: 'us',
          authenticated: true,
          tokenIssuer: 'productboard',
          tokenIssuedAt: '2022-01-01T00:00:00.000Z',
          note: 'User information extracted from API token. Productboard API does not provide a /me endpoint.',
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Getting current user information');
    });

    it('should return MCP formatted response', async () => {
      const result = await tool.execute({});

      expect(result).toHaveProperty('content');
      expect((result as any).content).toBeInstanceOf(Array);
      expect((result as any).content[0]).toMatchObject({
        type: 'text',
        text: expect.any(String),
      });
    });

    it('should handle missing authentication token', async () => {
      (mockApiClient as any).authManager = {
        getAuthHeaders: jest.fn().mockReturnValue({}),
      };

      const result = await tool.execute({});
      const parsedResult = JSON.parse((result as any).content[0].text);

      expect(parsedResult).toEqual({
        success: false,
        error: 'No authentication token available',
      });
    });

    it('should handle invalid token format', async () => {
      (mockApiClient as any).authManager = {
        getAuthHeaders: jest.fn().mockReturnValue({
          Authorization: 'Bearer invalid-token',
        }),
      };

      const result = await tool.execute({});
      const parsedResult = JSON.parse((result as any).content[0].text);

      expect(parsedResult).toEqual({
        success: false,
        error: 'Invalid token format',
      });
    });

    it('should handle malformed JWT token', async () => {
      (mockApiClient as any).authManager = {
        getAuthHeaders: jest.fn().mockReturnValue({
          Authorization: 'Bearer a.b.c',
        }),
      };

      const result = await tool.execute({});
      const parsedResult = JSON.parse((result as any).content[0].text);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe('Unable to extract user information from token');
    });

    it('should accept empty parameters object', async () => {
      const result = await tool.execute({});
      const parsedResult = JSON.parse((result as any).content[0].text);

      expect(parsedResult.success).toBe(true);
    });

    it('should ignore any passed parameters', async () => {
      // Even if we pass parameters, they should be ignored
      const result = await tool.execute({ someParam: 'value' } as any);
      const parsedResult = JSON.parse((result as any).content[0].text);

      expect(parsedResult.success).toBe(true);
    });
  });
});