import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface AttachNoteParams {
  noteId: string;
  entityId: string;
  entityType?: 'feature' | 'subfeature' | 'product' | 'component';
}

export class AttachNoteTool extends BaseTool<AttachNoteParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_attach',
      'Link a note to a feature, product, component, or subfeature',
      {
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
          entityType: {
            type: 'string',
            enum: ['feature', 'subfeature', 'product', 'component'],
            description: 'Type of entity being linked (for logging/clarity, not used in API call)',
          },
        },
      },
      {
        requiredPermissions: [Permission.NOTES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to notes',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: AttachNoteParams): Promise<unknown> {
    this.logger.info('Linking note to entity', {
      noteId: params.noteId,
      entityId: params.entityId,
      entityType: params.entityType || 'unknown',
    });

    // API endpoint: POST /notes/{noteId}/links/{entityId}
    // Links one note to one entity (feature, product, component, or subfeature)
    await this.apiClient.makeRequest({
      method: 'POST',
      endpoint: `/notes/${params.noteId}/links/${params.entityId}`,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Successfully linked note ${params.noteId} to entity ${params.entityId}`
        }
      ]
    };
  }
}