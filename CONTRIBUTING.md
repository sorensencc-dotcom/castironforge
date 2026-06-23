# Contributing to Cast Iron Forge

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Be respectful and professional in all interactions. We're building a collaborative, inclusive community.

## Getting Started

### Prerequisites
- Node.js 22+ (or as specified in the service's package.json)
- npm 11+
- Git
- Pre-commit hooks (see Setup below)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/sorensencc-dotcom/castironforge.git
   cd castironforge
   ```

2. **Install dependencies**
   ```bash
   # For individual services
   cd services/budget-ledger
   npm install
   
   # For frontend/backend
   cd chat-frontend
   npm install
   ```

3. **Install pre-commit hooks**
   ```bash
   pip install pre-commit
   pre-commit install
   pre-commit install --hook-type commit-msg
   ```

4. **Verify setup**
   ```bash
   npm run type-check
   npm test  # if available
   ```

## Branch Naming

Use descriptive branch names following the pattern:
- **Feature**: `feature/short-description`
- **Bug fix**: `fix/short-description`
- **Hotfix**: `hotfix/short-description`
- **Documentation**: `docs/short-description`
- **Claude sessions**: `claude/purpose-code`

Example: `feature/add-budget-validation`, `fix/npm-cache-issue`

## Commit Messages

Follow the conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring without feature changes
- `perf`: Performance improvements
- `test`: Test additions/updates
- `chore`: Build, CI, dependencies

### Scope (Optional)
- `ws-a`: Budget Ledger
- `ws-b`: SLO Controller
- `ws-c`: Adapter Gateway Cache
- `ws-d`: Fire Drills
- `ci`: CI/CD
- `core`: Core infrastructure

### Examples

```
feat(ws-a): add budget exhaustion detection

Implement checkBudgetExhaustion hook to validate token/cost limits.
Emits governance_abort events when thresholds exceeded.

Closes #123
```

```
fix(ci): correct npm cache path in auto-docs workflow

The workflow was looking for package-lock.json at repository root.
Now correctly points to services/auto-docs/package-lock.json.
```

```
docs: update CONTRIBUTING.md with branch naming conventions
```

## Pull Requests

### Before Creating a PR

1. **Create a branch** from `docs/migration-2026-05-04` (or appropriate base)
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes** following code style guidelines
3. **Run pre-commit checks** (automatic on commit)
   ```bash
   pre-commit run --all-files
   ```

4. **Run tests** (if applicable)
   ```bash
   npm test
   npm run type-check
   ```

5. **Commit with clear messages**
   ```bash
   git commit -m "feat(scope): description"
   ```

### Creating a PR

1. **Push your branch**
   ```bash
   git push -u origin feature/your-feature
   ```

2. **Open a PR** on GitHub with:
   - Clear title (follows commit message format)
   - Detailed description (use PR template)
   - Reference related issues
   - List what was tested

3. **PR Template** will be automatically populated—please fill it out completely

### PR Requirements

- ✅ Passes all CI checks
- ✅ Code follows project style
- ✅ Tests added/updated
- ✅ Documentation updated
- ✅ Commits follow conventional format
- ✅ No merge conflicts with base branch

### Review Process

- Assign reviewers if known
- Address review comments promptly
- Request re-review after changes
- Squash commits before merge if needed

## Code Style

### TypeScript

- Use strict mode (`"strict": true` in tsconfig.json)
- Type all function parameters and returns
- Avoid `any`; use explicit types
- Use interfaces over types for object shapes
- Prefer `const`/`let` over `var`

```typescript
// ✅ Good
async function writeLedgerEntry(
  payload: LedgerWritePayload,
  config?: GovernanceConfig
): Promise<LedgerWriteResult>

// ❌ Avoid
async function writeLedgerEntry(payload: any, config: any): any
```

### Formatting

- Use Prettier for formatting (enforced by pre-commit)
- Line length: 100 characters
- Indent: 2 spaces
- Semicolons: required
- Trailing commas: ES5

### Comments

- Only add comments for "why" not "what"
- Keep comments concise and accurate
- Update comments when code changes

```typescript
// ✅ Good - explains WHY
// Use entry_id as idempotency key to prevent duplicate writes on retry
const isDuplicate = existingResult.rows.length > 0;

// ❌ Avoid - just restates code
// Check if there are rows
const isDuplicate = existingResult.rows.length > 0;
```

### Testing

- Write tests alongside code
- Aim for >80% coverage
- Test edge cases and error paths
- Use descriptive test names

```typescript
describe('writeLedgerEntry', () => {
  it('should return duplicate status when entry_id already exists', async () => {
    // test implementation
  });
});
```

## Documentation

### When to Update Docs

- **Always**: New features, API changes, breaking changes
- **Usually**: Bug fixes with user-facing changes
- **Sometimes**: Refactoring if it changes how to use the code

### Where to Document

- **User-facing**: README, guides in `/docs`
- **API**: JSDoc comments in code
- **Implementation**: CLAUDE.md, design docs
- **Operations**: Deployment guides, runbooks

## Testing

### Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm test:watch

# Coverage
npm test:coverage

# Type check
npm run type-check
```

### Test Standards

- Minimum 40 unit tests per feature (WS-A standard)
- Minimum 12 integration tests per feature
- Load tests for performance-critical code
- All tests must pass before PR merge

## CI/CD

### Workflows

The repository uses GitHub Actions:
- **bootstrap.yml**: Validates repository structure
- **auto-docs.yml**: Generates documentation
- **dashboard.yml**: Creates build reports
- **jekyll-docker.yml**: Builds static site
- **nightly-validate.yml**: Runs nightly validation

All must pass before merge.

### Local Verification

```bash
# Type check (required)
./node_modules/.bin/tsc --noEmit

# Tests (if available)
npm test

# Linting (enforced by pre-commit)
npm run lint
```

## Releasing

### Version Management

This project uses semantic versioning when releases are made:
- **MAJOR**: Breaking API changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes

### Release Process

1. Update version in `package.json`
2. Create tag: `git tag v1.2.3`
3. Push tag: `git push origin v1.2.3`
4. GitHub Actions will build and publish

## Signing Commits

### Why Sign Commits?

Signing verifies that commits were made by you and haven't been altered.

### Setup GPG

```bash
# Generate key
gpg --gen-key

# Get key ID
gpg --list-secret-keys --keyid-format LONG

# Add to GitHub: https://github.com/settings/keys

# Configure Git
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true
```

### Signing Commits

```bash
# Automatic (if configured globally)
git commit -m "message"

# Manual
git commit -S -m "message"

# Sign all commits in PR
git rebase -S --force-rebase origin/main
```

## Getting Help

- **Questions**: Check CLAUDE.md and existing issues
- **Bugs**: Create a bug report using the template
- **Features**: Create a feature request using the template
- **Discussions**: Start a discussion for design decisions

## Recognition

Contributors are recognized in:
- Commit authors (Git history)
- Pull request comments
- Project documentation

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

## Quick Reference

```bash
# Start working on a feature
git checkout -b feature/my-feature
cd services/budget-ledger
npm install

# Make changes, commit
git commit -m "feat(ws-a): add new functionality"

# Push and create PR
git push -u origin feature/my-feature

# After PR merge, cleanup
git checkout docs/migration-2026-05-04
git pull
git branch -d feature/my-feature
```

Thank you for contributing! 🚀
