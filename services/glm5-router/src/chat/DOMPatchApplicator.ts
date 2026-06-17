/**
 * DOM Patch Applicator
 * filename: DOMPatchApplicator.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Applies DOM patches from GLM-5 to the DOM tree.
 * Supports style changes, class operations, and text content updates.
 */

interface Logger {
  info(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  debug(msg: string, meta?: unknown): void;
}

interface DOMPatch {
  path: string;
  value: unknown;
}

interface DOMEditRequest {
  selector: string;
  component?: string;
  patches: DOMPatch[];
  explanation?: string;
}

/**
 * Applies deterministic DOM patches
 */
export class DOMPatchApplicator {
  constructor(private logger: Logger, private domProvider?: () => Document) {}

  /**
   * Apply a batch of DOM patches
   */
  async applyPatches(request: DOMEditRequest): Promise<{
    success: boolean;
    message: string;
    elementsModified: number;
  }> {
    const { selector, patches, explanation } = request;

    this.logger.info(`Applying DOM patches`, {
      selector,
      patchCount: patches.length,
      explanation,
    });

    try {
      const document = this.domProvider?.() || (globalThis as any).document;

      if (!document) {
        throw new Error("DOM not available");
      }

      // Find target element(s)
      const elements = Array.from(document.querySelectorAll(selector));

      if (elements.length === 0) {
        this.logger.error(`No elements found for selector`, { selector });
        return {
          success: false,
          message: `No elements found for selector: ${selector}`,
          elementsModified: 0,
        };
      }

      let totalModified = 0;

      // Apply patches to each element
      for (const element of elements) {
        for (const patch of patches) {
          try {
            this.applyPatch(element as any, patch);
            totalModified++;
          } catch (error) {
            this.logger.error(`Failed to apply patch`, {
              selector,
              patch: patch.path,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      this.logger.info(`DOM patches applied`, {
        selector,
        elementsModified: elements.length,
        patchesApplied: totalModified,
      });

      return {
        success: true,
        message: `Applied ${totalModified} patches to ${elements.length} elements`,
        elementsModified: elements.length,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Patch application failed`, { selector, error: msg });

      return {
        success: false,
        message: `Failed to apply patches: ${msg}`,
        elementsModified: 0,
      };
    }
  }

  /**
   * Apply a single patch to an element
   */
  private applyPatch(element: Element, patch: DOMPatch): void {
    const { path, value } = patch;

    if (path.startsWith("style.")) {
      // Style property
      const property = path.substring(6);
      (element as any).style[property] = value;
    } else if (path.startsWith("classList.")) {
      // Class operation
      const [, operation, className] = path.match(/classList\.(add|remove|toggle)/) || [];

      if (!operation || !className) {
        throw new Error(`Invalid classList path: ${path}`);
      }

      if (operation === "add") {
        element.classList.add(value as string);
      } else if (operation === "remove") {
        element.classList.remove(value as string);
      } else if (operation === "toggle") {
        element.classList.toggle(value as string);
      }
    } else if (path === "textContent") {
      // Text content
      element.textContent = String(value);
    } else if (path === "innerHTML") {
      // HTML content (use with caution)
      (element as any).innerHTML = String(value);
    } else if (path.startsWith("attribute.")) {
      // HTML attribute
      const attrName = path.substring(10);
      element.setAttribute(attrName, String(value));
    } else {
      throw new Error(`Unknown patch path: ${path}`);
    }
  }
}

export { Logger, DOMPatch, DOMEditRequest };
