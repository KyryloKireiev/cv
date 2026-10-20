#!/usr/bin/env bash
# PreToolUse hook: block any `git commit` Claude runs unless `npm run verify` passes.
# Why: CLAUDE.md says verify must pass before every commit; this enforces it, within the
# limits below (e.g. /commit from commit-commands would otherwise commit without checks).
# Exit 2 = block the tool call and show stderr to Claude.

# Deliberately loose: "git" then the word "commit" later in the same command segment, so
# `git -C . commit`, `/usr/bin/git commit`, `sh -c "git commit"` are all caught. False
# positives (e.g. `git log --grep commit`) cost a verify run, and are blocked while verify
# fails — rephrase the command if that happens.
# Known limits: verify checks the working tree, not the staged snapshot; and if the hook
# times out, Claude Code does not block the call. Both are accepted for this project.
commit_re='git[^;&|]*[[:space:]]commit([^-[:alnum:]]|$)'
command=$(jq -r '.tool_input.command // ""')
[[ "$command" =~ $commit_re ]] || exit 0

cd "$CLAUDE_PROJECT_DIR" || exit 0
# Before the site is scaffolded there is nothing to verify.
[[ -f package.json ]] || exit 0

source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null || {
  echo "verify-before-commit: could not switch to the Node version in .nvmrc" >&2
  exit 2
}

if ! output=$(npm run verify 2>&1); then
  echo "Commit blocked: npm run verify failed. Fix it, then commit again." >&2
  echo "$output" | tail -40 >&2
  exit 2
fi
