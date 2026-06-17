/**
 * Chat Edit Session
 * filename: ChatEditSession.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Main chat session handler for real-time DOM/code editing.
 * Integrates ChatRequestEnvelope → UnifiedRouter → ToolRouter → GLM-5 execution.
 */

import { v4 as uuidv4 } from "crypto";
import {
  ChatRequestEnvelope,
  RouterMode,
  UnifiedContextFrame,
  EditProtocol,
} from "../types/index.js";
import { ToolRouteRequest, ToolRouteResult } from "../registry/types.js";

interface Logger {
  info(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  debug(msg: string, meta?: unknown): void;
}

interface UnifiedRouter {
  classify(envelope: unknown): Promise<{ task_type?: string; scope?: string }>;
  route(
    classification: unknown
  ): { model: string; reasoning_effort: string; enable_thinking: boolean };
  assembleContext(envelope: unknown): UnifiedContextFrame;
  execute(
    decision: unknown,
    context: UnifiedContextFrame,
    prompt: string
  ): Promise<EditProtocol | unknown>;
}

interface ToolRouter {
  route(request: ToolRouteRequest): ToolRouteResult;
}

interface Turn {
  id: string;
  timestamp: number;
  userMessage: string;
  classification?: unknown;
  routingDecision?: unknown;
  selectedTool?: ToolRouteResult;
  glmResponse?: unknown;
  editProtocol?: EditProtocol;
  appliedAt?: number;
  undoable?: boolean;
}

/**
 * Chat session for real-time DOM and code editing
 */
export class ChatEditSession {
  private sessionId: string;
  private turns: Turn[] = [];
  private turnCache: Map<string, Turn> = new Map();
  private contextStack: UnifiedContextFrame[] = [];
  private mode: RouterMode = "chat";

  constructor(
    private unifiedRouter: UnifiedRouter,
    private toolRouter: ToolRouter,
    private logger: Logger,
    sessionId?: string
  ) {
    this.sessionId = sessionId || uuidv4();
    this.logger.info(`Chat session created`, { sessionId: this.sessionId });
  }

