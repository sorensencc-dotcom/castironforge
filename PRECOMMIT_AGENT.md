# Pre-Commit Git Agent 🚀

Automatic code review and documentation generation on every commit. **No API calls, no credits needed!**

## Overview

This system runs two agents before each commit:

1. **Code Review Agent** - Detects quality issues
2. **Docs Generator Agent** - Creates API docs and READMEs

## Setup

### One-time installation:

```bash
npm install
npm run prepare  # Installs husky hooks
```

That's it! The hook will run automatically on `git commit`.

## What It Does

### 🔍 Code Review (Blocks on serious issues)

**Blocks commit if:**
- ❌ TypeScript compilation fails
- ❌ `debugger` statements found
- ❌ Empty catch blocks

**Warns (doesn't block):**
- ⚠️ `console.log()` statements
- ⚠️ `any` types used
- ⚠️ Missing JSDoc comments
- ⚠️ TODO/FIXME comments
- ⚠️ Files longer than 500 lines

### 📚 Docs Generator (Never blocks)

**Auto-generates:**
- ✓ TypeDoc API documentation (`docs/api/`)
- ✓ Service README files
- ✓ Services index

**Auto-commits:**
- ✓ All generated docs are staged automatically
- ✓ Included in your commit

## Examples

### Example 1: Good commit ✅

```bash
$ git commit -m "Add budget validation"

🔍 Pre-commit checks running...

Reviewing 2 file(s)...

✅ Code review passed

📚 Documentation Generator Agent

Generating docs for 2 file(s)...

✅ Generated documentation:
   ✓ budget-ledger API documentation
   ✓ budget-ledger README
   ✓ Services INDEX
   ✓ Docs auto-staged

✅ Pre-commit checks passed - ready to commit!
```

### Example 2: Warnings (still commits) ⚠️

```bash
$ git commit -m "Add logging"

🔍 Pre-commit checks running...

Reviewing 1 file(s)...

⚠️  WARNINGS (non-blocking)
   ◆ src/hooks.ts:45 - Remove console.log before commit
   ◆ src/hooks.ts:89 - Avoid 'any' type, use specific types
   ... and 2 more warnings

✅ Review passed (3 warnings - review before push)

✅ Pre-commit checks passed - ready to commit!
```

### Example 3: Blocking error ❌

```bash
$ git commit -m "Debug fix"

🔍 Pre-commit checks running...

Reviewing 1 file(s)...

❌ ERRORS (blocking)
   ✗ src/debug.ts:12 - debugger statement found (CRITICAL)

Commit blocked: Fix errors above

# Fix the issue, then retry
```

## Manual Use

Run the agents manually anytime:

```bash
# Code review only
npm run review

# Generate documentation only
npm run generate-docs
```

## Disabling the Hook (Temporarily)

**Skip pre-commit hook for one commit:**
```bash
git commit --no-verify
```

⚠️ **Warning:** Use carefully! You're bypassing safety checks.

## What Gets Generated

### TypeDoc (API Documentation)
- Runs only if `tsconfig.json` exists
- Generates HTML in `docs/api/`
- Documents all exports from `src/`

### README Files
- Auto-generated for each service
- Lists scripts, dependencies, main exports
- Updated automatically

### Services Index
- Master index at `services/INDEX.md`
- Lists all services and descriptions
- Updated on every change

## Customization

To modify the checks, edit:

- **`scripts/code-review.js`** - Change what triggers warnings/errors
- **`scripts/generate-docs.js`** - Change doc generation logic
- **`.husky/pre-commit`** - Change hook workflow

### Example: Add a new check

In `scripts/code-review.js`:

```javascript
checkMyRule(file) {
  const content = fs.readFileSync(file, 'utf-8');
  if (content.includes('badThing')) {
    this.warnings.push(`${file}: Found badThing`);
  }
}

// In run():
this.stagedFiles.forEach(file => {
  // ... existing checks ...
  this.checkMyRule(file);  // Add this
});
```

## Performance

- ⚡ Typically completes in < 1 second
- ⚡ Only checks staged files
- ⚡ No network calls (100% offline)
- ⚡ No API credits used

## Troubleshooting

### Hook not running?

```bash
# Re-install hooks
npm run prepare
```

### Permission denied error?

```bash
# Make scripts executable
chmod +x .husky/pre-commit
chmod +x scripts/*.js
```

### TypeScript check failing?

Make sure each service has:
- `package.json`
- `tsconfig.json`
- TypeScript installed (`npm install typescript`)

## Architecture

```
git commit
    ↓
.husky/pre-commit (hook)
    ├─ scripts/code-review.js
    │   ├─ Check TypeScript compilation
    │   ├─ Check code quality issues
    │   └─ Check documentation
    │
    ├─ scripts/generate-docs.js
    │   ├─ Generate TypeDoc
    │   ├─ Generate READMEs
    │   └─ Generate Services INDEX
    │
    └─ Auto-stage generated docs
```

## Features

✅ **Zero API calls** - No credits, no internet needed
✅ **Fast** - Completes in <1s
✅ **Smart** - Only checks changed files
✅ **Non-intrusive** - Warnings don't block
✅ **Auto-docs** - Documentation always up-to-date
✅ **Auto-commit** - Docs included in your commit

## What's Next?

The pre-commit agent is now active! Every commit will:
1. Review your code
2. Generate documentation
3. Auto-stage the docs
4. Block only on serious issues

Happy committing! 🎉
