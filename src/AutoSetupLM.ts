import * as vscode from 'vscode';

export interface SuggestedCommand {
  label: string;
  customCommand: string;
  group: string;
  icon?: string;
  notes?: string | null;
}

const GOAL_PROMPT = `You are helping configure a developer tool called QuickRun — a VS Code sidebar
that holds shell commands a developer runs frequently.

Your job is to do an EXHAUSTIVE search of the current workspace and suggest
every useful command a developer would want quick access to. Do not stop after
finding one configuration file — keep exploring until you have checked every
likely source of runnable commands.

Search the following locations and file types (read each one you find):
- package.json (scripts section)
- Makefile / makefile
- Taskfile.yml / Taskfile.yaml
- justfile / Justfile
- docker-compose.yml / docker-compose.yaml / compose.yml
- Dockerfile (detect presence → suggest build/run commands)
- Any *.sh or *.bash files in the root or a scripts/ directory
- pyproject.toml, setup.py (Python projects)
- Cargo.toml (Rust projects)
- go.mod (Go projects)
- build.gradle / gradlew (Gradle projects)
- pom.xml (Maven projects)
- .env.example or README.md for hints about how to run the project
- Any CI configuration (e.g. .github/workflows/*.yml) for clues about
  standard build/test/deploy commands used in the project

Do not stop until you have read every file from the list above that exists.
Only return results when you are confident you have found everything.

Skip: internal lifecycle hooks (e.g. "postinstall", "prepare"), and commands
that require manual secret substitution to work (e.g. placeholders like
YOUR_TOKEN_HERE in the command string).
Include: setup and install scripts — these are useful for developers who are
new to the project and need to get it running quickly.

Rules for the output:
- Labels must be short and human-friendly (max 4 words).
- Assign each command to one of: Dev, Build, Test, Lint & Format, Docker,
  Deploy, Scripts. Only use a new group name if none of those fit.
- Multiple commands can share the same group — they will be grouped together
  in the sidebar.
- Pick an appropriate "icon" for each command from this list of VS Code codicon
  names: terminal, play, gear, beaker, bug, rocket, server, database, cloud,
  git-branch, package, zap, tools, file, folder, refresh, stop-circle, run,
  symbol-event, wrench, repo, deploy, shield, code.
- If a command must be run from a subdirectory, wrap it in a subshell so it
  always works from the workspace root:
  "(cd ./subdir && the-command)"
  Never emit a bare "cd" — it would move the terminal permanently and break
  every subsequent run.
- Add a "notes" field (one sentence) only if the command's purpose is not
  obvious from its label. Otherwise set it to null.
- Return ONLY a valid JSON array when you are done. No explanation, no markdown
  fences.

Example output (illustrating multiple commands per group):
[
  {
    "label": "Start dev server",
    "customCommand": "npm run dev",
    "group": "Dev",
    "icon": "play",
    "notes": null
  },
  {
    "label": "Run all tests",
    "customCommand": "npm test",
    "group": "Test",
    "icon": "beaker",
    "notes": null
  },
  {
    "label": "Run unit tests",
    "customCommand": "npm run test:unit",
    "group": "Test",
    "icon": "beaker",
    "notes": "Runs only unit tests, skipping integration tests."
  },
  {
    "label": "Build production",
    "customCommand": "npm run build",
    "group": "Build",
    "icon": "package",
    "notes": null
  },
  {
    "label": "Lint & fix",
    "customCommand": "npm run lint:fix",
    "group": "Lint & Format",
    "icon": "wrench",
    "notes": null
  },
  {
    "label": "Start containers",
    "customCommand": "docker compose up -d",
    "group": "Docker",
    "icon": "cloud",
    "notes": "Starts all services in detached mode."
  },
  {
    "label": "Stop containers",
    "customCommand": "docker compose down",
    "group": "Docker",
    "icon": "stop-circle",
    "notes": null
  }
]`;

type ModelTier = {
  label: string;
  detail: string;
};

const MODEL_TIERS: Record<string, ModelTier> = {
  'gpt-5.4': {
    label: '$(star-full) Best quality',
    detail: 'Most thorough analysis. Slower and expensive. Ideal for large or complex projects.',
  },
  'claude-opus-4.6': {
    label: '$(star-full) Best quality',
    detail: 'Most thorough analysis. Slower and expensive. Ideal for large or complex projects.',
  },
  'claude-sonnet-4.6': {
    label: '$(star-full) Recommended',
    detail: 'Excellent analysis quality at reasonable speed. Best default choice.',
  },
};

