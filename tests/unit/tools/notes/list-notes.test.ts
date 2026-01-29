import { ListNotesTool } from '@tools/notes/list-notes';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('ListNotesTool', () => {
  let tool: ListNotesTool;
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

    tool = new ListNotesTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_note_list');
      expect(tool.description).toBe('List customer feedback notes');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        properties: {
          featureId: {
            type: 'string',
          },
          companyId: {
            type: 'string',
          },
          ownerEmail: {
            type: 'string',
          },
          anyTag: {
            type: 'array',
            items: { type: 'string' },
          },
          allTags: {
            type: 'array',
            items: { type: 'string' },
          },
          term: {
            type: 'string',
          },
          createdFrom: {
            type: 'string',
            format: 'date',
          },
          createdTo: {
            type: 'string',
            format: 'date',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 2000,
            default: 100,
          },
          pageCursor: {
            type: 'string',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const mockNotes = [
      {
        id: 'note-1',
        content: 'First feedback',
        customer_email: 'customer1@example.com',
        created_at: '2025-01-15T00:00:00Z',
      },
      {
        id: 'note-2',
        content: 'Second feedback',
        customer_email: 'customer2@example.com',
        created_at: '2025-01-14T00:00:00Z',
      },
    ];

    it('should list notes with default parameters', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: { next: null },
      });

      const result = await tool.execute({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { pageLimit: 100 },
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Found 2 notes:'),
          },
        ],
      });

      expect((result as any).content[0].text).toContain('First feedback');
      expect((result as any).content[0].text).toContain('Second feedback');

      expect(mockLogger.info).toHaveBeenCalledWith('Listing notes');
    });

    it('should filter by feature_id', async () => {
      const featureNotes = [mockNotes[0]];

      mockApiClient.makeRequest.mockResolvedValue({
        data: featureNotes,
        links: {},
      });

      const result = await tool.execute({ featureId: 'feat-123' });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { featureId: 'feat-123', pageLimit: 100 },
      });

      expect((result as any).content[0].text).toContain('Found 1 note');
      expect((result as any).content[0].text).toContain('First feedback');
    });

    it('should filter by customer_email', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: [mockNotes[0]],
        links: {},
      });

      await tool.execute({ ownerEmail: 'customer1@example.com' });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { ownerEmail: 'customer1@example.com', pageLimit: 100 },
      });
    });

    it('should filter by company_name', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: {},
      });

      await tool.execute({ companyId: 'company-123' });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { companyId: 'company-123', pageLimit: 100 },
      });
    });

    it('should filter by tags', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: {},
      });

      await tool.execute({ anyTag: ['important', 'feature-request'] });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { anyTag: 'important,feature-request', pageLimit: 100 },
      });
    });

    it('should filter by date range', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: {},
      });

      await tool.execute({
        createdFrom: '2025-01-01',
        createdTo: '2025-01-31',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: {
          createdFrom: '2025-01-01',
          createdTo: '2025-01-31',
          pageLimit: 100,
        },
      });
    });

    it('should respect custom limit', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: {},
      });

      await tool.execute({ limit: 50 });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { pageLimit: 50 },
      });
    });

    it('should handle pagination', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: { next: '/notes?offset=20' },
      });

      const result = await tool.execute({});

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Found 2 notes:'),
          },
        ],
      });

      expect((result as any).content[0].text).toContain('First feedback');
      expect((result as any).content[0].text).toContain('Second feedback');
    });

    it('should validate limit range', async () => {
      await expect(tool.execute({ limit: 0 })).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ limit: 2001 })).rejects.toThrow('Invalid parameters');
    });

    it('should validate date format', async () => {
      await expect(
        tool.execute({ createdFrom: 'invalid-date' })
      ).rejects.toThrow('Invalid parameters');
    });

    it('should handle empty results', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: [],
        links: {},
      });

      const result = await tool.execute({});

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'No notes found.',
          },
        ],
      });
    });

    it('should handle API errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('API Error'));

      await expect(tool.execute({})).rejects.toThrow('Tool pb_note_list execution failed');
    });
  });
});