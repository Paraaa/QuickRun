# QuickRun

Save and run any terminal command from the VS Code sidebar. No more retyping long commands! Organise them into groups, pick an icon, and run with one click.

## Features

- **Run commands in one click** from the sidebar panel
- **Organise with groups**: fold related commands together
- **Project scope**: save commands to `.vscode/quickrun.json` and commit them with your repo so the whole team shares them
- **Global scope**: save commands to VS Code settings so they follow you across every workspace
- **Icon picker**: choose from 60+ VS Code codicons per command or group

## Use cases

**Web / full-stack project** - save `npm run dev`, `npm run build`, and `npm test` as a project group, commit `.vscode/quickrun.json`, and every teammate gets the same commands on clone.

**Django / Python** - keep `python manage.py runserver`, `makemigrations`, `migrate`, and `createsuperuser` in a project group so you never mistype them again.

**Docker** - store `docker compose up -d`, `docker compose down`, and `docker ps` as global commands so they are available in every workspace.

**Monorepo** - create a group per package (`frontend`, `backend`, `shared`) with the relevant build and test commands for each.

**DevOps / scripts** - save long one-liners (`kubectl get pods -n production`, `ssh deploy@myserver`) globally so they are always one click away.

## Getting started

1. Click the **QuickRun icon** in the Activity Bar
2. Click **+** (Add Command) in the panel toolbar
3. Fill in a label, the command to run, optionally pick an icon and group, choose a scope (Project or Global), then click **Add Command**
4. Click the **play** button next to any command to run it in the terminal

## Commands

**Panel toolbar** (icons at the top of the Quick Run panel):

| Button | Action |
|---|---|
| `+` (Add Command) | Open the Add Command form |
| Add Group | Choose a scope then enter a group name |
| Refresh | Force-reload the panel |

**Hover over a command** to reveal inline action buttons:

| Button | Action |
|---|---|
| Play | Run the command in the terminal |
| Edit | Open the Edit Command form |
| Trash | Delete the command (with confirmation) |

**Hover over a group** to reveal inline action buttons:

| Button | Action |
|---|---|
| `+` (Add Command) | Add a command directly into that group |
| Trash | Delete the group and all its commands (with confirmation) |

## Scopes

| Scope | Stored in | Use for |
|---|---|---|
| **Project** | `.vscode/quickrun.json` | Commands specific to this repo -commit the file so teammates get them too |
| **Global** | VS Code `settings.json` | Commands you want available everywhere (e.g. `git status`, `docker ps`) |

The panel shows a `project` or `global` badge next to each item so you always know where it lives.

## Extension Settings

`quickrun.global`: stores global commands and groups in VS Code settings. Managed automatically by the extension. You can also edit it directly:

```json
"quickrun.global": {
  "groups": [
    {
      "id": "docker-group",
      "label": "Docker",
      "icon": "server"
    }
  ],
  "commands": [
    {
      "id": "a1b2c3d4-...",
      "label": "Compose up",
      "customCommand": "docker compose up -d",
      "icon": "play",
      "groupId": "docker-group"
    },
    {
      "id": "b2c3d4e5-...",
      "label": "Compose down",
      "customCommand": "docker compose down",
      "icon": "stop",
      "groupId": "docker-group"
    },
    {
      "id": "c3d4e5f6-...",
      "label": "List containers",
      "customCommand": "docker ps",
      "icon": "list-ordered",
      "groupId": "docker-group"
    }
  ]
}
```

## Project config file

`.vscode/quickrun.json` is created automatically when you save your first project-scoped command. Commit this file to share commands with your team.

```json
{
  "groups": [
    {
      "id": "dev-group",
      "label": "Dev",
      "icon": "code"
    },
    {
      "id": "db-group",
      "label": "Database",
      "icon": "database"
    }
  ],
  "commands": [
    {
      "id": "d4e5f6g7-...",
      "label": "Run server",
      "customCommand": "python manage.py runserver",
      "icon": "play",
      "groupId": "dev-group"
    },
    {
      "id": "e5f6g7h8-...",
      "label": "Run tests",
      "customCommand": "python manage.py test",
      "icon": "beaker",
      "groupId": "dev-group"
    },
    {
      "id": "f6g7h8i9-...",
      "label": "Migrate",
      "customCommand": "python manage.py migrate",
      "icon": "database",
      "groupId": "db-group"
    },
    {
      "id": "g7h8i9j0-...",
      "label": "Make migrations",
      "customCommand": "python manage.py makemigrations",
      "icon": "git-commit",
      "groupId": "db-group"
    }
  ]
}
```
