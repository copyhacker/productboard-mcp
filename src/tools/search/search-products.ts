import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface SearchProductsParams {
  query: string;
  includeComponents?: boolean;
  limit?: number;
  offset?: number;
}

export class SearchProductsTool extends BaseTool<SearchProductsParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_search_products',
      'Search for products and components',
      {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query text',
          },
          includeComponents: {
            type: 'boolean',
            default: true,
            description: 'Include components in search results',
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

  protected async executeInternal(params: SearchProductsParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Searching products', { query: params.query });

      const queryParams: Record<string, any> = {
        include_components: params.includeComponents !== false,
      };

      // Productboard API doesn't have a /search/products endpoint
      // Use the /products endpoint and filter client-side
      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/products',
        params: queryParams,
      });

      // Filter results client-side based on query
      let filteredData = response;
      if (params.query && params.query !== '*' && response && (response as any).data && Array.isArray((response as any).data)) {
        const query = params.query.toLowerCase();
        const allProducts = (response as any).data;

        const matched = allProducts.filter((product: any) =>
          product.name?.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query)
        );

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
      this.logger.error('Failed to search products', error);

      return {
        success: false,
        error: `Failed to search products: ${(error as Error).message}`,
      };
    }
  }
}