import * as vscode from 'vscode';
import { spawn } from 'child_process';
import type { GitExtension, Repository } from './git';

const SYSTEM_PROMPT = `You write git commit messages following Conventional Commits v1.0.0.

Format:
<type>(<optional scope>): <description>

<optional body>

<optional footer>

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
Subject rules:
- imperative mood ("add" not "added")
- lowercase after the colon
- no trailing period
- 72 chars max
Body rules:
- wrap at 72 chars
- explain WHY, not WHAT (the diff shows what)
- omit body if subject is self-explanatory
Breaking changes: footer "BREAKING CHANGE: <desc>" or "!" after type/scope.

Strict prohibitions:
- Do NOT add "Co-Authored-By" trailers of any kind.
- Do NOT mention Claude, AI, LLM, assistants, or tools in the message.
- Do NOT add "Generated with" or similar attribution lines.
- No emoji.

Output ONLY the commit message. No code fences. No prose. No explanations.`;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCommit.generate', () => generate()),
  );
}

export function deactivate() {}

async function getRepo(): Promise<Repository | undefined> {
  const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!ext) {
    vscode.window.showErrorMessage('Built-in Git extension not found.');
    return;
  }
  const api = ext.exports.getAPI(1);
  if (api.repositories.length === 0) {
    vscode.window.showErrorMessage('No git repository open.');
    return;
  }
  if (api.repositories.length === 1) return api.repositories[0];

  const active = vscode.window.activeTextEditor?.document.uri;
  if (active) {
    const repo = api.getRepository(active);
    if (repo) return repo;
  }
  const pick = await vscode.window.showQuickPick(
    api.repositories.map((r) => ({ label: r.rootUri.fsPath, repo: r })),
    { placeHolder: 'Select repository' },
  );
  return pick?.repo;
}

function runClaude(
  binary: string,
  cwd: string,
  prompt: string,
  token: vscode.CancellationToken,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      binary,
      ['-p', '--output-format', 'text', '--append-system-prompt', SYSTEM_PROMPT],
      { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
    );

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => (stdout += c.toString()));
    proc.stderr.on('data', (c) => (stderr += c.toString()));

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            `'${binary}' not found on PATH. Install Claude Code: https://claude.com/claude-code`,
          ),
        );
      } else {
        reject(err);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `claude exited with code ${code}`));
    });

    token.onCancellationRequested(() => proc.kill());

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

async function generate() {
  const repo = await getRepo();
  if (!repo) return;

  if (repo.state.indexChanges.length === 0) {
    vscode.window.showWarningMessage('No staged changes. Stage files first.');
    return;
  }

  let diff = await repo.diff(true);
  if (!diff.trim()) {
    vscode.window.showWarningMessage('Staged diff is empty.');
    return;
  }

  const cfg = vscode.workspace.getConfiguration('claudeCommit');
  const binary = cfg.get<string>('claudeBinary', 'claude');
  const maxBytes = cfg.get<number>('maxDiffBytes', 200000);
  if (Buffer.byteLength(diff, 'utf8') > maxBytes) {
    diff = diff.slice(0, maxBytes) + '\n\n[diff truncated]';
  }

  const userPrompt = `Generate a Conventional Commits message for this staged diff:\n\n${diff}`;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.SourceControl,
      title: 'Claude is writing commit message…',
      cancellable: true,
    },
    async (_progress, token) => {
      try {
        const text = await runClaude(binary, repo.rootUri.fsPath, userPrompt, token);
        if (!text) {
          vscode.window.showErrorMessage('Claude returned empty response.');
          return;
        }
        repo.inputBox.value = text;
      } catch (err: any) {
        vscode.window.showErrorMessage(`Claude Commit: ${err?.message ?? String(err)}`);
      }
    },
  );
}
