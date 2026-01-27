import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';
interface GlobalSearchParams {
  query: string;
  types?: Array<'feature' | 'note' | 'product' | 'objective' | 'user'>;
  limit?: number;
}

export class GlobalSearchTool extends BaseTool<GlobalSearchParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_search',
      'Search across all Productboard entities',
      {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            minLength: 1,
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

  protected async executeInternal(params: GlobalSearchParams): Promise<unknown> {
    try {
      this.logger.info('Performing global search', { query: params.query });

      const limit = params.limit || 10;
      const query = params.query.toLowerCase();
      const searchTypes = params.types || ['feature', 'note', 'product'];

      // Productboard API doesn't have a /search endpoint
      // We need to search each entity type separately and combine results
      const results: any = {};

      // Search features if requested
      if (searchTypes.includes('feature')) {
        try {
          const featureResponse = await this.apiClient.makeRequest({
            method: 'GET',
            endpoint: '/features',
            params: { limit: 100 }, // Fetch more for better filtering
          });

          if (featureResponse && (featureResponse as any).data) {
            results.features = ((featureResponse as any).data as any[])
              .filter((f: any) =>
                f.name?.toLowerCase().includes(query) ||
                f.description?.toLowerCase().includes(query)
              )
              .slice(0, limit);
          }
        } catch (error) {
          this.logger.debug('Failed to search features', error);
          results.features = [];
        }
      }

      // Search products if requested
      if (searchTypes.includes('product')) {
        try {
          const productResponse = await this.apiClient.makeRequest({
            method: 'GET',
            endpoint: '/products',
            params: { limit: 100 },
          });

          if (productResponse && (productResponse as any).data) {
            results.products = ((productResponse as any).data as any[])
              .filter((p: any) =>
                p.name?.toLowerCase().includes(query) ||
                p.description?.toLowerCase().includes(query)
              )
              .slice(0, limit);
          }
        } catch (error) {
          this.logger.debug('Failed to search products', error);
          results.products = [];
        }
      }

      // Search notes if requested
      if (searchTypes.includes('note')) {
        try {
          const noteResponse = await this.apiClient.makeRequest({
            method: 'GET',
            endpoint: '/notes',
            params: { limit: 100 },
          });

          if (noteResponse && (noteResponse as any).data) {
            results.notes = ((noteResponse as any).data as any[])
              .filter((n: any) =>
                n.title?.toLowerCase().includes(query) ||
                n.content?.toLowerCase().includes(query)
              )
              .slice(0, limit);
          }
        } catch (error) {
          this.logger.debug('Failed to search notes', error);
          results.notes = [];
        }
      }
      
      // Format search results by type
      const sections: string[] = [];
      
      // Process features
      if (results.features && results.features.length > 0) {
        sections.push(`FEATURES (${results.features.length}):\n` +
          results.features.map((f: any, i: number) => 
            `${i + 1}. ${f.name || 'Untitled Feature'}\n` +
            `   Status: ${f.status?.name || 'Unknown'}\n` +
            `   Description: ${(f.description || 'No description').substring(0, 100)}${f.description?.length > 100 ? '...' : ''}`
          ).join('\n\n'));
      }
      
      // Process notes
      if (results.notes && results.notes.length > 0) {
        sections.push(`NOTES (${results.notes.length}):\n` +
          results.notes.map((n: any, i: number) => 
            `${i + 1}. ${n.title || n.content?.substring(0, 50) || 'Untitled Note'}\n` +
            `   Customer: ${n.customer?.email || 'Unknown'}\n` +
            `   Content: ${(n.content || '').substring(0, 100)}${n.content?.length > 100 ? '...' : ''}`
          ).join('\n\n'));
      }
      
      // Process products
      if (results.products && results.products.length > 0) {
        sections.push(`PRODUCTS (${results.products.length}):\n` +
          results.products.map((p: any, i: number) => 
            `${i + 1}. ${p.name || 'Untitled Product'}\n` +
            `   Description: ${(p.description || 'No description').substring(0, 100)}${p.description?.length > 100 ? '...' : ''}`
          ).join('\n\n'));
      }
      
      // Process objectives
      if (results.objectives && results.objectives.length > 0) {
        sections.push(`OBJECTIVES (${results.objectives.length}):\n` +
          results.objectives.map((o: any, i: number) => 
            `${i + 1}. ${o.name || 'Untitled Objective'}\n` +
            `   Status: ${o.status || 'Unknown'}\n` +
            `   Description: ${(o.description || 'No description').substring(0, 100)}${o.description?.length > 100 ? '...' : ''}`
          ).join('\n\n'));
      }
      
      // Process users
      if (results.users && results.users.length > 0) {
        sections.push(`USERS (${results.users.length}):\n` +
          results.users.map((u: any, i: number) => 
            `${i + 1}. ${u.name || 'Unknown User'}\n` +
            `   Email: ${u.email || 'No email'}\n` +
            `   Role: ${u.role || 'Unknown'}`
          ).join('\n\n'));
      }
      
      const summary = sections.length > 0
        ? `Search results for "${params.query}":\n\n${sections.join('\n\n')}`
        : `No results found for "${params.query}"`;
      
      // Return in MCP expected format
      return {
        content: [
          {
            type: 'text',
            text: summary
          }
        ]
      };
    } catch (error) {
      this.logger.error('Failed to perform global search', error);

      // Return error in MCP format
      return {
        content: [
          {
            type: 'text',
            text: `Failed to perform search: ${(error as Error).message}`
          }
        ]
      };
    }
  }
}