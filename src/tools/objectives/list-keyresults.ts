import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ListKeyResultsParams {
  objective_id?: string;
  metric_type?: 'number' | 'percentage' | 'currency';
  limit?: number;
  pageCursor?: string;
}

export class ListKeyResultsTool extends BaseTool<ListKeyResultsParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_keyresult_list',
      'List key results with optional filtering',
      {
        type: 'object',
        properties: {
          objective_id: {
            type: 'string',
            description: 'Filter by objective ID',
          },
          metric_type: {
            type: 'string',
            enum: ['number', 'percentage', 'currency'],
            description: 'Filter by metric type',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 2000,
            default: 100,
            description: 'Maximum number of key results to return',
          },
          pageCursor: {
            type: 'string',
            description: 'Cursor for pagination to get next page',
          },
        },
      },
      {
        requiredPermissions: [Permission.OBJECTIVES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to objectives',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListKeyResultsParams = {}): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Listing key results');

      const queryParams: Record<string, any> = {
        pageLimit: Math.min(params.limit || 100, 2000),
      };
      if (params.objective_id) queryParams.objective_id = params.objective_id;
      if (params.metric_type) queryParams.metric_type = params.metric_type;
      if (params.pageCursor) queryParams.pageCursor = params.pageCursor;

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/key-results',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to list key results', error);
      
      return {
        success: false,
        error: `Failed to list key results: ${(error as Error).message}`,
      };
    }
  }
}