#!/usr/bin/env node

/**
 * Code Review Agent
 * Performs local code quality checks without API calls
 * Blocks only on serious issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

class CodeReviewAgent {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.stagedFiles = this.getStagedFiles();
  }

  getStagedFiles() {
    try {
      const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
      return output
        .split('\n')
        .filter(f => f && (f.endsWith('.ts') || f.endsWith('.js')))
        .filter(f => !f.includes('__tests__') && !f.includes('.spec.') && !f.includes('.test.'));
    } catch (e) {
      return [];
    }
  }

  /**
   * Check TypeScript compilation
   * This is a BLOCKER if it fails
   */
  checkTypeScript(file) {
    const dir = path.dirname(file);
    const tsconfigPath = this.findTsConfig(dir);

    if (!tsconfigPath) return;

    try {
      // Find the service root
      const serviceRoot = this.findServiceRoot(dir);
      if (!serviceRoot) return;

      execSync(`cd ${serviceRoot} && ./node_modules/.bin/tsc --noEmit`, {
        stdio: 'ignore',
      });
    } catch (e) {
      this.errors.push(`TypeScript compilation failed in ${path.basename(dir)}`);
    }
  }

  /**
   * Check for common code quality issues
   * Warnings only (non-blocking)
   */
  checkCodeQuality(file) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;

        // Check for console.log in production code
        if (line.includes('console.log') && !line.includes('//')) {
          this.warnings.push(
            `${file}:${lineNum} - Remove console.log before commit`
          );
        }

        // Check for debugger statements
        if (line.includes('debugger') && !line.includes('//')) {
          this.errors.push(
            `${file}:${lineNum} - debugger statement found (CRITICAL)`
          );
        }

        // Check for TODO/FIXME comments
        if (line.includes('TODO') || line.includes('FIXME')) {
          this.warnings.push(
            `${file}:${lineNum} - ${line.trim()}`
          );
        }

        // Check for any/unknown types (warning)
        if ((line.includes(': any') || line.includes('as any')) && !line.includes('//')) {
          this.warnings.push(
            `${file}:${lineNum} - Avoid 'any' type, use specific types`
          );
        }

        // Check for empty catch blocks
        if (line.includes('catch') && lines[idx + 1] && lines[idx + 1].trim() === '}') {
          this.errors.push(
            `${file}:${lineNum} - Empty catch block (must handle errors)`
          );
        }

        // Check file length (warning if > 500 lines)
        if (lines.length > 500) {
          this.warnings.push(
            `${file} - File is ${lines.length} lines (consider splitting)`
          );
        }
      });
    } catch (e) {
      // File may not be readable, skip
    }
  }

  /**
   * Check for missing JSDoc on exports
   * Warnings only
   */
  checkDocumentation(file) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      let lastWasComment = false;
      lines.forEach((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('/**') || trimmed.startsWith('//')) {
          lastWasComment = true;
          return;
        }

        // Check exported functions/classes without comments
        if ((trimmed.startsWith('export function') || trimmed.startsWith('export class')) && !lastWasComment) {
          const name = trimmed.split(/[\s(]/)[2];
          this.warnings.push(
            `${file}:${idx + 1} - Export '${name}' missing JSDoc comment`
          );
        }

        if (!trimmed.startsWith('//') && !trimmed.startsWith('*')) {
          lastWasComment = false;
        }
      });
    } catch (e) {
      // File may not be readable, skip
    }
  }

  findTsConfig(dir) {
    let current = dir;
    while (current !== '/') {
      const tsconfigPath = path.join(current, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        return tsconfigPath;
      }
      current = path.dirname(current);
    }
    return null;
  }

  findServiceRoot(dir) {
    let current = dir;
    while (current !== '/' && !current.endsWith('services')) {
      if (fs.existsSync(path.join(current, 'package.json'))) {
        return current;
      }
      current = path.dirname(current);
    }
    return current.endsWith('services') ? path.dirname(current) : null;
  }

  run() {
    console.log('\n📋 Code Review Agent\n');

    if (this.stagedFiles.length === 0) {
      console.log('✅ No TypeScript/JavaScript files staged\n');
      return true;
    }

    console.log(`Reviewing ${this.stagedFiles.length} file(s)...\n`);

    // Run checks
    this.stagedFiles.forEach(file => {
      this.checkTypeScript(file);
      this.checkCodeQuality(file);
      this.checkDocumentation(file);
    });

    // Report results
    let canCommit = true;

    if (this.errors.length > 0) {
      canCommit = false;
      console.log(`${RED}❌ ERRORS (blocking)${RESET}`);
      this.errors.forEach(err => console.log(`   ${RED}✗${RESET} ${err}`));
      console.log();
    }

    if (this.warnings.length > 0) {
      console.log(`${YELLOW}⚠️  WARNINGS (non-blocking)${RESET}`);
      this.warnings.slice(0, 5).forEach(warn => console.log(`   ${YELLOW}◆${RESET} ${warn}`));
      if (this.warnings.length > 5) {
        console.log(`   ... and ${this.warnings.length - 5} more warnings`);
      }
      console.log();
    }

    if (!canCommit) {
      console.log(`${RED}Commit blocked: Fix errors above${RESET}\n`);
      process.exit(1);
    }

    if (this.warnings.length > 0) {
      console.log(`${GREEN}✅ Review passed (${this.warnings.length} warnings - review before push)${RESET}\n`);
    } else {
      console.log(`${GREEN}✅ Code review passed${RESET}\n`);
    }

    return true;
  }
}

// Run the agent
const agent = new CodeReviewAgent();
agent.run();
