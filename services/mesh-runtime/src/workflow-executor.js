import { logger } from './logger.js';
import { resolveTemplates } from './templates.js';
import { buildExecutionOrder } from './graph.js';
import { nowISO } from './datetime.js';

export class WorkflowExecutor {
  constructor(loader, agentRunner) {
    this.loader = loader;
    this.agentRunner = agentRunner;
  }

  async execute(workflowId, triggerEvent) {
    logger.info('workflow_start', { workflow_id: workflowId, event: triggerEvent.event });
    const workflow = await this.loader.loadWorkflow(workflowId);
    const steps = buildExecutionOrder(workflow.workflow.steps);
    const stepOutputs = {};
    const context = { event: triggerEvent, steps: stepOutputs, now: nowISO() };

    for (const step of steps) {
      logger.info('step_start', { workflow_id: workflowId, step_id: step.id });

      // Resolve input templates
      const input = resolveTemplates(step.input, context);

      // Load and invoke agent
      const agent = await this.loader.loadAgent(step.agent);
      let output;
      try {
        output = await this.agentRunner.invoke(agent, input);
      } catch (error) {
        logger.error('step_failed', { workflow_id: workflowId, step_id: step.id, error: error.message });
        throw error;
      }

      stepOutputs[step.id] = output;
      logger.info('step_success', { workflow_id: workflowId, step_id: step.id });
    }

    // Check HITL gates
    for (const gate of workflow.workflow.hitl || []) {
      const { step, condition, action } = gate;
      const shouldGate = condition
        ? resolveTemplates(condition, context) === 'true'
        : action === 'approve';

      if (shouldGate) {
        logger.info('hitl_gate_active', {
          workflow_id: workflowId,
          step,
          description: gate.description,
        });
        // In a real system, this would pause and wait for human approval via API.
        // For now, log and return a pending status.
        return { status: 'awaiting_approval', workflow_id: workflowId, step, stepOutputs };
      }
    }

    logger.info('workflow_success', { workflow_id: workflowId });
    return { status: 'success', workflow_id: workflowId, stepOutputs };
  }
}
