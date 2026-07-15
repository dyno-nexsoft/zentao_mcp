# Changelog

All notable changes to this project will be documented in this file.

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
