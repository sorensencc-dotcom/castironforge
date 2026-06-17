/**
 * Design Variant Renderer
 * filename: DesignVariantRenderer.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Renders design system variations by applying design tokens to DOM elements.
 * Supports theme variants, responsive scales, and dynamic token composition.
 */

interface Logger {
  info(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  debug(msg: string, meta?: unknown): void;
}

interface DesignToken {
  name: string;
  property: string;
  value: string | number;
  targets?: string[];
}

interface DesignVariantRequest {
  selector: string;
  component?: string;
  tokens: DesignToken[];
  theme?: string;
  globalTokens?: Record<string, unknown>;
  explanation?: string;
}

/**
 * Applies design tokens and renders design variations
 */
export class DesignVariantRenderer {
  constructor(private logger: Logger, private domProvider?: () => Document) {}

  /**
   * Apply a design variant by rendering tokens to elements
   */
  async renderVariant(request: DesignVariantRequest): Promise<{
    success: boolean;
    message: string;
    elementsModified: number;
  }> {
    const { selector, tokens, theme, globalTokens, explanation } = request;

    this.logger.info(`Rendering design variant`, {
      selector,
      tokenCount: tokens.length,
      theme,
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

      // Apply tokens to each element
      for (const element of elements) {
        for (const token of tokens) {
          try {
            this.applyToken(element as any, token);
            totalModified++;
          } catch (error) {
            this.logger.error(`Failed to apply token`, {
              selector,
              token: token.name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      this.logger.info(`Design variant rendered`, {
        selector,
        elementsModified: elements.length,
        tokensApplied: totalModified,
      });

      return {
        success: true,
        message: `Applied ${totalModified} design tokens to ${elements.length} elements`,
        elementsModified: elements.length,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Design variant rendering failed`, { selector, error: msg });

      return {
        success: false,
        message: `Failed to render design variant: ${msg}`,
        elementsModified: 0,
      };
    }
  }

  /**
   * Apply a single design token to an element
   */
  private applyToken(element: Element, token: DesignToken): void {
    const { property, value, targets } = token;

    // Apply to base element
    this.setProperty(element, property, value);

    // Apply to pseudo-element targets if specified
    if (targets && targets.length > 0) {
      for (const target of targets) {
        this.setPropertyWithPseudo(element, target, property, value);
      }
    }
  }

  /**
   * Set a CSS property on an element
   */
  private setProperty(element: Element, property: string, value: string | number): void {
    const element_any = element as any;

    // Handle CSS custom properties (--var-name)
    if (property.startsWith("--")) {
      element_any.style.setProperty(property, String(value));
    } else {
      // Camel-case CSS property names
      const camelProperty = this.kebabToCamel(property);
      element_any.style[camelProperty] = String(value);
    }
  }

  /**
   * Set a CSS property on a pseudo-element target
   * Note: Direct pseudo-element style setting requires CSS injection or classList manipulation
   */
  private setPropertyWithPseudo(
    element: Element,
    target: string,
    property: string,
    value: string | number
  ): void {
    const element_any = element as any;

    // For pseudo-elements like :hover, :focus, use data attributes and CSS rules
    if (target.startsWith(":")) {
      // Store token value in data attribute for potential CSS rule injection
      const dataAttr = `data-token-${this.kebabToCamel(target.substring(1))}`;
      element_any.setAttribute(dataAttr, String(value));
    } else if (target.startsWith("::")) {
      // For ::before, ::after, store in data attribute
      const pseudoName = target.substring(2);
      const dataAttr = `data-pseudo-${pseudoName}`;
      element_any.setAttribute(dataAttr, String(value));
    }
  }

  /**
   * Convert kebab-case to camelCase
   */
  private kebabToCamel(str: string): string {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  /**
   * Get computed style for an element
   */
  getComputedStyle(selector: string, property: string): Record<string, string> {
    try {
      const document = this.domProvider?.() || (globalThis as any).document;

      if (!document) {
        throw new Error("DOM not available");
      }

      const elements = Array.from(document.querySelectorAll(selector));
      const styles: Record<string, string> = {};

      for (const element of elements) {
        const computed = window.getComputedStyle(element as Element);
        const camelProperty = this.kebabToCamel(property);
        styles[element.className] = computed.getPropertyValue(property) || computed[camelProperty as any];
      }

      return styles;
    } catch (error) {
      this.logger.error(`Failed to get computed style`, {
        selector,
        property,
        error: error instanceof Error ? error.message : String(error),
      });

      return {};
    }
  }
}

export { Logger, DesignToken, DesignVariantRequest };
