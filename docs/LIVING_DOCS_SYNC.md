# Living Docs Sync Layer

**v1.0.0 | 2026-05-18**

## Overview

The Living Docs Sync layer is an operator-grade, non-destructive synchronization system for "Living Documents" (authoritative project docs like the Treatment, Kroll, etc.) between the local CIC repository and remote providers.

## Key Features

- **Bidirectional Sync:** Support for `pull`, `push`, and `bidirectional` sync modes.
- **Provider Support:**
  - **Google Drive:** Full integration using project OAuth credentials. Supports standard files and Google Doc exports.
  - **OneDrive:** Architectural support (MS Graph API integration placeholder).
- **Non-Destructive Execution:**
  - **Local Backups:** Every local overwrite is preceded by a timestamped backup in `backups/living-docs/`.
  - **Conflict Resolution:** In `bidirectional` mode with `prompt` strategy, the system provides a diff preview and waits for operator decision ([L]ocal, [R]emote, [S]kip).
- **State Tracking:** Sync history and hashes are tracked in `state/living-docs-state.json` to ensure idempotency and accurate change detection.

## Usage

### Commands

- `npm run success:docs`: Sync living docs as defined in config.
- `npm run success:full`: Execute core success protocol followed by living docs sync.
- `npm run success -- --with-docs`: Run success protocol with integrated living docs sync.

### Flags

- `--dry-run`: Preview actions and diffs without writing any changes to local or remote.

## Configuration

Configured via `config/living-docs.json`.

```json
{
  "docs": [
    {
      "id": "doc-id",
      "label": "Human Readable Label",
      "localPath": "path/to/local.md",
      "provider": "google|onedrive",
      "remoteId": "REMOTE_FILE_ID",
      "direction": "pull|push|bidirectional",
      "conflictStrategy": "prompt|local-wins|remote-wins"
    }
  ]
}
```

## Safety Invariants

1.  **Never Delete:** The system never deletes files on remote or local.
2.  **Backups Mandatory:** No local write occurs without a backup.
3.  **Operator Authority:** Bidirectional conflicts default to operator prompt unless configured otherwise.