const TIER_ORDER = [
  '$(star-full) Best quality',
  '$(star-full) Recommended',
  '$(star-half) Good',
  '$(dash) Fast',
];

type ModelPickItem =
  | { kind: vscode.QuickPickItemKind.Separator; label: string; model?: undefined }
  | {
      kind?: vscode.QuickPickItemKind.Default;
      label: string;
      description: string;
      detail: string;
      model: vscode.LanguageModelChat;
    };

export async function selectModel(): Promise<vscode.LanguageModelChat | undefined> {
  const allModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
  const models = allModels.filter((m) => !m.name.toLowerCase().includes('auto'));

  if (models.length === 0) {
    vscode.window.showErrorMessage(
      'QuickRun Auto-Setup requires a language model such as GitHub Copilot. None was found.',
    );
    return undefined;
  }

  const known = models
    .filter((m) => m.family in MODEL_TIERS)
    .sort((a, b) => {
      const ai = TIER_ORDER.indexOf(MODEL_TIERS[a.family].label);
      const bi = TIER_ORDER.indexOf(MODEL_TIERS[b.family].label);
      return ai - bi;
    });

  const toItem = (m: vscode.LanguageModelChat): ModelPickItem => {
    const tier = MODEL_TIERS[m.family];
    return {
      label: m.name,
      description: tier?.label ?? '',
      detail: tier?.detail ?? m.family,
      model: m,
    };
  };

  const items: ModelPickItem[] = [
    ...known.map(toItem),
    { kind: vscode.QuickPickItemKind.Separator, label: 'All available models' } as ModelPickItem,
    ...models.map(toItem),
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: 'QuickRun Auto-Setup — Select a model',
    placeHolder: 'Choose which model to use for analysing the project',
    ignoreFocusOut: true,
    matchOnDescription: true,
  });

  return picked?.model;
}

export async function analyseProject(
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
): Promise<SuggestedCommand[] | undefined> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('QuickRun Auto-Setup requires an open workspace folder.');
    return undefined;
  }

  const prompt = `The workspace root is: ${workspaceRoot}\n\n${GOAL_PROMPT}`;

  const tools = [...vscode.lm.tools];
  const messages: vscode.LanguageModelChatMessage[] = [
    vscode.LanguageModelChatMessage.User(prompt),
  ];

  while (true) {
    if (token.isCancellationRequested) {
      return undefined;
    }

    const response = await model.sendRequest(messages, { tools }, token);

    const textParts: vscode.LanguageModelTextPart[] = [];
    const toolCallParts: vscode.LanguageModelToolCallPart[] = [];

    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        textParts.push(part);
      } else if (part instanceof vscode.LanguageModelToolCallPart) {
        toolCallParts.push(part);
      }
    }

    if (toolCallParts.length === 0) {
      const text = textParts.map((p) => p.value).join('');
      return parseResponse(text);
    }

    messages.push(vscode.LanguageModelChatMessage.Assistant([...textParts, ...toolCallParts]));

    const toolResultParts: vscode.LanguageModelToolResultPart[] = [];
    for (const call of toolCallParts) {
      try {
        const result = await vscode.lm.invokeTool(
          call.name,
          { input: call.input, toolInvocationToken: undefined },
          token,
        );
        toolResultParts.push(new vscode.LanguageModelToolResultPart(call.callId, result.content));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toolResultParts.push(
          new vscode.LanguageModelToolResultPart(call.callId, [
            new vscode.LanguageModelTextPart(`Tool error: ${msg}`),
          ]),
        );
      }
    }
    messages.push(vscode.LanguageModelChatMessage.User(toolResultParts));
  }
}

function parseResponse(text: string): SuggestedCommand[] | undefined {
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error('not an array');
    }
    return parsed.filter(
      (item): item is SuggestedCommand =>
        typeof item.label === 'string' && typeof item.customCommand === 'string',
    );
  } catch {
    vscode.window.showErrorMessage(
      'QuickRun Auto-Setup: Could not parse the model response. Please try again.',
    );
    return undefined;
  }
}
