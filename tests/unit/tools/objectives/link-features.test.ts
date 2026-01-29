import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LinkFeaturesToObjectiveTool } from '@tools/objectives/link-features';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('LinkFeaturesToObjectiveTool', () => {
  let tool: LinkFeaturesToObjectiveTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockClient = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      makeRequest: jest.fn(),
    } as unknown as jest.Mocked<ProductboardAPIClient>;
    
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;
    
    tool = new LinkFeaturesToObjectiveTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_objective_link_feature');
      expect(tool.description).toBe('Link a feature to an objective');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['featureId', 'objectiveId'],
        properties: {
          featureId: {
            type: 'string',
            description: 'Feature ID (UUID)',
          },
          objectiveId: {
            type: 'string',
            description: 'Objective ID (UUID)',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ objectiveId: 'obj_123' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ featureId: 'feat_123' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate featureId is a string', async () => {
      const input = {
        objectiveId: 'obj_123',
        featureId: 123,
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        objectiveId: 'obj_123',
        featureId: 'feat_456',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should link feature to objective with valid input', async () => {
      const validInput = {
        objectiveId: 'obj_123',
        featureId: 'feat_456',
      };
      const expectedResponse = {
        id: 'link_789',
        featureId: 'feat_456',
        objectiveId: 'obj_123',
        created_at: '2024-01-20T14:30:00Z',
      };

      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/features/feat_456/links/objectives/obj_123', {});
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });
      const response = JSON.parse((result as any).content[0].text);
      expect(response).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        objectiveId: 'obj_123',
        featureId: 'feat_456',
      };

      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });
      const response = JSON.parse((result as any).content[0].text);
      expect(response).toEqual({
        success: false,
        error: 'Failed to link feature to objective: API Error',
      });
    });

    it('should handle objective not found errors', async () => {
      const validInput = {
        objectiveId: 'obj_nonexistent',
        featureId: 'feat_456',
      };

      const error = new Error('Objective not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'OBJECTIVE_NOT_FOUND',
          message: 'Objective not found',
          details: {},
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });
      const response = JSON.parse((result as any).content[0].text);
      expect(response).toEqual({
        success: false,
        error: 'Failed to link feature to objective: Objective not found',
      });
    });

    it('should handle feature not found errors', async () => {
      const validInput = {
        objectiveId: 'obj_123',
        featureId: 'feat_nonexistent',
      };

      const error = new Error('Feature not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'FEATURE_NOT_FOUND',
          message: 'Feature not found',
          details: {},
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });
      const response = JSON.parse((result as any).content[0].text);
      expect(response).toEqual({
        success: false,
        error: 'Failed to link feature to objective: Feature not found',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        objectiveId: 'obj_123',
        featureId: 'feat_456',
      };

      const error = new Error('Authentication failed');
      (error as any).response = {
        status: 401,
        data: {
          error: true,
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
          details: {},
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });
      const response = JSON.parse((result as any).content[0].text);
      expect(response).toEqual({
        success: false,
        error: 'Failed to link feature to objective: Authentication failed',
      });
    });

    it('should handle forbidden errors', async () => {
      const validInput = {
        objectiveId: 'obj_123',
        featureId: 'feat_456',
      };

      const error = new Error('Insufficient permissions');
      (error as any).response = {
        status: 403,
        data: {
          error: true,
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: {},
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });
      const response = JSON.parse((result as any).content[0].text);
      expect(response).toEqual({
        success: false,
        error: 'Failed to link feature to objective: Insufficient permissions',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        objectiveId: 'obj_123',
        featureId: 'feat_invalid',
      };

      const error = new Error('Validation error');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          details: {
            fields: {
              featureId: 'Feature ID is invalid',
            },
          },
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });
      const response = JSON.parse((result as any).content[0].text);
      expect(response).toEqual({
        success: false,
        error: 'Failed to link feature to objective: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new LinkFeaturesToObjectiveTool(null as any, mockLogger);
      const validInput = {
        objectiveId: 'obj_123',
        featureId: 'feat_456',
      };
      const result = await uninitializedTool.execute(validInput);

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });
      const response = JSON.parse((result as any).content[0].text);
      expect(response).toEqual({
        success: false,
        error: expect.stringContaining('Failed to link feature to objective:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        id: 'link_789',
        featureId: 'feat_456',
        objectiveId: 'obj_123',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        objectiveId: 'obj_123',
        featureId: 'feat_456',
      });

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });
      const response = JSON.parse((result as any).content[0].text);
      expect(response).toEqual({
        success: true,
        data: apiResponse,
      });
      expect(response.data).toHaveProperty('objectiveId', 'obj_123');
      expect(response.data).toHaveProperty('featureId', 'feat_456');
      expect(response.data).toHaveProperty('created_at');
    });

    it('should handle successful link creation', async () => {
      const apiResponse = {
        id: 'link_abc',
        featureId: 'feat_789',
        objectiveId: 'obj_456',
        created_at: '2024-01-15T10:00:00Z',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        objectiveId: 'obj_456',
        featureId: 'feat_789',
      });

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });
      const response = JSON.parse((result as any).content[0].text);
      expect(response).toEqual({
        success: true,
        data: apiResponse,
      });
      expect(response.data).toHaveProperty('id', 'link_abc');
    });
  });
});