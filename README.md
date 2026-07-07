# Zentao MCP Server

A Model Context Protocol (MCP) server for integrating with the Zentao API. This server provides tools to access project management data from Zentao directly through MCP-compatible interfaces.

## Features

- **Authentication**: Automatically handles login and token management for Zentao.
- **MCP Tools**:
  - `zentao_get_execution_tasks`: Retrieve tasks in an execution (sprint), with optional filtering by module ID.
  - `zentao_get_product_bugs`: Fetch a list of bugs associated with a specific product.
  - `zentao_get_bug_details`: Get detailed information about a specific bug.

## Requirements

- Node.js (v18 or higher recommended)
- A Zentao instance accessible via API

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd zentao_mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory and add the following configurations:
   ```env
   ZENTAO_BASE_URL=https://your-zentao-url.com/api.php/v1
   ZENTAO_ACCOUNT=your_username
   ZENTAO_PASSWORD=your_password
   ```

## Build and Run

To build the project:
```bash
npm run build
```

To run the server:
```bash
npm start
```

For development (watch mode):
```bash
npm run dev
```

## Usage

This server communicates via standard input/output (`stdio`), making it compatible with any MCP client that supports stdio transport.

### Available Tools

- **`zentao_get_execution_tasks`**
  - **Inputs:**
    - `executionId` (string | number) - Required. Execution ID.
    - `page` (number) - Optional. Current page (default 1).
    - `limit` (number) - Optional. Items per page (default 500).
    - `moduleId` (string | number) - Optional. Filter by module ID.

- **`zentao_get_product_bugs`**
  - **Inputs:**
    - `productId` (string | number) - Required. Product ID.

- **`zentao_get_bug_details`**
  - **Inputs:**
    - `bugId` (string | number) - Required. Bug ID.
