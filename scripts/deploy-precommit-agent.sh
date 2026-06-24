#!/bin/bash

# Deploy Pre-Commit Agent to a repository
# Usage: ./deploy-precommit-agent.sh /path/to/repo

set -e

REPO_PATH="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$REPO_PATH/.git" ]; then
  echo "❌ Error: $REPO_PATH is not a git repository"
  exit 1
fi

cd "$REPO_PATH"

echo "🚀 Deploying pre-commit agent to $(basename "$REPO_PATH")..."
echo ""

# 1. Check if Node.js project
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. This doesn't appear to be a Node.js project."
  exit 1
fi

# 2. Install husky if not present
if ! grep -q '"husky"' package.json; then
  echo "📦 Installing husky..."
  npm install husky --save-dev
fi

# 3. Initialize husky if needed
if [ ! -d ".husky" ]; then
  echo "🪝 Initializing husky..."
  npx husky install
fi

# 4. Copy pre-commit agent scripts
echo "📋 Setting up pre-commit agent scripts..."
mkdir -p scripts

# Copy shared utilities
cp "$SCRIPT_DIR/shared-utils.js" ./scripts/shared-utils.js
cp "$SCRIPT_DIR/code-review.js" ./scripts/code-review.js
cp "$SCRIPT_DIR/generate-docs.js" ./scripts/generate-docs.js

chmod +x ./scripts/code-review.js
chmod +x ./scripts/generate-docs.js

# 5. Create/update pre-commit hook
echo "🪝 Installing pre-commit hook..."
cat > .husky/pre-commit << 'HOOK'
#!/bin/sh

# Pre-commit hook: Code Review + Documentation Generation
# Blocks on serious issues only
# Auto-generates documentation and commits it

echo ""
echo "🔍 Pre-commit checks running..."
echo ""

# Run code review (blocks if errors)
node scripts/code-review.js
if [ $? -ne 0 ]; then
  exit 1
fi

# Generate documentation (non-blocking, auto-stages)
node scripts/generate-docs.js

echo "✅ Pre-commit checks passed - ready to commit!"
echo ""
HOOK

chmod +x .husky/pre-commit

# 6. Update package.json scripts
echo "📝 Updating package.json scripts..."
if ! grep -q '"review"' package.json; then
  # Add review script to package.json
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    if (!pkg.scripts) pkg.scripts = {};
    pkg.scripts.review = 'node scripts/code-review.js';
    pkg.scripts['generate-docs'] = 'node scripts/generate-docs.js';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
fi

# 7. Ensure TypeDoc is available (optional)
if [ -f "tsconfig.json" ] && ! grep -q '"typedoc"' package.json; then
  echo "📚 Installing typedoc for documentation generation..."
  npm install typedoc --save-dev
fi

# 8. Create .husky/.gitignore if needed
if [ ! -f ".husky/.gitignore" ]; then
  echo "_" > .husky/.gitignore
fi

echo ""
echo "✅ Pre-commit agent deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Review the changes: git status"
echo "  2. Test the hook: git commit --allow-empty -m 'test'"
echo "  3. Commit the setup: git add -A && git commit -m 'Set up pre-commit agent'"
echo ""
echo "ℹ️  The hook will run automatically on every commit."
echo "   Run 'npm run review' to test the code review agent manually."
echo ""
