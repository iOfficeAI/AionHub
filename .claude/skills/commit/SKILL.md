---
name: commit
description: Generate commit messages following project conventions and commit staged changes. Use when the user explicitly asks to commit, create a commit, or run /commit.
argument-hint: "[message advice]"
disable-model-invocation: true
allowed-tools: Bash(rm -f ./.git/index.lock)
---

# Commit Skill

Generate well-formatted commit messages and commit staged changes for AionHub.

## Usage

- `/commit` - Generates a commit message based on staged changes
- `/commit <advice>` - Uses provided advice to guide commit message generation

## Guidelines

- **Only commit staged files** - Never add files with `git add`. The user controls staging.
- **Analyze all staged changes** - Review both previously staged and newly added changes
- **Follow commit message format** - Use the project format shown below
- **Match the project style** - Check recent commits (`git log`) to match existing style

## Format

```
<Type>[!](<scope>): <message title>

<bullet points summarizing changes>

[optional BREAKING CHANGE section if applicable]
```

**Key convention: Type is always lowercase** (e.g., `feat`, `fix`, `chore`, not `Feat`, `Fix`, `Chore`).

## Examples

### Basic commits

```
feat(extensions): add new ACP agent extension

- Added aion-extension.json manifest and install script
- Registered extension in build pipeline
```

```
fix(kits): resolve server startup crash on missing config

- Added fallback for undefined port in dev server
- Improved error message when config file is absent
```

```
refactor(build): use content-based SHA-256 for deterministic integrity

- Replaced timestamp-based hashing with file content hashing
- Ensures reproducible builds across environments
```

```
chore(extensions): promote claude, codex, goose from pending to extensions

- Moved directories from pending/ to extensions/
- Updated build script to include new entries
```

### No scope (cross-cutting changes)

```
chore: add .gitignore and remove dist from tracking

- Created .gitignore with standard Node/dist patterns
- Removed previously tracked dist artifacts
```

### Breaking change

```
refactor!(extensions): redesign manifest schema from v1 to v2

- Replaced flat fields with nested contributes block
- Updated all existing manifests to new format

BREAKING CHANGE: aion-extension.json schema v1 is no longer supported.
```

## Rules

- **Type**: Always lowercase (feat, fix, chore, etc.), no period at end
- **Title**: Lowercase after colon, max 50 characters total
- **Breaking changes**: Use "!" after type/scope AND include "BREAKING CHANGE:" section
- **Scope**: Optional, lowercase, aligned with project directory/module name
- **Body**: Use bullet points, explain WHY not just WHAT
- **Be specific**: Avoid vague titles like "update" or "fix stuff"

## Allowed Types

| Type     | Description                            |
| -------- | -------------------------------------- |
| feat     | New feature or extension               |
| fix      | Bug fix                                |
| chore    | Maintenance (deps, config, file moves) |
| perf     | Performance improvements               |
| refactor | Code restructure (no behavior change)  |
| docs     | Documentation changes                  |
| test     | Adding or refactoring tests            |
| style    | Code formatting (no logic change)      |
| build    | Changes to the build system or scripts |
| ci       | Changes to CI/CD workflows             |

## Common Scopes

| Scope      | When to use                                          |
| ---------- | ---------------------------------------------------- |
| extensions | Changes under `extensions/` (manifests, installs)    |
| kits       | Changes under `kits/` (server, fake agent, toolkits) |
| build      | Build scripts under `.github/scripts/`               |
| ci         | CI workflows under `.github/workflows/`              |
| docs       | Documentation under `docs/`                          |

Omit scope for cross-cutting changes that span multiple areas.

## Workflow

1. **Review changes in parallel**:
   - Run `git status` (never use `-uall` flag)
   - Run `git diff --cached` (staged changes)
   - Run `git diff` (unstaged changes)
   - Run `git log -5 --oneline` to confirm current commit style

2. **Draft commit message**:
   - Summarize the nature of changes (new feature, bug fix, etc.)
   - Ensure message accurately reflects changes and purpose
   - Use lowercase type matching the project convention
   - Pick the most fitting scope from the table above
   - Focus on WHY rather than WHAT
   - Never commit files that likely contain secrets (.env, credentials.json, etc.)

3. **Commit**:
   - Create commit with proper message format
   - Always use HEREDOC for commit messages:

   ```bash
   git commit -m "$(cat <<'EOF'
   feat(extensions): descriptive title

   - Bullet point summary
   - Another change detail

   EOF
   )"
   ```

   - Verify with `git status` after commit

4. **If pre-commit hook fails**:
   - Fix the issue
   - Create a NEW commit (do not use `--amend`)
   - Never skip hooks unless explicitly requested

## Important Notes

- **Never push** unless user explicitly requests it
- **Never stage files without asking** - Must ask the user for confirmation before running any `git add` command
- **Never use interactive flags** (`-i`) as they require user input
- **No empty commits** - If nothing is staged, inform the user instead
- **Always use HEREDOC** for commit messages to ensure proper formatting
- **Never add Co-Authored-By** - Do not append any `Co-Authored-By` trailer for any agent
- **One commit per concern** - If staged changes span multiple unrelated concerns, split into separate commits. Each commit should have a single, clear purpose
