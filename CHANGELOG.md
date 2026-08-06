# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-08-06

### Added
- **Bug management**: New `zentao_create_bug` and `zentao_edit_bug` tools to create a bug under a product and edit an existing bug's fields.
- **List tools**: New `zentao_list_tasks` (by execution) and `zentao_list_bugs` (by product) tools with optional keyword filtering.
- **Search tool**: New `zentao_search` tool to search tasks or bugs by keyword within an execution/product scope (client-side filter).
- **Line endings**: Added `.gitattributes` to normalize line endings across the repo.

---

## [1.1.0] - 2026-08-05

### Added
- **SSL bypass option**: New `ZENTAO_ALLOW_INSECURE_SSL=true` environment variable. When enabled, the Axios client skips TLS certificate verification, letting the server connect to ZenTao instances with self-signed or invalid SSL certificates. Disabled by default to keep secure verification on for normal setups.

---

## [1.7.0] - 2026-07-16

### Changed
- **Tools merged**: Merged `zentao_get_task_details` and `zentao_get_bug_details` into a single `zentao_get_details` tool to save MCP context token usage.
- **Tools removed**: Removed `zentao_download_attachment` as attachments are already proactively downloaded and cached during detail queries.

---

## [1.5.0] - 2026-07-15

### Refactored
- **`zentaoClient.ts`**: Extracted `webBaseUrl` private getter to eliminate duplicated URL-parsing logic shared between `getFallbackClassicData` and `addComment`.
- **`zentaoClient.ts`**: Extracted `pipeStreamToFile()` private helper; `downloadFile` and `downloadImageToLocal` now share a single stream-to-file implementation.
- **`zentaoClient.ts`**: Extracted `getWithFallback()` generic private helper; `getTaskDetails` and `getBugDetails` no longer duplicate the REST → classic fallback try/catch pattern.
- **`zentaoClient.ts`**: Promoted `RESOLUTION_LABEL_MAP` and `USER_FIELDS` to module-level constants to avoid object re-allocation on every `generateActionDesc` call.
- **`actionFormatter.ts`**: Removed direct `fs`/`path`/`os` imports; file downloads inside action items now delegate to `renderAttachments()` (Single Responsibility Principle).
- **`imageLocalizer.ts`**: Added explicit `inFlightImageDownloads.delete()` in the `catch` block to guarantee Map cleanup even when `downloadImageToLocal` throws unexpectedly.
- **`markdownUtils.ts`**: Configured `TurndownService` with `headingStyle: 'atx'`, `bulletListMarker: '-'`, and `codeBlockStyle: 'fenced'` for consistent Markdown output.
- **`mcpResponse.ts`**: `buildMcpResponse` is now `async` and uses `fs.promises` + `Promise.all` for concurrent, non-blocking image reads.

### Tests
- Added `tests/formatters.test.ts` with 15 new unit tests covering `taskToMarkdown`, `bugToMarkdown`, and `renderHistoryAndComments`.

---

## [1.4.0] - 2026-07-15

### Added
- **`zentao_get_comments`**: Retrieve the comments and history timeline of a task or bug in a clean Markdown format.
- **`zentao_update_task_status`**: Update a task's status (`start`, `finish`, `close`, `pause`, `cancel`, `restart`) with optional comments and actual start/finish dates.
- **`zentao_update_bug_status`**: Update a bug's status (`resolve`, `close`, `activate`) with comments, resolutions, and builds.
- Public `post`, `updateTaskStatus`, and `updateBugStatus` helpers inside `ZentaoClient`.

### Fixed
- Automatically resolve Zentao validation requirements for completing tasks (automatically supplies original start date and finish date if not specified).

---

## [1.3.0] - 2026-07-15

### Added
- Formatted task and bug action log / history comments as Markdown blockquotes and bullet points under `## History & Comments`.
- Support for inline images and attachments inside comments.

---

## [1.2.17] - 2026-07-09

### Refactored
- Split monolith `tools.ts` into clean, modular layers under `formatters/`, `tools/`, and `utils/`.
- Converted codebase to standard ES Modules (`"type": "module"`).
- Implemented in-flight request deduplication to prevent cache stampedes.
