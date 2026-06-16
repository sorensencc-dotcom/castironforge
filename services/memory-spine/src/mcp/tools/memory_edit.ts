// MCP tool definition: wraps POST /v1/memory/edit

export const memoryEditTool = {
  name: 'memory_edit',
  description:
    'Add, update, or delete a document in the CIC Memory Spine corpus. ' +
    'Each edit bumps the memory version. Requires edit permission.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'update', 'delete'],
        description: 'The edit operation to perform.',
      },
      doc_id: {
        type: 'string',
        description: 'Target document identifier (e.g. adr-42).',
      },
      payload: {
        type: 'object',
        description: 'Document fields to write. Omit for delete.',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          domain: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    required: ['operation', 'doc_id'],
  },
};
