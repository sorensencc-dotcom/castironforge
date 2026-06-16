// MCP tool definition: wraps MemoryAdmin endpoints

export const memoryAdminTool = {
  name: 'memory_admin',
  description:
    'Manage CIC Memory Spine versions. ' +
    'Actions: activate (load a new memory-vN), rollback (revert to previous), status (show active version and corpus stats).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['activate', 'rollback', 'status'],
        description: 'Admin action to perform.',
      },
      target_version: {
        type: 'string',
        description: 'For activate: the memory version to activate (e.g. memory-v4).',
      },
      to_version: {
        type: 'string',
        description: 'For rollback: the version to roll back to. Defaults to previous version.',
      },
    },
    required: ['action'],
  },
};
