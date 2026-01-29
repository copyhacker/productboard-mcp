import { AttachNoteTool } from '@tools/notes/attach-note';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('AttachNoteTool', () => {
  let tool: AttachNoteTool;
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

    tool = new AttachNoteTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_note_attach');
      expect(tool.description).toBe('Link a note to a feature, product, component, or subfeature');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        required: ['noteId', 'entityId'],
        properties: {
          noteId: {
            type: 'string',
            description: 'Note ID (UUID)',
          },
          entityId: {
            type: 'string',
            description: 'Entity ID (UUID) to link the note to (feature, product, component, or subfeature)',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const validParams = {
      noteId: 'note-123',
      entityId: 'feat-1',
    };

    const mockResponse = {
      noteId: 'note-123',
      attached_features: ['feat-1', 'feat-2'],
      total_attachments: 2,
    };

    it('should attach note to features successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockResponse,
        links: {},
      });

      const result = await tool.execute(validParams);

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        endpoint: '/notes/note-123/links/feat-1',
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Successfully linked note note-123 to entity feat-1'
          },
        ],
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Linking note to entity',
        { noteId: 'note-123', entityId: 'feat-1', entityType: 'unknown' }
      );
    });

    it('should attach note to single feature', async () => {
      const singleFeatureParams = {
        noteId: 'note-456',
        entityId: 'feat-single',
      };

      mockApiClient.makeRequest.mockResolvedValue({});

      const result = await tool.execute(singleFeatureParams);

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        endpoint: '/notes/note-456/links/feat-single',
      });

      expect((result as any).content[0].text).toContain('Successfully linked note note-456 to entity feat-single');
    });

    it('should validate required parameters', async () => {
      const missingNoteId = { entityId: 'feat-1' };
      await expect(tool.execute(missingNoteId as any)).rejects.toThrow('Invalid parameters');

      const missingEntityId = { noteId: 'note-123' };
      await expect(tool.execute(missingEntityId as any)).rejects.toThrow('Invalid parameters');
    });

    it('should handle note not found error', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Note not found'));

      await expect(tool.execute({
        noteId: 'non-existent-note',
        entityId: 'feat-1',
      })).rejects.toThrow('Tool pb_note_attach execution failed');
    });

    it('should handle feature not found error', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('One or more features not found')
      );

      await expect(tool.execute({
        noteId: 'note-123',
        entityId: 'non-existent-feature',
      })).rejects.toThrow('Tool pb_note_attach execution failed');
    });

    it('should handle API errors gracefully', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('API error')
      );

      await expect(tool.execute(validParams)).rejects.toThrow('Tool pb_note_attach execution failed');
    });
  });
});