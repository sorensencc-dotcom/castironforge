/**
 * Git MCP Tools
 *
 * Provides repository operations: status, log, diff, checkout, commit, push.
 * Integrates with local git repositories.
 */

import { execSync } from 'child_process';

type GitResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

type StatusParams = {
  repo_path: string;
};

type LogParams = {
  repo_path: string;
  limit?: number;
  ref?: string;
};

type DiffParams = {
  repo_path: string;
  ref1: string;
  ref2?: string;
};

type CheckoutParams = {
  repo_path: string;
  branch: string;
};

type CommitParams = {
  repo_path: string;
  message: string;
  files?: string[];
};

type PushParams = {
  repo_path: string;
  branch: string;
  force?: boolean;
};

function executeGit(cwd: string, ...args: string[]): string {
  try {
    const cmd = `git ${args.join(' ')}`;
    const result = execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return result.trim();
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(`Git command failed: ${args.join(' ')}`);
  }
}

const handlers: Record<string, (args: Record<string, unknown>) => Promise<GitResult>> = {
  async status(args: Record<string, unknown>): Promise<GitResult> {
    const { repo_path } = args as StatusParams;

    if (!repo_path) {
      return { success: false, error: 'Missing required parameter: repo_path' };
    }

    try {
      const output = executeGit(repo_path, 'status', '--porcelain');
      const branch = executeGit(repo_path, 'rev-parse', '--abbrev-ref', 'HEAD');
      return {
        success: true,
        data: {
          branch: branch.trim(),
          changes: output.split('\n').filter(l => l.trim()),
          raw_output: output
        }
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async log(args: Record<string, unknown>): Promise<GitResult> {
    const { repo_path, limit = 10, ref = 'HEAD' } = args as LogParams;

    if (!repo_path) {
      return { success: false, error: 'Missing required parameter: repo_path' };
    }

    try {
      const output = executeGit(
        repo_path,
        'log',
        `--max-count=${limit}`,
        `${ref}`,
        '--pretty=format:%H|%an|%ae|%ai|%s'
      );
      const commits = output.split('\n').map(line => {
        const [hash, author, email, date, subject] = line.split('|');
        return { hash, author, email, date, subject };
      });
      return {
        success: true,
        data: {
          ref,
          limit,
          commits
        }
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async diff(args: Record<string, unknown>): Promise<GitResult> {
    const { repo_path, ref1, ref2 = 'HEAD' } = args as DiffParams;

    if (!repo_path || !ref1) {
      return { success: false, error: 'Missing required parameters: repo_path, ref1' };
    }

    try {
      const output = executeGit(repo_path, 'diff', ref1, ref2);
      return {
        success: true,
        data: {
          from: ref1,
          to: ref2,
          diff: output,
          lines_changed: output.split('\n').filter(l => l.startsWith('+') || l.startsWith('-')).length
        }
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async checkout(args: Record<string, unknown>): Promise<GitResult> {
    const { repo_path, branch } = args as CheckoutParams;

    if (!repo_path || !branch) {
      return { success: false, error: 'Missing required parameters: repo_path, branch' };
    }

    try {
      executeGit(repo_path, 'checkout', branch);
      const current = executeGit(repo_path, 'rev-parse', '--abbrev-ref', 'HEAD');
      return {
        success: true,
        data: {
          checked_out: current.trim(),
          requested: branch
        }
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async commit(args: Record<string, unknown>): Promise<GitResult> {
    const { repo_path, message, files } = args as CommitParams;

    if (!repo_path || !message) {
      return { success: false, error: 'Missing required parameters: repo_path, message' };
    }

    try {
      if (files && files.length > 0) {
        executeGit(repo_path, 'add', ...files);
      } else {
        executeGit(repo_path, 'add', '-A');
      }

      const output = executeGit(repo_path, 'commit', '-m', message);
      const hash = executeGit(repo_path, 'rev-parse', 'HEAD');

      return {
        success: true,
        data: {
          hash: hash.trim(),
          message,
          files: files || [],
          output
        }
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async push(args: Record<string, unknown>): Promise<GitResult> {
    const { repo_path, branch, force = false } = args as PushParams;

    if (!repo_path || !branch) {
      return { success: false, error: 'Missing required parameters: repo_path, branch' };
    }

    try {
      const forceFlag = force ? '--force' : '';
      const cmd = ['push', 'origin', branch, forceFlag].filter(Boolean);
      const output = executeGit(repo_path, ...cmd);
      return {
        success: true,
        data: {
          branch,
          pushed: true,
          force,
          output
        }
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};

const definitions = [
  {
    name: 'git.status',
    description: 'Get git repository status',
    inputSchema: {
      type: 'object',
      properties: {
        repo_path: { type: 'string', description: 'Path to git repository' }
      },
      required: ['repo_path']
    }
  },
  {
    name: 'git.log',
    description: 'Get commit log for repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo_path: { type: 'string', description: 'Path to git repository' },
        limit: { type: 'number', description: 'Number of commits to retrieve', default: 10 },
        ref: { type: 'string', description: 'Git ref (branch/tag/commit)', default: 'HEAD' }
      },
      required: ['repo_path']
    }
  },
  {
    name: 'git.diff',
    description: 'Get diff between two git refs',
    inputSchema: {
      type: 'object',
      properties: {
        repo_path: { type: 'string', description: 'Path to git repository' },
        ref1: { type: 'string', description: 'First ref (base)' },
        ref2: { type: 'string', description: 'Second ref (compare)', default: 'HEAD' }
      },
      required: ['repo_path', 'ref1']
    }
  },
  {
    name: 'git.checkout',
    description: 'Checkout a branch or ref',
    inputSchema: {
      type: 'object',
      properties: {
        repo_path: { type: 'string', description: 'Path to git repository' },
        branch: { type: 'string', description: 'Branch or ref to checkout' }
      },
      required: ['repo_path', 'branch']
    }
  },
  {
    name: 'git.commit',
    description: 'Create a git commit',
    inputSchema: {
      type: 'object',
      properties: {
        repo_path: { type: 'string', description: 'Path to git repository' },
        message: { type: 'string', description: 'Commit message' },
        files: { type: 'array', description: 'Files to commit (defaults to all changes)' }
      },
      required: ['repo_path', 'message']
    }
  },
  {
    name: 'git.push',
    description: 'Push branch to remote',
    inputSchema: {
      type: 'object',
      properties: {
        repo_path: { type: 'string', description: 'Path to git repository' },
        branch: { type: 'string', description: 'Branch to push' },
        force: { type: 'boolean', description: 'Force push', default: false }
      },
      required: ['repo_path', 'branch']
    }
  }
];

export const gitTools = {
  handlers,
  definitions
};
