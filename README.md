# Zentao MCP Server

[![GitHub Packages](https://img.shields.io/badge/GitHub%20Packages-%40dyno--nexsoft%2Fzentao__mcp-2ea44f?style=flat-square&logo=github)](https://github.com/dyno-nexsoft/zentao_mcp/pkgs/npm/zentao_mcp)
[![GitHub release](https://img.shields.io/github/v/tag/dyno-nexsoft/zentao_mcp?style=flat-square&label=release&color=2ea44f&logo=github)](https://github.com/dyno-nexsoft/zentao_mcp/releases)
[![License](https://img.shields.io/github/license/dyno-nexsoft/zentao_mcp?style=flat-square)](https://github.com/dyno-nexsoft/zentao_mcp/blob/master/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2?style=flat-square)](https://modelcontextprotocol.io)
[![Tests](https://img.shields.io/badge/tests-19%20passed-brightgreen?style=flat-square&logo=jest)](https://github.com/dyno-nexsoft/zentao_mcp/tree/master/tests)

A **Model Context Protocol (MCP)** server for integrating AI assistants (Claude, Cursor, etc.) with the [ZenTao](https://www.zentao.net) project management API.  
Fetch task details, bug reports, and attachments — all directly inside your AI chat.

---

## ✨ Features

| Tool | Description |
|---|---|
| `zentao_get_details` | Fetch full details of a task or bug by ID |
| `zentao_get_comments` | Fetch only the history and comments timeline of a task or bug (with comment IDs) |
| `zentao_add_comment` | Add a comment/remark to a task or bug |
| `zentao_edit_comment` | Edit an existing comment by its action ID |
| `zentao_delete_comment` | Delete (soft-hide) a comment by its action ID |
| `zentao_update_task_status` | Update task status (start, finish, close, pause, cancel, restart) and add optional comments/hours |
| `zentao_update_bug_status` | Update bug status (resolve, close, activate) and add optional comments/resolutions |
| `zentao_create_task` | Create a new task under an execution |
| `zentao_edit_task` | Edit an existing task's fields |
| `zentao_get_assigned_to_me` | Get tasks and bugs currently assigned to you (configured via `ZENTAO_ACCOUNT`) |
| `zentao_get_my_tasks` | Get only the tasks currently assigned to you |
| `zentao_get_my_bugs` | Get only the bugs currently assigned to you |


**Under the hood:**
- 🔐 Auto login & token refresh — no manual auth needed
- 📦 In-memory cache (2 min TTL) + in-flight request dedup — avoids redundant API calls
- 🔁 Classic JSON API fallback — seamlessly retries via the web API when the REST endpoint returns empty or errors
- 🖼️ Inline HTML images are automatically downloaded and served as local `file://` links
- 📎 Attachments are downloaded and embedded as clickable local links
- 🛡️ Corrupt partial downloads are auto-cleaned on error
- ⚡ Non-blocking async image I/O — base64 encoding uses `fs.promises` + `Promise.all`

---

## 📦 Installation

Published on **GitHub Packages** — add this to `~/.npmrc` first (needs a GitHub token with `read:packages`):

```ini
@dyno-nexsoft:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

```bash
npx @dyno-nexsoft/zentao_mcp        # run directly
npm install -g @dyno-nexsoft/zentao_mcp   # or install globally
```

### Or clone & build

```bash
git clone https://github.com/dyno-nexsoft/zentao_mcp.git
cd zentao_mcp
npm install
npm run build
```

---

## ⚙️ Configuration

Create a `.env` file in the project root (or pass via MCP client `env` block):

```env
ZENTAO_BASE_URL=https://your-zentao-url.com/zentao/api.php/v1
ZENTAO_ACCOUNT=your_username
ZENTAO_PASSWORD=your_password
```

---

## 🔌 MCP Client Integration

This server communicates via **stdio transport** — compatible with any MCP client.

### Claude Desktop / Cursor / Windsurf

Add to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "zentao": {
      "command": "npx",
      "args": ["-y", "@dyno-nexsoft/zentao_mcp"],
      "env": {
        "ZENTAO_BASE_URL": "https://your-zentao-url.com/zentao/api.php/v1",
        "ZENTAO_ACCOUNT": "your_username",
        "ZENTAO_PASSWORD": "your_password"
      }
    }
  }
}
```

---

## 🧑‍💻 Development

```bash
npm run build      # Compile TypeScript
npm run dev        # Watch mode
npm test           # Unit tests (Jest)
npm run test:api   # Live API integration test
```

### Project structure

```
src/
├── index.ts                  # MCP server entry point
├── zentaoClient.ts           # Axios client: auth, cache, dedup, fallback, stream helpers
├── tools.ts                  # Thin orchestrator + backward-compat exports
├── utils/
│   ├── fileUtils.ts          # toFileUrl · getMimeType · formatSize
│   ├── markdownUtils.ts      # htmlToMarkdown · parseFiles · formatUser
│   └── mcpResponse.ts        # mcpText · buildMcpResponse (async)
├── formatters/
│   ├── imageLocalizer.ts     # Inline <img> → local file:// link (deduped, concurrent)
│   ├── attachmentRenderer.ts # Attachments → Markdown ## Files section
│   ├── actionFormatter.ts    # renderHistoryAndComments
│   ├── taskFormatter.ts      # taskToMarkdown (includes comments)
│   ├── bugFormatter.ts       # bugToMarkdown (includes comments)
│   └── myWorkFormatter.ts    # myWorkToMarkdown · myTasksToMarkdown · myBugsToMarkdown
└── tools/
    ├── detailTool.ts         # zentao_get_details
    ├── commentTool.ts        # zentao_get_comments · zentao_add_comment · zentao_edit_comment · zentao_delete_comment
    ├── statusTool.ts         # zentao_update_task_status · zentao_update_bug_status
    ├── taskTool.ts           # zentao_create_task · zentao_edit_task
    └── myWorkTool.ts         # zentao_get_assigned_to_me · zentao_get_my_tasks · zentao_get_my_bugs
```

### Running tests

```bash
npm test           # Unit tests — 19 tests across ZentaoClient
npm run test:api   # Live API integration test (requires .env)
```

---

## 📄 License

[MIT](./LICENSE) © [dyno-nexsoft](https://github.com/dyno-nexsoft)
