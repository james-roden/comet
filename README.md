# Claude Commit

VSCode extension that generates Conventional Commits messages for staged changes using the Claude Code CLI (subscription auth, no API key).

## Requirements

- [Claude Code](https://claude.com/claude-code) installed and logged in (`claude` on PATH)
- Git repository open in VSCode

## Usage

1. Stage changes
2. Click the sparkle icon at the top of the Source Control panel
3. Review the generated message in the commit input box, edit if needed, commit

## Settings

- `claudeCommit.claudeBinary` — path to the `claude` CLI (default: `claude`)
- `claudeCommit.maxDiffBytes` — truncate staged diff above this size (default: 200000)
