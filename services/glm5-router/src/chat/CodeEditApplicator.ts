/**
 * Code Edit Applicator
 * filename: CodeEditApplicator.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Applies unified diff patches to source files.
 * Parses unified diff format and applies changes with validation.
 */

interface Logger {
  info(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  debug(msg: string, meta?: unknown): void;
}

interface CodeEditRequest {
  file: string;
  diff: string;
  explanation?: string;
}

interface HunkHeader {
  fromStart: number;
  fromCount: number;
  toStart: number;
  toCount: number;
}

interface FilePatch {
  file: string;
  hunks: Array<{
    header: HunkHeader;
    lines: string[];
  }>;
}

/**
 * Parses and validates unified diff format
 */
export class DiffParser {
  static parse(diff: string): FilePatch {
    const lines = diff.split("\n");
    const filePatch: FilePatch = {
      file: "",
      hunks: [],
    };

    let i = 0;

    // Parse file headers
    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith("--- a/")) {
        filePatch.file = line.substring(6);
        i++;
        break;
      }

      i++;
    }

    // Parse hunks
    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith("@@")) {
        // Parse hunk header
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);

        if (!match) {
          throw new Error(`Invalid hunk header: ${line}`);
        }

        const header: HunkHeader = {
          fromStart: parseInt(match[1]),
          fromCount: parseInt(match[2] || "1"),
          toStart: parseInt(match[3]),
          toCount: parseInt(match[4] || "1"),
        };

        const hunkLines: string[] = [];
        i++;

        // Parse hunk content
        while (i < lines.length) {
          const hunkLine = lines[i];

          if (hunkLine.startsWith("@@")) {
            break;
          }

          if (
            hunkLine.startsWith(" ") ||
            hunkLine.startsWith("+") ||
            hunkLine.startsWith("-")
          ) {
            hunkLines.push(hunkLine);
            i++;
          } else if (hunkLine.startsWith("\\")) {
            // "\ No newline at end of file" marker
            i++;
          } else {
            break;
          }
        }

        filePatch.hunks.push({ header, lines: hunkLines });
      } else {
        i++;
      }
    }

    return filePatch;
  }
}

/**
 * Applies unified diffs to source files
 */
export class CodeEditApplicator {
  constructor(private logger: Logger, private fileProvider?: (path: string) => Promise<string>) {}

  /**
   * Apply a code edit request
   */
  async applyEdit(request: CodeEditRequest): Promise<{
    success: boolean;
    message: string;
    linesModified: number;
  }> {
    const { file, diff, explanation } = request;

    this.logger.info(`Applying code edit`, {
      file,
      diffLength: diff.length,
      explanation,
    });

    try {
      // Parse the diff
      const filePatch = DiffParser.parse(diff);

      if (filePatch.file !== file) {
        this.logger.error(`File mismatch in diff`, {
          expectedFile: file,
          diffFile: filePatch.file,
        });

        return {
          success: false,
          message: `File mismatch: expected ${file}, got ${filePatch.file}`,
          linesModified: 0,
        };
      }

      // Read the original file
      if (!this.fileProvider) {
        throw new Error("File provider not available");
      }

      const originalContent = await this.fileProvider(file);
      const originalLines = originalContent.split("\n");

      // Apply hunks
      let modifiedLines = [...originalLines];
      let totalLinesModified = 0;

      for (const hunk of filePatch.hunks) {
        const result = this.applyHunk(modifiedLines, hunk);

        if (!result.success) {
          this.logger.error(`Hunk application failed`, {
            file,
            hunk: hunk.header,
            error: result.message,
          });

          return {
            success: false,
            message: `Hunk application failed: ${result.message}`,
            linesModified: totalLinesModified,
          };
        }

        modifiedLines = result.lines;
        totalLinesModified += result.linesModified;
      }

      this.logger.info(`Code edit applied`, {
        file,
        linesModified: totalLinesModified,
      });

      return {
        success: true,
        message: `Applied ${totalLinesModified} line changes to ${file}`,
        linesModified: totalLinesModified,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Code edit failed`, { file, error: msg });

      return {
        success: false,
        message: `Failed to apply code edit: ${msg}`,
        linesModified: 0,
      };
    }
  }

  /**
   * Apply a single hunk
   */
  private applyHunk(
    lines: string[],
    hunk: {
      header: HunkHeader;
      lines: string[];
    }
  ): {
    success: boolean;
    message?: string;
    lines: string[];
    linesModified: number;
  } {
    const { header, lines: hunkLines } = hunk;
    const result = [...lines];
    let fromIndex = header.fromStart - 1;
    let toIndex = header.toStart - 1;
    let linesModified = 0;

    for (const line of hunkLines) {
      if (line.startsWith(" ")) {
        // Context line (unchanged)
        if (fromIndex >= result.length) {
          return {
            success: false,
            message: `File mismatch at line ${fromIndex + 1}`,
            lines: result,
            linesModified,
          };
        }

        fromIndex++;
        toIndex++;
      } else if (line.startsWith("-")) {
        // Removed line
        if (fromIndex >= result.length) {
          return {
            success: false,
            message: `Cannot remove line ${fromIndex + 1}: past end of file`,
            lines: result,
            linesModified,
          };
        }

        result.splice(toIndex, 1);
        fromIndex++;
        linesModified++;
      } else if (line.startsWith("+")) {
        // Added line
        const content = line.substring(1);
        result.splice(toIndex, 0, content);
        toIndex++;
        linesModified++;
      }
    }

    return {
      success: true,
      lines: result,
      linesModified,
    };
  }
}

export { Logger, CodeEditRequest, FilePatch, DiffParser };
