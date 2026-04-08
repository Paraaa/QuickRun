<div align="center">

<img src="assets/QuickRun_transparent.png" alt="QuickRun Logo" width="256" />


**Save and run any terminal command from the VS Code sidebar in one click.**

No more retyping long commands. Organise them into groups, pick an icon, and run instantly.

---
<!--
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/andrejschwanke.quickrun?label=VS%20Code%20Marketplace&color=E8524A&labelColor=1a2233)](https://marketplace.visualstudio.com/items?itemName=andrejschwanke.quickrun) -->
[![Open VSX](https://img.shields.io/open-vsx/v/andrejschwanke/quickrun?label=Open%20VSX&color=E8524A&labelColor=1a2233)](https://open-vsx.org/extension/andrejschwanke/quickrun)
[![License: MIT](https://img.shields.io/badge/License-MIT-E8524A.svg?labelColor=1a2233)](LICENSE)
<!-- [![Downloads](https://img.shields.io/visual-studio-marketplace/d/andrejschwanke.quickrun?color=E8524A&labelColor=1a2233)](https://marketplace.visualstudio.com/items?itemName=andrejschwanke.quickrun) -->

<br />

<!-- TODO: Add image or Gif Replace with your actual .gif
![QuickRun in action](images/screenshot-overview.png) -->

</div>


## ✨ Features

| | |
|---|---|
| ▶ **One-click run** | Execute any command instantly from the sidebar panel |
| 🔄 **Live status indicator** | Running commands show an animated spinner and a `running` badge so you always know what's active |
| 🖥 **Per-command terminal mode** | Choose per command: reuse the same terminal across runs, or always open a fresh one |
| 📁 **Groups** | Fold related commands together for a clean, organised panel |
| 🏠 **Project scope** | Save commands to `.vscode/quickrun.json` and commit them — your whole team shares them automatically |
| 🌐 **Global scope** | Save commands to VS Code settings so they follow you across every workspace |
| 🎨 **Icon picker** | Choose from 60+ VS Code codicons per command or group |


## 🚀 Getting Started

1. Click the **QuickRun icon** in the Activity Bar
2. Click **`+`** (Add Command) in the panel toolbar
3. Fill in a label, the command to run, optionally pick an icon and group, choose a scope (**Project** or **Global**), then click **Add Command**
4. Click the **▶ play** button next to any command to run it in the terminal


## 💡 Use Cases

<details>
<summary><strong>Web / Full-stack</strong></summary>

Save `npm run dev`, `npm run build`, and `npm test` as a project group, commit `.vscode/quickrun.json`, and every teammate gets the same commands on clone.

</details>

<details>
<summary><strong>Django / Python</strong></summary>

Keep `python manage.py runserver`, `makemigrations`, `migrate`, and `createsuperuser` in a project group so you never mistype them again.

</details>

<details>
<summary><strong>Docker</strong></summary>

Store `docker compose up -d`, `docker compose down`, and `docker ps` as global commands so they are available in every workspace.

</details>

<details>
<summary><strong>Monorepo</strong></summary>

Create a group per package (`frontend`, `backend`, `shared`) with the relevant build and test commands for each.

</details>

<details>
<summary><strong>DevOps / Scripts</strong></summary>

Save long one-liners (`kubectl get pods -n production`, `ssh deploy@myserver`) globally so they are always one click away.

</details>


## 🔭 Scopes

The panel shows a **`project`** or **`global`** badge next to each item so you always know where it lives.

| Scope | Stored in | Best for |
|---|---|---|
| **Project** | `.vscode/quickrun.json` | Commands specific to this repo — commit the file so teammates get them too |
| **Global** | VS Code `settings.json` | Commands you want available everywhere (e.g. `git status`, `docker ps`) |


## ⚙️ Configuration

### Global commands (`settings.json`)

The `quickrun.global` setting stores your global commands and groups. It is managed automatically by the extension, but you can also edit it directly:

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

### Project config (`.vscode/quickrun.json`)

Created automatically when you save your first project-scoped command. Commit this file to share commands with your team:

```json
{
  "groups": [
    { "id": "dev-group",  "label": "Dev",      "icon": "code"     },
    { "id": "db-group",   "label": "Database",  "icon": "database" }
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

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to open an issue or submit a pull request.
****

<div align="center">

Made with ❤️ by [Andrej Schwanke](https://github.com/Paraaa)

</div>