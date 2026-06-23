# Commit Signing Guide

This guide explains how to sign your commits with GPG to verify commit authenticity.

## Why Sign Commits?

- **Verification**: Proves you made the commit (only your key can sign)
- **Integrity**: Detects tampering—altered commits will fail verification
- **Trust**: Creates verified commit badges on GitHub (✓ Verified)
- **Security**: Prevents impersonation and unauthorized code introduction

## Prerequisites

- Git 2.10+
- GPG 2.x installed
- GitHub account with verified email

### Install GPG

**macOS (Homebrew)**
```bash
brew install gnupg
```

**Ubuntu/Debian**
```bash
sudo apt-get install gnupg2
```

**Windows**
```bash
# Download from https://www.gnupg.org/download/
# Or use Chocolatey:
choco install gpg
```

**Verify installation**
```bash
gpg --version
```

## Setup

### 1. Generate GPG Key

```bash
gpg --gen-key
```

Follow the prompts:
- Key type: RSA (default)
- Key length: 4096 bits (or higher)
- Validity: 0 (doesn't expire) or your preference
- Name: Your full name
- Email: Your GitHub email
- Passphrase: Strong password (you'll type this when signing)

### 2. List Your Keys

```bash
gpg --list-secret-keys --keyid-format LONG
```

Output example:
```
/home/user/.gnupg/secring.gpg
-----------------------------
sec   rsa4096/3AA5C34371567BD2 2016-03-10 [SC]
      27D6D3E4D5A6A14F992CC5E9E7D7D12C4C6E5F1A
uid                 [ultimate] John Doe <john@example.com>
ssb   rsa4096/42B6315D7C3B0418 2016-03-10 [E]
```

Your key ID is the part after `rsa4096/`: `3AA5C34371567BD2`

### 3. Add Key to GitHub

```bash
# Copy public key
gpg --armor --export KEY_ID | pbcopy  # macOS
gpg --armor --export KEY_ID | xclip   # Linux

# Or print to terminal
gpg --armor --export KEY_ID
```

1. Go to GitHub: https://github.com/settings/keys
2. Click "New GPG key"
3. Paste the key (including `-----BEGIN PGP PUBLIC KEY BLOCK-----`)
4. Click "Add GPG key"

### 4. Configure Git

**Set key ID locally (recommended)**
```bash
git config user.signingkey KEY_ID
git config commit.gpgsign true
```

**Or set globally (all repositories)**
```bash
git config --global user.signingkey KEY_ID
git config --global commit.gpgsign true
```

**Verify configuration**
```bash
git config --list | grep -E "signingkey|gpgsign"
```

## Usage

### Sign a Single Commit

If `commit.gpgsign` is not enabled:
```bash
git commit -S -m "message"
```

If enabled globally:
```bash
git commit -m "message"
```

You'll be prompted for your GPG passphrase.

### Sign All Commits in a Branch

```bash
git rebase -S --force-rebase origin/main
```

Then push (may need `--force` if already pushed):
```bash
git push --force-with-lease
```

### Sign an Existing Commit

```bash
# Last commit
git commit --amend -S --no-edit

# Multiple commits
git rebase -i HEAD~3  # Choose 3 commits back
# Mark each commit as 'e' (edit)
# Then: git commit --amend -S --no-edit && git rebase --continue
```

### Verify Signatures

```bash
# View commit signature
git log --show-signature -1

# Verify tag signature
git verify-tag TAG_NAME

# Check all commits in range
git log --show-signature COMMIT1..COMMIT2
```

## Troubleshooting

### "No secret key" Error

```bash
# Try pinentry-mode loopback
echo "pinentry-mode loopback" >> ~/.gnupg/gpg-agent.conf
gpgconf --kill gpg-agent
```

### Can't Find Key

```bash
# List all keys
gpg --list-secret-keys

# Try with full fingerprint
git config user.signingkey FINGERPRINT

# Reload GPG
gpg-agent --daemon
```

### Passphrase Caching

To cache your passphrase (avoid typing it repeatedly):

```bash
# Edit GPG agent config
nano ~/.gnupg/gpg-agent.conf

# Add or modify:
default-cache-ttl 3600
max-cache-ttl 7200

# Reload
gpgconf --kill gpg-agent
```

### Wrong Email

Ensure your GPG key email matches your Git config:
```bash
git config user.email
gpg --list-secret-keys
```

If they don't match, GitHub won't mark commits as verified.

## GitHub Integration

Once set up:

1. **Commits show "Verified" badge** on GitHub
2. **PR commits show verification status**
3. **Branch protection can require** signed commits
4. **Audit logs track** signed vs unsigned

## Automation

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
if ! git config --get commit.gpgsign >/dev/null; then
  echo "Warning: commit.gpgsign is not enabled"
  echo "Run: git config commit.gpgsign true"
fi
```

### Require Signed Commits (Optional)

Repository admins can enforce this:
1. Go to repository Settings
2. Branch → Branch protection rules
3. Enable "Require signed commits"

## Best Practices

1. **Use a strong passphrase** (12+ characters)
2. **Rotate keys regularly** (annually recommended)
3. **Backup your key** securely
4. **Don't share passphrases** or keys
5. **Verify commits** on collaborative projects

## Reference

- [GitHub: About Commit Signature Verification](https://docs.github.com/en/authentication/managing-commit-signature-verification)
- [GPG Documentation](https://www.gnupg.org/documentation/)
- [Git Signing Documentation](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work)

---

**Questions?** See CONTRIBUTING.md or open an issue.