  /**
   * Process a chat message and return edit(s)
   */
  async processMessage(envelope: ChatRequestEnvelope): Promise<EditProtocol | undefined> {
    const turnId = uuidv4();
    const turn: Turn = {
      id: turnId,
      timestamp: Date.now(),
      userMessage: envelope.user_message,
    };

    try {
      // Step 1: Classify the request
      this.logger.debug(`Classifying request`, { turnId, mode: this.mode });

      const classification = await this.unifiedRouter.classify(envelope);
      turn.classification = classification;

      // Step 2: Route to tool
      const routingDecision = this.unifiedRouter.route(classification);
      turn.routingDecision = routingDecision;

      this.logger.debug(`Routing decision`, {
        turnId,
        taskType: (classification as { task_type?: string }).task_type,
        model: routingDecision.model,
      });

      // Step 3: Assemble context
      const context = this.unifiedRouter.assembleContext(envelope);
      context.mode = this.mode;

      this.contextStack.push(context);

      // Step 4: Build GLM-5 prompt based on edit protocol
      const prompt = this.buildPrompt(classification as unknown, context);

      // Step 5: Execute GLM-5 call
      const glmResponse = await this.unifiedRouter.execute(
        routingDecision,
        context,
        prompt
      );

      turn.glmResponse = glmResponse;

      // Step 6: Validate and return edit protocol
      if (this.isValidEditProtocol(glmResponse)) {
        turn.editProtocol = glmResponse as EditProtocol;

        this.logger.info(`Edit protocol generated`, {
          turnId,
          action: glmResponse.action,
          sessionId: this.sessionId,
        });

        // Store in cache
        this.turnCache.set(turnId, turn);
        this.turns.push(turn);

        return glmResponse as EditProtocol;
      } else {
        this.logger.error(`Invalid edit protocol from GLM-5`, {
          turnId,
          response: glmResponse,
        });

        throw new Error("GLM-5 returned invalid edit protocol");
      }
    } catch (error) {
      this.logger.error(`Turn processing failed`, {
        turnId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Apply an edit protocol to the DOM/code
   */
  async applyEdit(
    editProtocol: EditProtocol
  ): Promise<{ success: boolean; message?: string }> {
    const turnId = this.turns[this.turns.length - 1]?.id;

    if (!turnId) {
      return { success: false, message: "No turn to apply edit to" };
    }

    const turn = this.turnCache.get(turnId);
    if (!turn) {
      return { success: false, message: "Turn not found in cache" };
    }

    try {
      switch (editProtocol.action) {
        case "dom_edit":
          // Apply DOM patches
          return await this.applyDOMEdit(editProtocol as any);

        case "code_edit":
          // Apply code diff
          return await this.applyCodeEdit(editProtocol as any);

        case "design_variant":
          // Render design variant
          return await this.applyDesignVariant(editProtocol as any);

        case "refactor_plan":
          // Present refactor plan to user (requires confirmation)
          return { success: true, message: "Refactor plan ready for review" };

        case "answer":
          // Display answer
          return { success: true, message: "Answer displayed" };

        default:
          return { success: false, message: `Unknown action: ${(editProtocol as any).action}` };
      }
    } catch (error) {
      this.logger.error(`Failed to apply edit`, {
        turnId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Undo the last edit
   */
  undo(): boolean {
    if (this.turns.length === 0) {
      return false;
    }

    const lastTurn = this.turns[this.turns.length - 1];

    if (!lastTurn.undoable) {
      return false;
    }

    this.logger.info(`Undoing turn`, { turnId: lastTurn.id });

    // TODO: Implement actual undo logic based on edit protocol type
    // For now, just mark as undone

    this.turns.pop();

    return true;
  }

  /**
   * Get session metadata
   */
  getMetadata(): {
    sessionId: string;
    mode: RouterMode;
    turnCount: number;
    lastTurn?: Turn;
  } {
    return {
      sessionId: this.sessionId,
      mode: this.mode,
      turnCount: this.turns.length,
      lastTurn: this.turns[this.turns.length - 1],
    };
  }

  /**
   * Get turn history
   */
  getHistory(): Turn[] {
    return [...this.turns];
  }

  /**
   * Private: Build GLM-5 prompt from classification and context
   */
  private buildPrompt(classification: unknown, context: UnifiedContextFrame): string {
    // TODO: Load appropriate prompt pack based on task type
    // For now, return a generic prompt

    const taskType = (classification as { task_type?: string }).task_type || "chat";

    return `You are a code and UI editing assistant.

User request: "${context.user_intent}"

Current context:
${JSON.stringify(context, null, 2)}

Respond with ONLY valid JSON matching the appropriate edit protocol schema.`;
  }

  /**
   * Private: Check if response is valid edit protocol
   */
  private isValidEditProtocol(response: unknown): response is EditProtocol {
    if (!response || typeof response !== "object") {
      return false;
    }

    const obj = response as Record<string, unknown>;

    return (
      typeof obj.action === "string" &&
      ["dom_edit", "code_edit", "design_variant", "refactor_plan", "answer"].includes(
        obj.action as string
      )
    );
  }

  /**
   * Private: Apply DOM edit protocol
   */
  private async applyDOMEdit(edit: any): Promise<{ success: boolean; message?: string }> {
    // TODO: Integrate with DOMPatch applicator
    this.logger.debug(`Applying DOM edit`, { selector: edit.target?.selector });

    return {
      success: true,
      message: `Applied DOM edit to ${edit.target?.selector}`,
    };
  }

  /**
   * Private: Apply code edit protocol
   */
  private async applyCodeEdit(edit: any): Promise<{ success: boolean; message?: string }> {
    // TODO: Apply unified diff to file
    this.logger.debug(`Applying code edit`, { file: edit.file });

    return {
      success: true,
      message: `Applied code edit to ${edit.file}`,
    };
  }

  /**
   * Private: Apply design variant
   */
  private async applyDesignVariant(edit: any): Promise<{ success: boolean; message?: string }> {
    // TODO: Integrate with DesignVariantRenderer
    this.logger.debug(`Applying design variant`, { component: edit.component });

    return {
      success: true,
      message: `Rendered design variants for ${edit.component}`,
    };
  }
}

export { Logger, UnifiedRouter, ToolRouter, Turn };
