import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ListFeaturesParams {
  status?: 'new' | 'in_progress' | 'validation' | 'done' | 'archived';
  product_id?: string;
  component_id?: string;
  owner_email?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sort?: 'created_at' | 'updated_at' | 'name' | 'priority';
  order?: 'asc' | 'desc';
}

export class ListFeaturesTool extends BaseTool<ListFeaturesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_list',
      'List features with optional filtering and pagination',
      {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['new', 'in_progress', 'validation', 'done', 'archived'],
            description: 'Filter by feature status',
          },
          product_id: {
            type: 'string',
            description: 'Filter by product ID',
          },
          component_id: {
            type: 'string',
            description: 'Filter by component ID',
          },
          owner_email: {
            type: 'string',
            description: 'Filter by owner email',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags (features must have all specified tags)',
          },
          search: {
            type: 'string',
            description: 'Search in feature names and descriptions',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
            default: 20,
            description: 'Number of results per page',
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Number of results to skip',
          },
          sort: {
            type: 'string',
            enum: ['created_at', 'updated_at', 'name', 'priority'],
            default: 'created_at',
            description: 'Sort field',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
            description: 'Sort order',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to features',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListFeaturesParams): Promise<unknown> {
    // Build query parameters - Productboard API supports parent.id filtering
    const queryParams: Record<string, any> = {};

    // API-level filtering using parent.id
    // Note: product_id and component_id map to parent.id in the Productboard API
    if (params.product_id) {
      queryParams['parent.id'] = params.product_id;
    }
    if (params.component_id) {
      // Component filtering also uses parent.id (components are parents too)
      queryParams['parent.id'] = params.component_id;
    }

    // Pagination - use pageLimit (1-2000, default 100)
    const pageLimit = Math.min(params.limit || 100, 2000);
    queryParams.pageLimit = pageLimit;

    this.logger.debug('Fetching features with API-level filtering', {
      queryParams,
      clientSideFilters: { status: params.status, owner_email: params.owner_email, search: params.search, tags: params.tags }
    });

    const response = await this.apiClient.get('/features', queryParams);

    // Extract feature data
    let features: any[] = [];
    if (response && (response as any).data) {
      features = (response as any).data;
    } else if (Array.isArray(response)) {
      features = response;
    }

    // Apply client-side filtering for parameters not supported by the API
    // Note: product_id and component_id are now handled by API-level filtering
    let filteredFeatures = features;

    if (params.status) {
      filteredFeatures = filteredFeatures.filter(f =>
        f.status?.name?.toLowerCase() === params.status?.toLowerCase()
      );
    }

    if (params.owner_email) {
      filteredFeatures = filteredFeatures.filter(f =>
        f.owner?.email?.toLowerCase() === params.owner_email?.toLowerCase()
      );
    }

    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filteredFeatures = filteredFeatures.filter(f =>
        f.name?.toLowerCase().includes(searchLower) ||
        f.description?.toLowerCase().includes(searchLower)
      );
    }

    if (params.tags && params.tags.length > 0) {
      filteredFeatures = filteredFeatures.filter(f => {
        if (!f.tags || !Array.isArray(f.tags)) return false;
        const featureTags = f.tags.map((t: any) => t.name || t).map((t: string) => t.toLowerCase());
        return params.tags!.every(tag => featureTags.includes(tag.toLowerCase()));
      });
    }

    // Apply client-side sorting
    if (params.sort) {
      filteredFeatures.sort((a, b) => {
        let aVal, bVal;
        switch (params.sort) {
          case 'name':
            aVal = a.name || '';
            bVal = b.name || '';
            break;
          case 'created_at':
            aVal = a.createdAt || '';
            bVal = b.createdAt || '';
            break;
          case 'updated_at':
            aVal = a.updatedAt || '';
            bVal = b.updatedAt || '';
            break;
          case 'priority':
            aVal = a.priority || 0;
            bVal = b.priority || 0;
            break;
          default:
            return 0;
        }

        if (params.order === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
    }

    // Apply client-side pagination (for offset support, as API uses cursor-based pagination)
    const requestedOffset = params.offset || 0;
    const requestedLimit = params.limit || 20;
    const paginatedFeatures = filteredFeatures.slice(requestedOffset, requestedOffset + requestedLimit);
    
    // Helper function to strip HTML tags
    const stripHtml = (html: string): string => {
      return html
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
        .replace(/&lt;/g, '<')   // Replace HTML entities
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim();
    };
    
    // Format response for MCP protocol
    const formattedFeatures = paginatedFeatures.map((feature: any) => ({
      id: feature.id,
      name: feature.name || 'Untitled Feature',
      description: feature.description ? stripHtml(feature.description) : '',
      status: feature.status?.name || 'Unknown',
      owner: feature.owner?.email || 'Unassigned',
      createdAt: feature.createdAt,
      updatedAt: feature.updatedAt,
    }));
    
    // Create a text summary of the features
    const summary = formattedFeatures.length > 0
      ? `Found ${filteredFeatures.length} matching features (from ${features.length} total), showing ${formattedFeatures.length}:\n\n${
        formattedFeatures.map((f, i) =>
          `${i + 1}. ${f.name}\n` +
          `   ID: ${f.id}\n` +
          `   Status: ${f.status}\n` +
          `   Owner: ${f.owner}\n` +
          `   Description: ${f.description || 'No description'}\n`
        ).join('\n')}`
      : 'No features found.';
    
    // Return in MCP expected format
    return {
      content: [
        {
          type: 'text',
          text: summary
        }
      ]
    };
  }
}