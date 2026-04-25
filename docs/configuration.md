# Configuration

QuickRun stores commands in two places depending on the scope you choose when adding them.

## Project scope — `.vscode/quickrun.json`

Created automatically when you save your first project-scoped command. Commit this file to share commands with your team:

```json
{
  "groups": [
    { "id": "dev-group", "label": "Dev",      "icon": "code"     },
    { "id": "db-group",  "label": "Database", "icon": "database" }
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

## Global scope — `settings.json`

Stored under the `quickrun.global` key in your VS Code user settings. Managed automatically by the extension, but you can also edit it directly:

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

## Command fields

| Field | Required | Description |
|---|---|---|
| `id` | Auto-generated | UUID assigned by the extension |
| `label` | Yes | Display name shown in the sidebar |
| `customCommand` | Yes | The shell command to run |
| `icon` | No | VS Code codicon name (default: `play`) |
| `groupId` | No | ID of the group this command belongs to |
| `notes` | No | Short description shown in the tooltip |
| `terminalMode` | No | `"reuse"` (default) or `"new"` |

## Group fields

| Field | Required | Description |
|---|---|---|
| `id` | Auto-generated | UUID assigned by the extension |
| `label` | Yes | Display name shown in the sidebar |
| `icon` | No | VS Code codicon name (default: `folder`) |
