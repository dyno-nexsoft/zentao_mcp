# Zentao MCP Server

[![npm version](https://img.shields.io/npm/v/@dyno181cm.nexsoft/zentao_mcp?style=flat-square&color=CB3837&logo=npm)](https://www.npmjs.com/package/@dyno181cm.nexsoft/zentao_mcp)
[![npm downloads](https://img.shields.io/npm/dm/@dyno181cm.nexsoft/zentao_mcp?style=flat-square&color=CB3837&logo=npm)](https://www.npmjs.com/package/@dyno181cm.nexsoft/zentao_mcp)
[![GitHub release](https://img.shields.io/github/v/tag/dyno-nexsoft/zentao_mcp?style=flat-square&label=release&color=2ea44f&logo=github)](https://github.com/dyno-nexsoft/zentao_mcp/releases)
[![License](https://img.shields.io/github/license/dyno-nexsoft/zentao_mcp?style=flat-square)](https://github.com/dyno-nexsoft/zentao_mcp/blob/master/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2?style=flat-square)](https://modelcontextprotocol.io)
[![Tests](https://img.shields.io/badge/tests-13%20passed-brightgreen?style=flat-square&logo=jest)](https://github.com/dyno-nexsoft/zentao_mcp/tree/master/tests)

A **Model Context Protocol (MCP)** server for integrating AI assistants (Claude, Cursor, etc.) with the [ZenTao](https://www.zentao.net) project management API.  
Fetch task details, bug reports, and attachments — all directly inside your AI chat.

---

## ✨ Features

| Tool | Description |
|---|---|
| `zentao_get_task_details` | Fetch full details of a task by ID (status, assignee, description, history & comments, attachments) |
| `zentao_get_bug_details` | Fetch full details of a bug by ID (severity, repro steps, history & comments, inline images, attachments) |
| `zentao_download_attachment` | Download any ZenTao file attachment to local disk |
| `zentao_get_comments` | Fetch only the history and comments timeline of a task or bug |
| `zentao_add_comment` | Add a comment/remark to a task or bug |
| `zentao_update_task_status` | Update task status (start, finish, close, pause, cancel, restart) and add optional comments/hours |
| `zentao_update_bug_status` | Update bug status (resolve, close, activate) and add optional comments/resolutions |
| `zentao_get_assigned_to_me` | Get tasks and bugs currently assigned to you (configured via `ZENTAO_ACCOUNT`) |


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

### `zentao_get_task_details`
Get full details of a ZenTao task.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taskId` | `string \| number` | ✅ | Task ID |

### `zentao_get_bug_details`
Get full details of a ZenTao bug, including repro steps and inline images.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `bugId` | `string \| number` | ✅ | Bug ID |

### `zentao_download_attachment`
Download a ZenTao file attachment to local disk.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `fileId` | `string \| number` | ✅ | File ID to download |
| `extension` | `string` | ❌ | File extension hint (e.g. `mp4`, `png`) |

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

### `zentao_get_assigned_to_me`
Get tasks and bugs currently assigned to the configured user account. Takes no arguments.

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
│   └── myWorkFormatter.ts    # myWorkToMarkdown (includes comments)
└── tools/
    ├── taskTool.ts           # zentao_get_task_details
    ├── bugTool.ts            # zentao_get_bug_details
    ├── downloadTool.ts       # zentao_download_attachment
    ├── commentTool.ts        # zentao_get_comments · zentao_add_comment
    ├── statusTool.ts         # zentao_update_task_status · zentao_update_bug_status
    └── myWorkTool.ts         # zentao_get_assigned_to_me
```

### Running tests

```bash
npm test           # Unit tests — 13 tests across ZentaoClient
npm run test:api   # Live API integration test (requires .env)
```

---

## 📄 License

[MIT](./LICENSE) © [dyno-nexsoft](https://github.com/dyno-nexsoft)
