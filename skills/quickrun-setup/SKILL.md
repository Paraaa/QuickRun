---
name: quickrun-setup
description: Set up or update the QuickRun VS Code extension's sidebar commands for the current project by discovering every runnable command (package.json scripts, Makefile, docker compose, etc.) and writing them to .vscode/quickrun.json. Use when the user asks to set up, initialize, populate or configure QuickRun, or to check for / add new QuickRun commands.
---

# QuickRun Setup

QuickRun is a VS Code sidebar that holds shell commands a developer runs frequently. Commands live in `.vscode/quickrun.json`, which the extension watches and reloads on change. This skill discovers the project's commands and merges them into that file. Running it again later acts as "check for new commands".

## Workflow

1. **Read the existing config.** Read `.vscode/quickrun.json` at the workspace root if it exists. Remember its groups and commands — you will only ever append to them.
2. **Discover commands.** Search the workspace exhaustively following [Discovery rules](#discovery-rules).
3. **Drop duplicates.** Remove any candidate whose `customCommand` already exists in the file (exact string match).
4. **Propose.** If nothing new remains, say "No new commands found" and stop. Otherwise show the user a table of the proposed additions — columns: Group, Label, Command, Notes — and mark which groups are new vs. existing.
5. **Wait for confirmation.** Do not write anything until the user approves. Apply any changes they ask for (e.g. "drop the Docker ones", "rename X") and re-confirm if the change is substantial.
6. **Write.** Merge per [Writing the file](#writing-the-file), then report how many commands and groups were added.

## Scope

- **Always write to the project file `.vscode/quickrun.json`.**
- Write to the global scope (`quickrun.global` in the VS Code user `settings.json`) **only when the user explicitly asks for global**. Never decide on your own that a command belongs in global scope, no matter how generic it looks.

## Discovery rules

Do an EXHAUSTIVE search. Do not stop after finding one configuration file — read every one of these that exists:

- `package.json` (scripts section)
- Monorepo workspaces: `pnpm-workspace.yaml`, the `workspaces` field of `package.json`, `turbo.json`, `nx.json`, `lerna.json` — then read the `package.json` of every workspace package as well
- `deno.json` / `deno.jsonc` (tasks section)
- `Makefile` / `makefile`, `Taskfile.yml` / `Taskfile.yaml`, `justfile` / `Justfile`
- `.vscode/tasks.json`
- `docker-compose.yml` / `docker-compose.yaml` / `compose.yml` / `compose.yaml`
- `Dockerfile` (presence → suggest build/run commands)
- `.devcontainer/devcontainer.json`, `Procfile`
- `*.sh` / `*.bash` files in the root or a `scripts/` directory
- Python: `pyproject.toml` (incl. `[tool.poetry.scripts]`, `[project.scripts]`, `[tool.uv]`, `[tool.pytest]`), `setup.py`, `tox.ini`, `noxfile.py`, `manage.py`
- Rust `Cargo.toml`, Go `go.mod`, Gradle `build.gradle(.kts)` / `gradlew`, Maven `pom.xml` / `mvnw`
- Ruby `Gemfile` / `Rakefile`, PHP `composer.json` (scripts), Elixir `mix.exs`, C/C++ `CMakeLists.txt`
- `.env.example` and `README.md` for hints about how to run the project
- CI configuration (e.g. `.github/workflows/*.yml`) for the standard build/test/deploy commands

**Use the project's own tooling:**

- Detect the package manager from the lockfile and use it consistently: `pnpm-lock.yaml` → `pnpm <script>`, `yarn.lock` → `yarn <script>`, `bun.lock` / `bun.lockb` → `bun run <script>`, `package-lock.json` or none → `npm run <script>` (`npm test` / `npm start` are fine).
- Likewise for Python: `uv.lock` → `uv run …`, `poetry.lock` → `poetry run …`.
- Invoke scripts and targets through their runner (`npm run build`, `make test`, `just lint`). Never inline the body of a script or target.

**Skip:**

- Internal lifecycle hooks (`postinstall`, `prepare`, `pretest`, …).
- Sub-steps that only exist to be called by another script (e.g. `build:css` when `build` already runs it), unless a developer would plausibly run them on their own.
- Commands that need manual secret substitution (placeholders like `YOUR_TOKEN_HERE`).

**Include** setup and install scripts — they help developers new to the project get it running.

**Per-command rules:**

- `label`: short and human-friendly, max 4 words.
- Group: one of `Dev`, `Build`, `Test`, `Lint & Format`, `Docker`, `Deploy`, `Scripts`. Only invent a new group name if none fits.
- `icon`: ONLY one of these codicon names: `terminal`, `play`, `gear`, `beaker`, `bug`, `rocket`, `server`, `database`, `cloud`, `cloud-upload`, `git-branch`, `package`, `zap`, `tools`, `file`, `folder`, `refresh`, `stop-circle`, `run`, `symbol-event`, `wrench`, `repo`, `shield`, `code`. If none fits, use `terminal`.
- Subdirectories: wrap the command in a subshell so it works from the workspace root — `(cd ./subdir && the-command)`. Never emit a bare `cd`; it would move the terminal permanently and break every later run.
- `terminalMode`: set to `"new"` for long-running processes that never exit on their own (dev servers, watchers, `docker compose up` without `-d`, log tailing). Omit it otherwise.
- `notes`: one sentence, only if the purpose is not obvious from the label. Omit it otherwise.
- Destructive commands or ones that affect shared environments (dropping/resetting a database, deploying to production, `terraform apply`, deleting data): include them, but start `notes` with `⚠️ Destructive:` followed by what the command does.

## Writing the file

File format (`.vscode/quickrun.json`):

```json
{
  "commands": [
    {
      "id": "cmd-start-dev-server-k3f9",
      "label": "Start dev server",
      "customCommand": "pnpm dev",
      "icon": "play",
      "groupId": "group-dev-x7q2",
      "terminalMode": "new"
    },
    {
      "id": "cmd-run-tests-8qz2",
      "label": "Run tests",
      "customCommand": "pnpm test",
      "icon": "beaker",
      "groupId": "group-test-m4p1",
      "notes": "Runs unit and integration tests."
    }
  ],
  "groups": [
    { "id": "group-dev-x7q2", "label": "Dev" },
    { "id": "group-test-m4p1", "label": "Test" }
  ]
}
```

Command fields: `id`, `label`, `customCommand` (required); `icon`, `groupId`, `notes`, `terminalMode` (`"reuse"` default or `"new"`) optional. Group fields: `id`, `label` (required); `icon`, `color` optional.

Merge rules:

- **Append only.** Keep every existing command and group exactly as it is — never reorder, rewrite or remove entries, and preserve any fields you do not recognise.
- **Reuse groups by label.** If a group with the same `label` already exists, use its `id` as the `groupId`; only create groups that do not exist yet.
- **IDs.** Every new command and group needs an `id` that is unique across both the project file and the user's global QuickRun settings (the sidebar shows both in one tree and duplicate ids break it). Use a readable slug plus a random 4-character suffix: `cmd-<label-slug>-<xxxx>` and `group-<label-slug>-<xxxx>` (lowercase letters and digits). Never reuse an id already in the file.
- Create the `.vscode/` directory if it does not exist. Write valid JSON with 2-space indentation.
- Do not add a `source` field — the extension derives scope from where the entry is stored.

For an explicitly requested **global** write, the same format lives under the `"quickrun.global"` key of the VS Code user `settings.json` (`~/.config/Code/User/settings.json` on Linux, `~/Library/Application Support/Code/User/settings.json` on macOS, `%APPDATA%\Code\User\settings.json` on Windows). Apply the same merge rules and leave every other setting untouched.
