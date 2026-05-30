import { loadRedesignSkill } from "../skillopt/skillRegistryLoader.mjs";
import { createRedesignAgent } from "../skillopt/redesignAgent.mjs";
import { SkillOptTelemetry } from "../skillopt/telemetry.mjs";
import { SkillOptConsumer } from "../skillopt/skillOptConsumer.mjs";

export async function processIngestionEvent(event) {
  // 1. Load skill
  // Placeholder for skillRegistryLoader.mjs - assuming it exists and works as expected
  // For now, mocking skill load
  const skill = { version: "1.0.0", config: {} }; // Mock skill

  const agent = createRedesignAgent(skill);

  // 2. Generate redesign
  const start = performance.now();
  const redesignPlan = agent.generate({
    dom: event.dom,
    contentBlocks: event.contentBlocks,
    heuristics: event.heuristics,
    auditDeltas: event.auditDeltas,
    metadata: event.metadata
  });
  const end = performance.now();

  // 3. Attach redesign to event
  event.redesignPlan = redesignPlan;

  // 4. Emit telemetry
  SkillOptTelemetry.record({
    skillVersion: skill.version,
    runtimeLatencyMs: end - start,
    inputSize: JSON.stringify(event).length,
    outputSize: redesignPlan.length
  });

  // 5. Emit SkillOpt training item
  await SkillOptConsumer.consume({
    input: {
      dom: event.dom,
      content_blocks: event.contentBlocks,
      heuristics: event.heuristics,
      audit_deltas: event.auditDeltas
    },
    target: {
      redesign_plan: redesignPlan
    },
    metadata: event.metadata
  });

  return event;
}
