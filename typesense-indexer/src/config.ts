export const CONFIG = {
  typesense: {
    host: process.env.TYPESENSE_HOST ?? "localhost",
    port: parseInt(process.env.TYPESENSE_PORT ?? "8108", 10),
    protocol: process.env.TYPESENSE_PROTOCOL ?? "http",
    apiKey: process.env.TYPESENSE_API_KEY ?? "dev-key"
  },
  repos: [
    { name: "castironforge", root: process.env.REPO_ROOT ?? "/home/user/castironforge" }
  ],
  includeExtensions: [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".html",
    ".css",
    ".yaml",
    ".yml",
    ".sh",
    ".bash"
  ],
  excludeDirs: ["node_modules", ".git", "dist", "build", ".next", "archive", ".claude"]
};
