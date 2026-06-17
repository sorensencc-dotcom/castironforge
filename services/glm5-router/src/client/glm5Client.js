/**
 * filename: glm5Client.js
 * semver: 0.1.0
 * date: 2026-06-17
 *
 * Deterministic GLM-5 Client for CIC / TorqueQuery / Chat Engine / Rewrite Labs.
 * - ESM only
 * - Node 20+
 * - Explicit .js imports
 * - Structured JSON logs
 * - Boundary validation
 */

import crypto from "node:crypto";
import assert from "node:assert";

export class GLM5Client {
  constructor({ apiKey, baseUrl, logger }) {
    assert(apiKey, "GLM-5 API key required");
    assert(baseUrl, "GLM-5 base URL required");
    assert(logger, "Logger instance required");

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.logger = logger;
  }

  /**
   * Deterministic call wrapper for GLM-5.1, 5.2, or base (744B).
   *
   * @param {string} model - Model variant: "glm-5.1", "glm-5.2", "glm-5"
   * @param {string} prompt - User prompt
   * @param {object} opts - Call options
   * @param {string} [opts.reasoning_effort="max"] - "max", "high", "low"
   * @param {boolean} [opts.enable_thinking=false] - Enable internal reasoning
   * @param {number} [opts.temperature=0] - Temperature (0-2)
   * @param {number} [opts.top_p=1] - Top-p sampling (0-1)
   * @param {number} [opts.max_tokens=4096] - Max output tokens
   * @returns {Promise<string>} Response content
   */
  async call(model, prompt, opts = {}) {
    const {
      reasoning_effort = "max",
      enable_thinking = false,
      temperature = 0,
      top_p = 1,
      max_tokens = 4096,
    } = opts;

    const payload = {
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature,
      top_p,
      max_tokens,
      glm_thinking: {
        reasoning_effort,
        enable_thinking,
      },
    };

    const requestId = crypto.randomUUID();
    const start = performance.now();

    this.logger.info({
      msg: "GLM-5 request",
      requestId,
      model,
      reasoning_effort,
      enable_thinking,
      temperature,
      top_p,
      max_tokens,
    });

    let res;
    try {
      res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      this.logger.error({
        msg: "GLM-5 fetch error",
        requestId,
        error: err.message,
      });
      throw err;
    }

    const latency = performance.now() - start;

    if (!res.ok) {
      let text;
      try {
        text = await res.text();
      } catch (err) {
        text = "(could not read response body)";
      }

      this.logger.error({
        msg: "GLM-5 error",
        requestId,
        status: res.status,
        statusText: res.statusText,
        body: text,
      });
      throw new Error(`GLM-5 error: ${res.status} ${text}`);
    }

    let json;
    try {
      json = await res.json();
    } catch (err) {
      this.logger.error({
        msg: "GLM-5 response parse error",
        requestId,
        error: err.message,
      });
      throw err;
    }

    this.logger.info({
      msg: "GLM-5 response",
      requestId,
      latency,
      usage: json?.usage,
    });

    const content = json?.choices?.[0]?.message?.content;

    if (!content) {
      this.logger.error({
        msg: "GLM-5 empty content",
        requestId,
        json,
      });
      throw new Error("GLM-5 returned empty content");
    }

    return content;
  }

  /**
   * JSON-only helper. Enforces strict JSON output.
   *
   * @param {string} model - Model variant
   * @param {string} prompt - User prompt (will be wrapped)
   * @param {object} opts - Call options
   * @returns {Promise<object>} Parsed JSON response
   */
  async callJSON(model, prompt, opts = {}) {
    const wrapped = `Respond with STRICT JSON ONLY.
No prose. No explanation. No markdown.

${prompt}`;

    const out = await this.call(model, wrapped, opts);

    try {
      return JSON.parse(out);
    } catch (err) {
      this.logger.error({
        msg: "GLM-5 JSON parse error",
        output: out,
        error: err.message,
      });
      throw new Error("Invalid JSON from GLM-5");
    }
  }

  /**
   * Fallback call: if primary model fails, retry with fallback.
   *
   * @param {string} primaryModel - Primary model ("glm-5.2")
   * @param {string} fallbackModel - Fallback model ("glm-5.1")
   * @param {string} prompt - Prompt
   * @param {object} opts - Call options
   * @returns {Promise<string>} Response content
   */
  async callWithFallback(primaryModel, fallbackModel, prompt, opts = {}) {
    try {
      return await this.call(primaryModel, prompt, opts);
    } catch (err) {
      this.logger.info({
        msg: "Primary model failed, trying fallback",
        primary: primaryModel,
        fallback: fallbackModel,
        error: err.message,
      });

      // Shrink context for fallback
      const shrunkPrompt = prompt.substring(0, Math.floor(prompt.length * 0.7));

      return await this.call(fallbackModel, shrunkPrompt, {
        ...opts,
        reasoning_effort: "high",
      });
    }
  }
}
