# Zentao MCP Server

[![npm version](https://img.shields.io/npm/v/@dyno181cm.nexsoft/zentao_mcp?style=flat-square&color=CB3837&logo=npm)](https://www.npmjs.com/package/@dyno181cm.nexsoft/zentao_mcp)
[![npm downloads](https://img.shields.io/npm/dm/@dyno181cm.nexsoft/zentao_mcp?style=flat-square&color=CB3837&logo=npm)](https://www.npmjs.com/package/@dyno181cm.nexsoft/zentao_mcp)
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

### Option 1 — `npx` (recommended, no install required)

```bash
npx @dyno181cm.nexsoft/zentao_mcp
```

### Option 2 — Global install

```bash
npm install -g @dyno181cm.nexsoft/zentao_mcp
zentao_mcp
```

### Option 3 — Clone & build

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
      "args": ["-y", "@dyno181cm.nexsoft/zentao_mcp"],
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

## 🛠️ Available Tools

### `zentao_get_details`
Get full details of a ZenTao task or bug, including repro steps (for bugs), inline images, attachments, history, and comments.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `type` | `"task" \| "bug"` | ✅ | Type of the object |
| `id` | `string \| number` | ✅ | Task or Bug ID |

### `zentao_get_comments`
Get only the history and comments timeline of a task or bug.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `type` | `"task" \| "bug"` | ✅ | Type of the object |
| `id` | `string \| number` | ✅ | Task or Bug ID |

### `zentao_add_comment`
Add a comment/remark to a task or bug.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `type` | `"task" \| "bug"` | ✅ | Type of the object |
| `id` | `string \| number` | ✅ | Task or Bug ID |
| `comment` | `string` | ✅ | Comment content |

### `zentao_edit_comment`
Edit an existing comment. Find the comment's action ID via `zentao_get_comments` (shown as `comment id`).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `actionId` | `string \| number` | ✅ | Action ID of the comment to edit |
| `comment` | `string` | ✅ | New comment content |

### `zentao_delete_comment`
Delete a comment. ZenTao has no hard-delete, so this soft-hides the comment from the timeline (restorable from the ZenTao trash by an admin). Find the action ID via `zentao_get_comments`.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `actionId` | `string \| number` | ✅ | Action ID of the comment to delete |

### `zentao_update_task_status`
Update a task's status with optional comments, actual start/finish dates, and consumed hours.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taskId` | `string \| number` | ✅ | Task ID |
| `action` | `"start" \| "finish" \| "close" \| "pause" \| "cancel" \| "restart"` | ✅ | Status transition action |
| `comment` | `string` | ❌ | Optional comment to attach |
| `consumed` | `number` | ❌ | Optional hours consumed |
| `finishedDate` | `string` | ❌ | Optional actual finish date (YYYY-MM-DD) |
| `realStarted` | `string` | ❌ | Optional actual start date (YYYY-MM-DD) |
| `assignedTo` | `string` | ❌ | Optional user account to assign to next |
| `left` | `number` | ❌ | Optional left hours (for `restart`) |

### `zentao_update_bug_status`
Update a bug's status with optional comments and resolutions.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `bugId` | `string \| number` | ✅ | Bug ID |
| `action` | `"resolve" \| "close" \| "activate"` | ✅ | Status transition action |
| `comment` | `string` | ❌ | Optional comment to attach |
| `resolution` | `"fixed" \| "bydesign" \| "postponed" \| "external" \| "notrepro" \| "willnotfix"` | ❌ | Optional resolution type |
| `resolvedBuild` | `string` | ❌ | Optional build ID where bug was resolved |
| `resolvedDate` | `string` | ❌ | Optional resolution date (YYYY-MM-DD) |
| `assignedTo` | `string` | ❌ | Optional user account to assign to next |
| `openedBuild` | `string` | ❌ | Optional build ID where bug was found (for `activate`) |

### `zentao_create_task`
Create a new task under an execution. Returns the created task's full details.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `executionId` | `string \| number` | ✅ | Execution ID the task belongs to |
| `name` | `string` | ✅ | Task name |
| `type` | `string` | ❌ | Task type (`design`, `devel`, `request`, `test`, `study`, `discuss`, `ui`, `affair`, `misc`); defaults to `devel` |
| `assignedTo` | `string` | ❌ | User account to assign the task to |
| `estimate` | `number` | ❌ | Estimated hours |
| `pri` | `number` | ❌ | Priority (1=highest .. 4=lowest) |
| `desc` | `string` | ❌ | Task description |
| `story` | `string \| number` | ❌ | Related story ID |
| `module` | `string \| number` | ❌ | Module ID |
| `estStarted` | `string` | ❌ | Estimated start date (YYYY-MM-DD) |
| `deadline` | `string` | ❌ | Deadline date (YYYY-MM-DD) |

### `zentao_edit_task`
Edit an existing task. Only the fields you provide are changed. Returns the updated task's full details.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taskId` | `string \| number` | ✅ | Task ID to edit |
| `name` | `string` | ❌ | New task name |
| `type` | `string` | ❌ | Task type |
| `assignedTo` | `string` | ❌ | User account to reassign the task to |
| `estimate` | `number` | ❌ | Estimated hours |
| `consumed` | `number` | ❌ | Consumed hours |
| `left` | `number` | ❌ | Remaining hours |
| `pri` | `number` | ❌ | Priority (1=highest .. 4=lowest) |
| `desc` | `string` | ❌ | Task description |
| `story` | `string \| number` | ❌ | Related story ID |
| `module` | `string \| number` | ❌ | Module ID |
| `estStarted` | `string` | ❌ | Estimated start date (YYYY-MM-DD) |
| `deadline` | `string` | ❌ | Deadline date (YYYY-MM-DD) |

### `zentao_get_assigned_to_me`
Get tasks and bugs currently assigned to the configured user account. Takes no arguments.

### `zentao_get_my_tasks`
Get only the tasks currently assigned to the configured user account. Takes no arguments.

### `zentao_get_my_bugs`
Get only the bugs currently assigned to the configured user account. Takes no arguments.

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
