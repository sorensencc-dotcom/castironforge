/**
 * Chat Engine Service
 * filename: ChatEngineService.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Main orchestrator for the chat engine.
 * Coordinates GLM-5 router, tool registry, session management, and applicators.
 */

import { ChatEditSession } from "../chat/ChatEditSession.js";
import { DOMPatchApplicator } from "../chat/DOMPatchApplicator.js";
import { CodeEditApplicator } from "../chat/CodeEditApplicator.js";
import { DesignVariantRenderer } from "../chat/DesignVariantRenderer.js";
import {
  ChatRequestEnvelope,
  EditProtocol,
  UnifiedContextFrame,
  RouterMode,
} from "../types/index.js";

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
  route(request: unknown): unknown;
}

interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

interface ChatResponse {
  session_id: string;
  turn_id: string;
  edit_protocol?: EditProtocol;
  application_result: { success: boolean; message: string };
  metadata: {
    duration_ms: number;
    model: string;
    tokens: TokenUsage;
  };
}

/**
 * Main Chat Engine Service
 */
export class ChatEngineService {
  private sessions: Map<string, ChatEditSession> = new Map();
  private sessionTimeout: Map<string, NodeJS.Timeout> = new Map();
  private domPatchApplicator: DOMPatchApplicator;
  private codePatchApplicator: CodeEditApplicator;
  private designVariantRenderer: DesignVariantRenderer;
  private sessionTTLMs: number = 3600000; // 1 hour

  constructor(
    private unifiedRouter: UnifiedRouter,
    private toolRouter: ToolRouter,
    private logger: Logger,
    private fileProvider?: (path: string) => Promise<string>
  ) {
    this.domPatchApplicator = new DOMPatchApplicator(logger);
    this.codePatchApplicator = new CodeEditApplicator(logger, fileProvider);
    this.designVariantRenderer = new DesignVariantRenderer(logger);

    this.logger.info(`Chat Engine Service initialized`);
  }

  /**
   * Process a chat message
   */
  async processMessage(envelope: ChatRequestEnvelope): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // Get or create session
      const sessionId = envelope.session_id || this.generateSessionId();
      let session = this.sessions.get(sessionId);

      if (!session) {
        session = new ChatEditSession(this.unifiedRouter, this.toolRouter, this.logger, sessionId);
        this.sessions.set(sessionId, session);
      }

      // Reset session timeout
      this.resetSessionTimeout(sessionId);

      // Process message through session
      const editProtocol = await session.processMessage(envelope);

      if (!editProtocol) {
        return {
          session_id: sessionId,
          turn_id: "",
          application_result: {
            success: false,
            message: "No edit protocol generated",
          },
          metadata: {
            duration_ms: Date.now() - startTime,
            model: "unknown",
            tokens: { input: 0, output: 0, total: 0 },
          },
        };
      }

      // Apply edit based on action type
      const applicationResult = await this.applyEdit(session, editProtocol);

      const turnId = session.getMetadata().lastTurn?.id || "";

      return {
        session_id: sessionId,
        turn_id: turnId,
        edit_protocol: editProtocol,
        application_result: applicationResult,
        metadata: {
          duration_ms: Date.now() - startTime,
          model: "glm-5",
          tokens: { input: 0, output: 0, total: 0 },
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Chat message processing failed`, { error: msg });

      return {
        session_id: envelope.session_id || "",
        turn_id: "",
        application_result: {
          success: false,
          message: `Processing failed: ${msg}`,
        },
        metadata: {
          duration_ms: Date.now() - startTime,
          model: "unknown",
          tokens: { input: 0, output: 0, total: 0 },
        },
      };
    }
  }

  /**
   * Apply an edit protocol
   */
  private async applyEdit(
    session: ChatEditSession,
    editProtocol: EditProtocol
  ): Promise<{ success: boolean; message: string }> {
    try {
      switch ((editProtocol as any).action) {
        case "dom_edit":
          return this.applyDOMEdit(editProtocol as any);

        case "code_edit":
          return this.applyCodeEdit(editProtocol as any);

        case "design_variant":
          return this.applyDesignVariant(editProtocol as any);

        case "refactor_plan":
          return { success: true, message: "Refactor plan ready for review" };

        case "answer":
          return { success: true, message: "Answer displayed" };

        default:
          return {
            success: false,
            message: `Unknown action: ${(editProtocol as any).action}`,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Edit application failed`, { error: msg });

      return {
        success: false,
        message: `Edit application failed: ${msg}`,
      };
    }
  }

  /**
   * Apply a DOM edit
   */
  private async applyDOMEdit(edit: any): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.domPatchApplicator.applyPatches({
        selector: edit.target?.selector || "",
        patches: edit.patches || [],
        explanation: edit.explanation,
      });

      return {
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `DOM edit failed: ${msg}` };
    }
  }

  /**
   * Apply a code edit
   */
  private async applyCodeEdit(edit: any): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.codePatchApplicator.applyEdit({
        file: edit.file || "",
        diff: edit.diff || "",
        explanation: edit.explanation,
      });

      return {
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Code edit failed: ${msg}` };
    }
  }

  /**
   * Apply a design variant
   */
  private async applyDesignVariant(edit: any): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.designVariantRenderer.renderVariant({
        selector: edit.target?.selector || "",
        component: edit.component,
        tokens: edit.tokens || [],
        theme: edit.theme,
        globalTokens: edit.globalTokens,
        explanation: edit.explanation,
      });

      return {
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Design variant rendering failed: ${msg}` };
    }
  }

  /**
   * Get session history
   */
  getSessionHistory(sessionId: string): unknown[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    return session.getHistory();
  }

  /**
   * Get session metadata
   */
  getSessionMetadata(sessionId: string): unknown {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return session.getMetadata();
  }

  /**
   * Undo last edit in session
   */
  undoLastEdit(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const success = session.undo();

    if (success) {
      this.resetSessionTimeout(sessionId);
    }

    return success;
  }

  /**
   * Close a session
   */
  closeSession(sessionId: string): boolean {
    const timeout = this.sessionTimeout.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeout.delete(sessionId);
    }

    return this.sessions.delete(sessionId);
  }

  /**
   * Get service health
   */
  getHealth(): { status: string; activeSessions: number; uptime: number } {
    return {
      status: "ok",
      activeSessions: this.sessions.size,
      uptime: Date.now(),
    };
  }

  /**
   * Private: Reset session timeout
   */
  private resetSessionTimeout(sessionId: string): void {
    const existingTimeout = this.sessionTimeout.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.logger.info(`Session timeout, closing`, { sessionId });
      this.closeSession(sessionId);
    }, this.sessionTTLMs);

    this.sessionTimeout.set(sessionId, timeout);
  }

  /**
   * Private: Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

export {
  Logger,
  UnifiedRouter,
  ToolRouter,
  TokenUsage,
  ChatResponse,
};
