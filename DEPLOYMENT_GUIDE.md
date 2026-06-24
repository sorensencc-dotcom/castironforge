# Pre-Commit Agent Deployment Guide

Deploy the pre-commit agent to multiple repositories with the automated deployment script.

## Quick Start

```bash
# Clone the deployment script
cd /path/to/castironforge
cp scripts/deploy-precommit-agent.sh /tmp/

# Deploy to each repository
/tmp/deploy-precommit-agent.sh /path/to/rewrite-mcp
/tmp/deploy-precommit-agent.sh /path/to/cic-os
/tmp/deploy-precommit-agent.sh /path/to/CIC
# ... and so on for each repo
```

## Target Repositories

The pre-commit agent is designed to deploy to these 9 repositories:

1. ✅ `sorensencc-dotcom/castironforge` — **Already deployed**
2. 🔄 `sorensencc-dotcom/rewrite-mcp` — MCP infrastructure
3. 🔄 `sorensencc-dotcom/cic-os` — OS system
4. 🔄 `sorensencc-dotcom/CIC` — Core system
5. 🔄 `sorensencc-dotcom/charlie-deep-research` — Research project
6. 🔄 `sorensencc-dotcom/cic-ingestion` — Data ingestion
7. 🔄 `sorensencc-dotcom/castironcharlie` — Charlie integration
8. 🔄 `sorensencc-dotcom/rewritelabs.io` — Web project
9. 🔄 `sorensencc-dotcom/CIC-DAG` — DAG system
10. 🔄 `sorensencc-dotcom/claude-skills` — Skills framework

## Prerequisites

- Node.js 16+ installed
- Git repository with `package.json` (TypeScript/JavaScript project)
- Husky not already configured (or compatible setup)

## What Gets Installed

The deployment script will:

1. ✅ Install Husky for git hooks
2. ✅ Copy pre-commit agent scripts:
   - `scripts/shared-utils.js` — Common utilities
   - `scripts/code-review.js` — Code quality checks
   - `scripts/generate-docs.js` — Documentation generation
3. ✅ Install `.husky/pre-commit` hook
4. ✅ Update `package.json` with review scripts
5. ✅ Install TypeDoc if TypeScript project detected
6. ✅ Create `.husky/.gitignore`

## Manual Deployment (Alternative)

If you prefer manual setup:

### 1. Install Husky
```bash
npm install husky --save-dev
npx husky install
```

### 2. Copy Agent Scripts
```bash
cp /path/to/castironforge/scripts/shared-utils.js ./scripts/
cp /path/to/castironforge/scripts/code-review.js ./scripts/
cp /path/to/castironforge/scripts/generate-docs.js ./scripts/
chmod +x ./scripts/*.js
```

### 3. Create Pre-Commit Hook
```bash
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
echo ""
echo "🔍 Pre-commit checks running..."
echo ""
node scripts/code-review.js
if [ $? -ne 0 ]; then
  exit 1
fi
node scripts/generate-docs.js
echo "✅ Pre-commit checks passed - ready to commit!"
echo ""
EOF
chmod +x .husky/pre-commit
```

### 4. Update package.json
```json
{
  "scripts": {
    "review": "node scripts/code-review.js",
    "generate-docs": "node scripts/generate-docs.js"
  }
}
```

## Testing the Deployment

After deployment, test the hook:

```bash
cd /path/to/repo
git commit --allow-empty -m "test: verify pre-commit hook"
```

Expected output:
```
🔍 Pre-commit checks running...

📋 Code Review Agent

✅ No TypeScript/JavaScript files staged

📚 Documentation Generator Agent

✅ No TypeScript files staged

✅ Pre-commit checks passed - ready to commit!
```

## What It Checks

### Code Review Agent (Blocks on)
- ❌ TypeScript compilation errors
- ❌ Debugger statements
- ❌ Empty catch blocks

### Code Review Agent (Warns on)
- ⚠️ `console.log()` statements
- ⚠️ `any` types
- ⚠️ Missing JSDoc comments
- ⚠️ TODO/FIXME comments
- ⚠️ Files longer than 500 lines

### Documentation Generator (Auto-generates)
- ✓ TypeDoc API documentation
- ✓ Service README files
- ✓ Services index

## Customization

### Modify Code Review Rules

Edit `scripts/code-review.js`:
- `checkTypeScript()` — TypeScript compilation
- `checkCodeQuality()` — Code quality issues
- `checkDocumentation()` — JSDoc requirements

### Modify Documentation Generation

Edit `scripts/generate-docs.js`:
- `generateTypeDoc()` — API docs settings
- `generateReadme()` — README template
- `generateServiceIndex()` — Index generation

### Configure Shared Utilities

Edit `scripts/shared-utils.js`:
- `getStagedFiles()` — File filtering logic
- `findServiceRoot()` — Service detection
- `findTsConfig()` — TypeScript config location

## Troubleshooting

### Hook not running?
```bash
# Re-install husky
npx husky install
```

### Permission denied?
```bash
# Make scripts executable
chmod +x .husky/pre-commit
chmod +x scripts/*.js
```

### TypeScript check failing?
```bash
# Ensure TypeScript is installed
npm install typescript --save-dev
# Check configuration
ls -la tsconfig.json
```

### Git authentication issues?
```bash
# Verify git credentials
git config credential.helper
# Test connectivity
git fetch origin
```

## Deployment Checklist

For each repository:

- [ ] Clone/navigate to repo directory
- [ ] Run deployment script: `/tmp/deploy-precommit-agent.sh <repo-path>`
- [ ] Test hook: `git commit --allow-empty -m "test"`
- [ ] Review generated changes: `git status`
- [ ] Commit setup: `git add -A && git commit -m "Set up pre-commit agent"`
- [ ] Push changes: `git push`

## Notes

- The pre-commit agent skips non-TypeScript/JavaScript repositories automatically
- Documentation is auto-staged and included in commits
- Only serious issues (TypeScript errors, debugger statements) block commits
- Warnings are displayed but don't block the commit
- The hook runs on every commit automatically

## Support

For issues or customization needs:
1. Check the PRECOMMIT_AGENT.md documentation
2. Review the script source code in `scripts/`
3. Run `npm run review` manually to test independently
