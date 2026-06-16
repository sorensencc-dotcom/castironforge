// MCP tool definition: wraps POST /v1/memory/query

export const memoryQueryTool = {
  name: 'memory_query',
  description:
    'Query the CIC Memory Spine for a deterministic, corpus-independent answer. ' +
    'Returns answer_text, provenance, confidence, and memory_version. ' +
    'Use for CIC knowledge lookups before falling back to RAG or TorqueQuery.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query_text: {
        type: 'string',
        description: 'The natural-language question to answer.',
      },
      task_type: {
        type: 'string',
        description: 'Hint for memory router: build, repair, plan, inspect.',
        enum: ['build', 'repair', 'plan', 'inspect'],
      },
      domain: {
        type: 'string',
        description: 'Knowledge domain: cic-core, skills, roadmap, infra.',
        enum: ['cic-core', 'skills', 'roadmap', 'infra'],
      },
      time_hint: {
        type: 'string',
        description: 'ISO 8601 timestamp. Prefer documents valid at this time.',
      },
      max_tokens: {
        type: 'number',
        description: 'Maximum answer length in tokens (default: 256).',
      },
    },
    required: ['query_text'],
  },
};
