import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface SearchNotesParams {
  query: string;
  filters?: {
    customer_emails?: string[];
    company_names?: string[];
    tags?: string[];
    source?: string[];
    created_after?: string;
    created_before?: string;
    feature_ids?: string[];
  };
  sort?: 'relevance' | 'created_at' | 'sentiment';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class SearchNotesTool extends BaseTool<SearchNotesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_search_notes',
      'Advanced search for customer notes',
      {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query text',
          },
          filters: {
            type: 'object',
            properties: {
              customer_emails: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by customer emails',
              },
              company_names: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by company names',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags',
              },
              source: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by source',
              },
              created_after: {
                type: 'string',
                format: 'date',
                description: 'Filter notes created after date',
              },
              created_before: {
                type: 'string',
                format: 'date',
                description: 'Filter notes created before date',
              },
              feature_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by attached feature IDs',
              },
            },
          },
          sort: {
            type: 'string',
            enum: ['relevance', 'created_at', 'sentiment'],
            default: 'relevance',
            description: 'Sort results by',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
            description: 'Sort order',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of results',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of results to skip',
          },
        },
      },
      {
        requiredPermissions: [Permission.SEARCH],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires search access',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: SearchNotesParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Searching notes', { query: params.query });

      const queryParams: Record<string, any> = {};

      // Map filters to /notes endpoint parameters (if supported)
      if (params.filters) {
        if (params.filters.created_after) queryParams.created_after = params.filters.created_after;
        if (params.filters.created_before) queryParams.created_before = params.filters.created_before;
        if (params.filters.feature_ids?.length) queryParams.feature_ids = params.filters.feature_ids.join(',');
      }

      // Map sort to what /notes endpoint supports (typically created_at)
      if (params.sort === 'created_at') {
        queryParams.sort = 'created_at';
        queryParams.order = params.order || 'desc';
      }

      // Productboard API doesn't have a /search/notes endpoint
      // Use the /notes endpoint and filter client-side
      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/notes',
        params: queryParams,
      });

      // Filter results client-side based on query and other filters
      let filteredData = response;
      if (response && (response as any).data && Array.isArray((response as any).data)) {
        const query = params.query?.toLowerCase() || '';
        let matched = (response as any).data;

        // Apply text search filter
        if (query && query !== '*') {
          matched = matched.filter((note: any) =>
            note.title?.toLowerCase().includes(query) ||
            note.content?.toLowerCase().includes(query)
          );
        }

        // Apply additional filters
        if (params.filters) {
          if (params.filters.customer_emails?.length) {
            const emails = params.filters.customer_emails.map(e => e.toLowerCase());
            matched = matched.filter((note: any) =>
              emails.includes(note.customer?.email?.toLowerCase())
            );
          }

          if (params.filters.tags?.length) {
            const tags = params.filters.tags.map(t => t.toLowerCase());
            matched = matched.filter((note: any) =>
              note.tags?.some((tag: any) => tags.includes(tag.name?.toLowerCase()))
            );
          }
        }

        // Apply offset and limit
        const offset = params.offset || 0;
        const limit = params.limit || 20;
        const paginated = matched.slice(offset, offset + limit);

        filteredData = {
          ...(response as any),
          data: paginated,
          total: matched.length,
          offset,
          limit,
        };
      }

      return {
        success: true,
        data: filteredData,
      };
    } catch (error) {
      this.logger.error('Failed to search notes', error);

      return {
        success: false,
        error: `Failed to search notes: ${(error as Error).message}`,
      };
    }
  }
}