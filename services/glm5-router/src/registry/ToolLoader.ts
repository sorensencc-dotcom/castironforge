/**
 * Tool Loader
 * filename: ToolLoader.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Discovers and loads tool descriptors from multiple sources:
 * - Static JSON/YAML files
 * - ESM modules
 * - MCP tool manifests
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, extname } from "node:path";
import { ToolDescriptor, IToolLoader } from "./types.js";

interface Logger {
  info(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  debug(msg: string, meta?: unknown): void;
}

/**
 * Tool loader configuration
 */
export interface ToolLoaderConfig {
  staticDir?: string; // Directory with JSON/YAML files (e.g., tools/)
  moduleDir?: string; // Directory with ESM modules
  mcpManifest?: string; // Path to MCP manifest file
  logger: Logger;
}

/**
 * Loads tool descriptors from multiple sources
 */
export class ToolLoader implements IToolLoader {
  private config: ToolLoaderConfig;

  constructor(config: ToolLoaderConfig) {
    this.config = config;
  }

  /**
   * Load all tools from configured sources
   */
  async load(): Promise<ToolDescriptor[]> {
    const tools: ToolDescriptor[] = [];

    // Load static descriptors
    if (this.config.staticDir) {
      const staticTools = await this.loadStaticDescriptors(this.config.staticDir);
      tools.push(...staticTools);
    }

    // Load ESM modules
    if (this.config.moduleDir) {
      const moduleTools = await this.loadESMModules(this.config.moduleDir);
      tools.push(...moduleTools);
    }

    // Load MCP manifests
    if (this.config.mcpManifest) {
      const mcpTools = await this.loadMCPManifest(this.config.mcpManifest);
      tools.push(...mcpTools);
    }

    this.config.logger.info(`Loaded tools from all sources`, {
      totalTools: tools.length,
    });

    return tools;
  }

  /**
   * Load tool descriptors from static JSON/YAML files
   */
  private async loadStaticDescriptors(dir: string): Promise<ToolDescriptor[]> {
    const tools: ToolDescriptor[] = [];

    try {
      const files = readdirSync(dir);

      for (const file of files) {
        const ext = extname(file);

        if (ext !== ".json" && ext !== ".yaml" && ext !== ".yml") {
          continue;
        }

        const path = resolve(dir, file);

        try {
          const content = readFileSync(path, "utf-8");
          let data;

          if (ext === ".json") {
            data = JSON.parse(content);
          } else {
            // TODO: Parse YAML (requires yaml library)
            // For now, skip YAML files
            this.config.logger.debug(`Skipping YAML file (requires yaml library)`, {
              file,
            });
            continue;
          }

          // Handle both single descriptor and array of descriptors
          const descriptors = Array.isArray(data) ? data : [data];

          for (const descriptor of descriptors) {
            if (this.isValidDescriptor(descriptor)) {
              tools.push(descriptor);
              this.config.logger.debug(`Loaded static tool descriptor`, {
                id: descriptor.id,
                source: file,
              });
            }
          }
        } catch (error) {
          this.config.logger.error(`Failed to load static descriptor`, {
            file,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      this.config.logger.error(`Failed to read static tools directory`, {
        dir,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return tools;
  }

  /**
   * Load tool descriptors from ESM modules
   */
  private async loadESMModules(dir: string): Promise<ToolDescriptor[]> {
    const tools: ToolDescriptor[] = [];

    try {
      const files = readdirSync(dir);

      for (const file of files) {
        if (!file.endsWith(".ts") && !file.endsWith(".js")) {
          continue;
        }

        // Skip test files
        if (file.includes(".test.") || file.includes(".spec.")) {
          continue;
        }

        const path = resolve(dir, file);

        try {
          // Dynamic import of ESM module
          const module = await import(path);

          // Look for exported ToolDescriptor or array of descriptors
          let descriptors: ToolDescriptor[] = [];

          if (module.default && this.isValidDescriptor(module.default)) {
            descriptors.push(module.default);
          } else if (module.tools && Array.isArray(module.tools)) {
            descriptors = module.tools.filter(this.isValidDescriptor);
          } else if (module.descriptor && this.isValidDescriptor(module.descriptor)) {
            descriptors.push(module.descriptor);
          }

          for (const descriptor of descriptors) {
            tools.push(descriptor);
            this.config.logger.debug(`Loaded ESM tool descriptor`, {
              id: descriptor.id,
              source: file,
            });
          }
        } catch (error) {
          this.config.logger.error(`Failed to load ESM module`, {
            file,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      this.config.logger.error(`Failed to read ESM modules directory`, {
        dir,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return tools;
  }

  /**
   * Load tool descriptors from MCP manifest
   */
  private async loadMCPManifest(manifestPath: string): Promise<ToolDescriptor[]> {
    const tools: ToolDescriptor[] = [];

    try {
      const content = readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(content);

      // MCP manifest structure: { mcpServers: { [name]: { tools: [...] } } }
      if (manifest.mcpServers) {
        for (const [serverName, serverConfig] of Object.entries(manifest.mcpServers)) {
          const config = serverConfig as Record<string, unknown>;

          if (Array.isArray(config.tools)) {
            for (const tool of config.tools) {
              const descriptor = this.convertMCPToolToDescriptor(
                tool as Record<string, unknown>,
                serverName
              );

              if (descriptor && this.isValidDescriptor(descriptor)) {
                tools.push(descriptor);
                this.config.logger.debug(`Loaded MCP tool descriptor`, {
                  id: descriptor.id,
                  server: serverName,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      this.config.logger.error(`Failed to load MCP manifest`, {
        manifestPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return tools;
  }

  /**
   * Convert MCP tool definition to ToolDescriptor
   */
  private convertMCPToolToDescriptor(
    mcpTool: Record<string, unknown>,
    serverName: string
  ): ToolDescriptor | null {
    const name = mcpTool.name as string;
    const description = mcpTool.description as string;
    const inputSchema = mcpTool.inputSchema as Record<string, unknown>;

    if (!name || !description) {
      return null;
    }

    return {
      id: `mcp_${serverName}_${name}`,
      group: "system",
      name: `${serverName}/${name}`,
      description,
      version: "0.1.0",
      endpointType: "mcp",
      endpoint: serverName,
      inputSchema: inputSchema || {},
      outputSchema: { type: "object" },
      capabilities: ["read"], // Default MCP tools are read-only
      tags: ["mcp", serverName],
    };
  }

  /**
   * Check if an object looks like a valid ToolDescriptor
   */
  private isValidDescriptor(obj: unknown): obj is ToolDescriptor {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    const desc = obj as Record<string, unknown>;

    // Check required fields
    return (
      typeof desc.id === "string" &&
      typeof desc.group === "string" &&
      typeof desc.name === "string" &&
      typeof desc.description === "string" &&
      typeof desc.version === "string" &&
      typeof desc.endpointType === "string" &&
      typeof desc.endpoint === "string" &&
      typeof desc.inputSchema === "object" &&
      typeof desc.outputSchema === "object" &&
      Array.isArray(desc.capabilities)
    );
  }
}

export { IToolLoader };
