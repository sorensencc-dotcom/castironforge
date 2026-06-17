/**
 * Phase 3 Integration Tests
 * filename: integration.spec.ts
 * date: 2026-06-17
 *
 * Comprehensive integration tests for Chat Engine components.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ChatEditSession } from "../ChatEditSession.js";
import { DOMPatchApplicator } from "../DOMPatchApplicator.js";
import { CodeEditApplicator } from "../CodeEditApplicator.js";
import { DesignVariantRenderer } from "../DesignVariantRenderer.js";

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe("Phase 3: Chat Engine Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("DOMPatchApplicator", () => {
    let applicator: DOMPatchApplicator;
    let mockDocument: Document;

    beforeEach(() => {
      applicator = new DOMPatchApplicator(mockLogger);
      mockDocument = {
        querySelectorAll: jest.fn((selector: string) => {
          const element = {
            className: "test-class",
            classList: {
              add: jest.fn(),
              remove: jest.fn(),
              toggle: jest.fn(),
            },
            setAttribute: jest.fn(),
            textContent: "",
            innerHTML: "",
            style: {},
          };
          return [element] as any;
        }),
      } as any;
    });

    it("should apply style patches to elements", async () => {
      const result = await applicator.applyPatches({
        selector: ".button",
        patches: [
          { path: "style.backgroundColor", value: "red" },
          { path: "style.padding", value: "10px" },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.elementsModified).toBe(1);
    });

    it("should apply class operations", async () => {
      const result = await applicator.applyPatches({
        selector: ".button",
        patches: [
          { path: "classList.add", value: "active" },
          { path: "classList.remove", value: "disabled" },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("applied");
    });

    it("should apply text content updates", async () => {
      const result = await applicator.applyPatches({
        selector: ".label",
        patches: [{ path: "textContent", value: "New Label" }],
      });

      expect(result.success).toBe(true);
    });

    it("should return error when selector matches no elements", async () => {
      applicator = new DOMPatchApplicator(mockLogger, () => ({
        querySelectorAll: () => [],
      } as any));

      const result = await applicator.applyPatches({
        selector: ".nonexistent",
        patches: [{ path: "style.color", value: "blue" }],
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("No elements found");
    });
  });

  describe("CodeEditApplicator", () => {
    let applicator: CodeEditApplicator;

    beforeEach(() => {
      const mockFileProvider = jest.fn((path: string) => {
        return Promise.resolve(
          `line 1
line 2
line 3
line 4
line 5`
        );
      });
      applicator = new CodeEditApplicator(mockLogger, mockFileProvider);
    });

    it("should parse and apply unified diff", async () => {
      const diff = `--- a/test.ts
+++ b/test.ts
@@ -1,5 +1,5 @@
 line 1
-line 2
+line 2 modified
 line 3
 line 4
 line 5`;

      const result = await applicator.applyEdit({
        file: "test.ts",
        diff,
      });

      expect(result.success).toBe(true);
      expect(result.linesModified).toBeGreaterThan(0);
    });

    it("should handle multiple hunks", async () => {
      const diff = `--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,4 @@
 line 1
+inserted line
 line 2
 line 3
@@ -4,2 +5,2 @@
 line 4
-line 5
+line 5 modified`;

      const result = await applicator.applyEdit({
        file: "test.ts",
        diff,
      });

      expect(result.success).toBe(true);
    });

    it("should validate context lines", async () => {
      const diff = `--- a/test.ts
+++ b/test.ts
@@ -1,5 +1,5 @@
 line 1
-wrong context
+line 2 modified
 line 3
 line 4
 line 5`;

      const result = await applicator.applyEdit({
        file: "test.ts",
        diff,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("mismatch");
    });

    it("should return error when file not found", async () => {
      const fileProvider = jest.fn(() => Promise.reject(new Error("File not found")));
      const app = new CodeEditApplicator(mockLogger, fileProvider);

      const result = await app.applyEdit({
        file: "nonexistent.ts",
        diff: `--- a/nonexistent.ts
+++ b/nonexistent.ts
@@ -1 +1 @@
-old
+new`,
      });

      expect(result.success).toBe(false);
    });
  });

  describe("DesignVariantRenderer", () => {
    let renderer: DesignVariantRenderer;
    let mockDocument: Document;

    beforeEach(() => {
      renderer = new DesignVariantRenderer(mockLogger);
      mockDocument = {
        querySelectorAll: jest.fn((selector: string) => {
          const element = {
            className: "component",
            style: {},
            setAttribute: jest.fn(),
          };
          return [element] as any;
        }),
      } as any;
    });

    it("should apply design tokens to elements", async () => {
      const result = await renderer.renderVariant({
        selector: ".card",
        tokens: [
          { name: "bg-color", property: "background-color", value: "#ffffff" },
          { name: "padding", property: "padding", value: "16px" },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.elementsModified).toBe(1);
    });

    it("should apply CSS custom properties", async () => {
      const result = await renderer.renderVariant({
        selector: ".themed",
        tokens: [
          { name: "primary", property: "--color-primary", value: "#0066cc" },
          { name: "secondary", property: "--color-secondary", value: "#ff6600" },
        ],
      });

      expect(result.success).toBe(true);
    });

    it("should handle theme variants", async () => {
      const result = await renderer.renderVariant({
        selector: ".button",
        theme: "dark",
        tokens: [
          {
            name: "bg-dark",
            property: "background-color",
            value: "#1a1a1a",
          },
        ],
      });

      expect(result.success).toBe(true);
    });

    it("should return error when selector matches no elements", async () => {
      renderer = new DesignVariantRenderer(mockLogger, () => ({
        querySelectorAll: () => [],
      } as any));

      const result = await renderer.renderVariant({
        selector: ".nonexistent",
        tokens: [{ name: "color", property: "color", value: "red" }],
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("No elements found");
    });
  });

  describe("ChatEditSession", () => {
    let session: ChatEditSession;

    beforeEach(() => {
      const mockRouter = {
        classify: jest.fn(async () => ({ task_type: "dom_edit", scope: "local" })),
        route: jest.fn(() => ({
          model: "glm-5.1",
          reasoning_effort: "high",
          enable_thinking: false,
        })),
        assembleContext: jest.fn(() => ({
          mode: "chat",
          user_intent: "test",
          dom_snapshot: {},
          active_file: null,
          cic_context: null,
        })),
        execute: jest.fn(async () => ({
          action: "dom_edit",
          target: { selector: ".test" },
          patches: [],
        })),
      } as any;

      const mockToolRouter = {} as any;

      session = new ChatEditSession(mockRouter, mockToolRouter, mockLogger);
    });

    it("should process messages through the full pipeline", async () => {
      const envelope = {
        user_message: "Change the button color",
        mode: "chat" as any,
        session_id: "test-session",
      } as any;

      const result = await session.processMessage(envelope);

      expect(result).toBeDefined();
      expect((result as any).action).toBe("dom_edit");
    });

    it("should maintain turn history", async () => {
      const envelope = {
        user_message: "First message",
        mode: "chat" as any,
      } as any;

      await session.processMessage(envelope);

      const history = session.getHistory();
      expect(history.length).toBe(1);
      expect((history[0] as any).userMessage).toBe("First message");
    });

    it("should validate edit protocol responses", async () => {
      const mockRouter = {
        classify: jest.fn(async () => ({ task_type: "answer" })),
        route: jest.fn(() => ({
          model: "glm-5.1",
          reasoning_effort: "high",
          enable_thinking: false,
        })),
        assembleContext: jest.fn(() => ({
          mode: "chat",
          user_intent: "test",
        })),
        execute: jest.fn(async () => ({ action: "invalid_action" })),
      } as any;

      const mockToolRouter = {} as any;

      session = new ChatEditSession(mockRouter, mockToolRouter, mockLogger);

      const envelope = {
        user_message: "Test",
        mode: "chat" as any,
      } as any;

      try {
        await session.processMessage(envelope);
        expect(false).toBe(true); // Should throw
      } catch (error) {
        expect((error as Error).message).toContain("invalid edit protocol");
      }
    });

    it("should support undo operations", async () => {
      const envelope = {
        user_message: "Make a change",
        mode: "chat" as any,
      } as any;

      await session.processMessage(envelope);

      let history = session.getHistory();
      expect(history.length).toBe(1);

      const undoResult = session.undo();
      expect(undoResult).toBe(true);

      history = session.getHistory();
      expect(history.length).toBe(0);
    });

    it("should provide session metadata", () => {
      const metadata = session.getMetadata();

      expect(metadata.sessionId).toBeDefined();
      expect(metadata.mode).toBe("chat");
      expect(metadata.turnCount).toBe(0);
    });
  });

  describe("End-to-End: Message to Edit Application", () => {
    it("should process a complete chat flow", async () => {
      const mockRouter = {
        classify: jest.fn(async () => ({ task_type: "dom_edit", scope: "local" })),
        route: jest.fn(() => ({
          model: "glm-5.1",
          reasoning_effort: "high",
          enable_thinking: false,
        })),
        assembleContext: jest.fn(() => ({
          mode: "chat",
          user_intent: "highlight the button",
        })),
        execute: jest.fn(async () => ({
          action: "dom_edit",
          target: { selector: "button.primary" },
          patches: [
            { path: "classList.add", value: "highlighted" },
            { path: "style.boxShadow", value: "0 0 10px rgba(0,0,0,0.3)" },
          ],
        })),
      } as any;

      const mockToolRouter = {} as any;

      const session = new ChatEditSession(mockRouter, mockToolRouter, mockLogger);

      const envelope = {
        user_message: "Highlight the primary button",
        mode: "chat" as any,
        dom_snapshot: {},
      } as any;

      const editProtocol = await session.processMessage(envelope);

      expect(editProtocol).toBeDefined();
      expect((editProtocol as any).action).toBe("dom_edit");

      const metadata = session.getMetadata();
      expect(metadata.turnCount).toBe(1);
    });
  });
});
