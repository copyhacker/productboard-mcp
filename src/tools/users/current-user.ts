import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface CurrentUserParams {}

export class CurrentUserTool extends BaseTool<CurrentUserParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_user_current',
      'Get current authenticated user information from API token',
      {
        type: 'object',
        properties: {},
      },
      {
        requiredPermissions: [Permission.USERS_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to user information',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(_params: CurrentUserParams): Promise<unknown> {
    this.logger.info('Getting current user information');

    // Note: Productboard API doesn't have a /me endpoint
    // Extract user information from the JWT token payload
    try {
      // Get the auth token to extract user information
      const authHeader = (this.apiClient as any).authManager?.getAuthHeaders?.()?.['Authorization'];

      if (!authHeader) {
        return {
          success: false,
          error: 'No authentication token available',
        };
      }

      // Extract payload from JWT token
      const token = authHeader.replace('Bearer ', '');
      const parts = token.split('.');

      if (parts.length !== 3) {
        return {
          success: false,
          error: 'Invalid token format',
        };
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      // Return user information from token payload
      return {
        success: true,
        data: {
          id: payload.user_id || payload.sub,
          role: payload.role,
          spaceId: payload.space_id,
          region: payload.region,
          authenticated: true,
          tokenIssuer: payload.iss,
          tokenIssuedAt: new Date(payload.iat * 1000).toISOString(),
          note: 'User information extracted from API token. Productboard API does not provide a /me endpoint.',
        },
      };
    } catch (error) {
      this.logger.error('Failed to get current user', error);
      return {
        success: false,
        error: 'Unable to extract user information from token',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}