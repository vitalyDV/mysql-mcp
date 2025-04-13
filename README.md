# MySQL MCP Server

This project implements an MCP (Model Context Protocol) server for working with MySQL database.

## Installation

```bash
cd mysql-mcp
npm install
```

## add config to mcp.json
```json
{
  "mcpServers": {
    "mysql_mcp_readonly": {
      "command": "node",
      "args": [
        "./mysql-mcp/index.js"
      ],
      "env": {
        "MYSQL_HOST": "127.0.0.1",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASS": "",
        "MYSQL_DB": "db",
      }
    }
  }
}
```

## Environment Variables

- `MYSQL_HOST` - MySQL server host
- `MYSQL_PORT` - MySQL server port
- `MYSQL_USER` - MySQL username
- `MYSQL_PASS` - MySQL password
- `MYSQL_DB` - MySQL database name

## Available MCP tools

- `query` - execute SQL queries (only SELECT, SHOW, EXPLAIN, DESCRIBE)
- `table-schema` - get table structure
- `list-tables` - get list of all tables in the database
