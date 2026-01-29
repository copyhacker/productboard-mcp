import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface LinkFeaturesToObjectiveParams {
  featureId: string;
  objectiveId: string;
}

export class LinkFeaturesToObjectiveTool extends BaseTool<LinkFeaturesToObjectiveParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_objective_link_feature',
      'Link a feature to an objective',
      {
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
      },
      {
        requiredPermissions: [Permission.OBJECTIVES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to objectives',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: LinkFeaturesToObjectiveParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Linking feature to objective', {
        featureId: params.featureId,
        objectiveId: params.objectiveId
      });

      // API endpoint: POST /features/{id}/links/objectives/{objectiveId}
      // Links one feature to one objective
      const response = await this.apiClient.post(`/features/${params.featureId}/links/objectives/${params.objectiveId}`, {});

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to link feature to objective', error);

      return {
        success: false,
        error: `Failed to link feature to objective: ${(error as Error).message}`,
      };
    }
  }
}