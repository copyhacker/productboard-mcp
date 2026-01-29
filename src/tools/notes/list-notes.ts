import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListNotesParams {
  featureId?: string;
  companyId?: string;
  ownerEmail?: string;
  anyTag?: string[];
  allTags?: string[];
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  term?: string;
  limit?: number;
  pageCursor?: string;
}

export class ListNotesTool extends BaseTool<ListNotesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_list',
      'List customer feedback notes',
      {
        type: 'object',
        properties: {
          featureId: {
            type: 'string',
            description: 'Filter notes linked to a specific feature ID',
          },
          companyId: {
            type: 'string',
            description: 'Filter by company ID',
          },
          ownerEmail: {
            type: 'string',
            description: 'Filter by note owner email',
          },
          anyTag: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by any of these tags (OR)',
          },
          allTags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by all of these tags (AND)',
          },
          term: {
            type: 'string',
            description: 'Full-text search term',
          },
          createdFrom: {
            type: 'string',
            format: 'date',
            description: 'Filter notes created after this date (YYYY-MM-DD)',
          },
          createdTo: {
            type: 'string',
            format: 'date',
            description: 'Filter notes created before this date (YYYY-MM-DD)',
          },
          updatedFrom: {
            type: 'string',
            format: 'date',
            description: 'Filter notes updated after this date (YYYY-MM-DD)',
          },
          updatedTo: {
            type: 'string',
            format: 'date',
            description: 'Filter notes updated before this date (YYYY-MM-DD)',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 2000,
            default: 100,
            description: 'Maximum number of notes to return',
          },
          pageCursor: {
            type: 'string',
            description: 'Cursor for pagination to get next page',
          },
        },
      },
      {
        requiredPermissions: [Permission.NOTES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to notes',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListNotesParams = {}): Promise<unknown> {
    this.logger.info('Listing notes');

    const queryParams: Record<string, any> = {
      pageLimit: Math.min(params.limit || 100, 2000),
    };

    if (params.featureId) queryParams.featureId = params.featureId;
    if (params.companyId) queryParams.companyId = params.companyId;
    if (params.ownerEmail) queryParams.ownerEmail = params.ownerEmail;
    if (params.term) queryParams.term = params.term;
    if (params.anyTag && params.anyTag.length > 0) {
      queryParams.anyTag = params.anyTag.join(',');
    }
    if (params.allTags && params.allTags.length > 0) {
      queryParams.allTags = params.allTags.join(',');
    }
    if (params.createdFrom) queryParams.createdFrom = params.createdFrom;
    if (params.createdTo) queryParams.createdTo = params.createdTo;
    if (params.updatedFrom) queryParams.updatedFrom = params.updatedFrom;
    if (params.updatedTo) queryParams.updatedTo = params.updatedTo;
    if (params.pageCursor) queryParams.pageCursor = params.pageCursor;

    const response = await this.apiClient.makeRequest({
      method: 'GET',
      endpoint: '/notes',
      params: queryParams,
    });

    // Extract notes data
    let notes: any[] = [];
    if (response && (response as any).data) {
      notes = (response as any).data;
    } else if (Array.isArray(response)) {
      notes = response;
    }
    
    // Format response for MCP protocol
    const formattedNotes = notes.map((note: any) => ({
      id: note.id,
      title: note.title || note.content?.substring(0, 50) || 'Untitled Note',
      content: note.content || '',
      customer: note.customer?.email || 'Unknown',
      company: note.company?.name || 'Unknown',
      createdAt: note.created_at || note.createdAt,
      tags: note.tags || [],
    }));
    
    // Create a text summary of the notes
    const summary = formattedNotes.length > 0
      ? `Found ${formattedNotes.length} notes:\n\n${ 
        formattedNotes.map((n, i) => 
          `${i + 1}. ${n.title}\n` +
          `   Customer: ${n.customer}\n` +
          `   Company: ${n.company}\n` +
          `   Content: ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}\n` +
          `   Tags: ${n.tags.length > 0 ? n.tags.join(', ') : 'None'}\n`
        ).join('\n')}`
      : 'No notes found.';
    
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