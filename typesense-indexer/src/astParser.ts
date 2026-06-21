import { parse } from "@babel/parser";

export type ParsedCode = {
  language: string;
  symbols: string[];
  functions: string[];
  classes: string[];
  imports: string[];
  exports: string[];
};

export const parseCode = (path: string, content: string): ParsedCode => {
  const ext = path.split(".").pop() ?? "";
  const language = ext === "ts" || ext === "tsx" ? "ts" : ext;

  if (["ts", "tsx", "js", "jsx"].includes(ext)) {
    try {
      parse(content, {
        sourceType: "module",
        plugins: ["typescript", "jsx"]
      });
    } catch {
      // Parse error; fall through to regex extraction
    }

    const symbols: string[] = [];
    const functions: string[] = [];
    const classes: string[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    const importRegex = /from\s+["']([^"']+)["']/g;
    let m;
    while ((m = importRegex.exec(content)) !== null) {
      if (!imports.includes(m[1])) imports.push(m[1]);
    }

    const exportRegex = /export\s+(?:default\s+)?(class|function|const|let|var)\s+([A-Za-z0-9_$]+)/g;
    while ((m = exportRegex.exec(content)) !== null) {
      if (!exports.includes(m[2])) exports.push(m[2]);
    }

    const funcRegex = /(?:function|const|let|var)\s+([A-Za-z0-9_$]+)\s*(?:=\s*)?(?:\(|async\s|function)/g;
    while ((m = funcRegex.exec(content)) !== null) {
      if (!functions.includes(m[1])) {
        functions.push(m[1]);
        symbols.push(m[1]);
      }
    }

    const classRegex = /class\s+([A-Za-z0-9_$]+)/g;
    while ((m = classRegex.exec(content)) !== null) {
      if (!classes.includes(m[1])) {
        classes.push(m[1]);
        symbols.push(m[1]);
      }
    }

    const interfaceRegex = /interface\s+([A-Za-z0-9_$]+)/g;
    while ((m = interfaceRegex.exec(content)) !== null) {
      if (!symbols.includes(m[1])) symbols.push(m[1]);
    }

    const typeRegex = /type\s+([A-Za-z0-9_$]+)/g;
    while ((m = typeRegex.exec(content)) !== null) {
      if (!symbols.includes(m[1])) symbols.push(m[1]);
    }

    return { language, symbols, functions, classes, imports, exports };
  }

  return {
    language,
    symbols: [],
    functions: [],
    classes: [],
    imports: [],
    exports: []
  };
};
