import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger.js';

export class AgentRunner {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
  }

  async invoke(agentDef, input) {
    const { id, instructions } = agentDef;
    logger.info('agent_invoke_start', { agent_id: id });

    const systemPrompt =
      instructions +
      '\n\n' +
      'Respond ONLY with valid JSON matching the expected output schema. ' +
      'No markdown, no preamble, no explanations.';

    const userMessage = 'Input: ' + JSON.stringify(input);

    try {
      const response = await this.client.messages.create({
        model: agentDef.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      let output;
      try {
        output = JSON.parse(text);
      } catch (e) {
        logger.error('agent_json_parse_failed', { agent_id: id, text, error: e.message });
        throw new Error(`Agent ${id} output is not valid JSON`);
      }

      logger.info('agent_invoke_success', { agent_id: id, output_keys: Object.keys(output) });
      return output;
    } catch (error) {
      logger.error('agent_invoke_failed', { agent_id: id, error: error.message });
      throw error;
    }
  }
}
