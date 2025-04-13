#!/usr/bin/env node

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// Remove HttpServerTransport import as it's not found
// import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from 'zod';
import mysql from 'mysql2/promise';

// Check for required environment variables
const requiredEnvVars = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_DB'];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
}

// Create MySQL configuration from environment variables
const mysqlConfig = {
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT, 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS || '',
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
};

// Variable to store connection pool
let pool;

// Function to initialize MySQL connection
async function initMySqlConnection() {
    try {
        pool = mysql.createPool(mysqlConfig);
        const connection = await pool.getConnection();
        connection.release();
        console.log('Successfully connected to MySQL');
        return true;
    } catch (error) {
        console.error('Error connecting to MySQL:', error);
        return false;
    }
}

// Function to execute MySQL query
async function executeQuery(query, params = []) {
    try {
        if (!pool) {
            await initMySqlConnection();
        }

        const [rows] = await pool.query(query, params);
        const result = Array.isArray(rows) ? rows : [rows];

        return {
            success: true,
            result,
        };
    } catch (error) {
        console.error('Error executing query:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

// Function to get database schema
async function getSchema(table = null) {
    try {
        if (table) {
            // Get information about specific table
            const query = `SHOW COLUMNS FROM ${pool.escapeId(table)}`;
            const [columns] = await pool.query(query);
            return {
                success: true,
                schema: columns,
            };
        } else {
            // Get list of all tables
            const query = `
                SELECT 
                    TABLE_NAME,
                    ENGINE,
                    TABLE_ROWS,
                    DATA_LENGTH,
                    AUTO_INCREMENT
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = ?
            `;
            const [tables] = await pool.query(query, [mysqlConfig.database]);
            return {
                success: true,
                schema: tables,
            };
        }
    } catch (error) {
        console.error('Error getting schema:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

// Create MCP server
const server = new McpServer({
    name: 'MySQL MCP',
    version: '1.0.0',
});

// Add SQL query execution tool
server.tool('query', { query: z.string() }, async ({ query }) => {
    // Check that query starts with SELECT, SHOW, EXPLAIN or DESCRIBE
    const lowercaseQuery = query.trim().toLowerCase();
    if (
        !lowercaseQuery.startsWith('select') &&
        !lowercaseQuery.startsWith('show') &&
        !lowercaseQuery.startsWith('explain') &&
        !lowercaseQuery.startsWith('describe')
    ) {
        return {
            content: [
                {
                    type: 'text',
                    text: 'Only SELECT, SHOW, EXPLAIN and DESCRIBE queries are allowed',
                },
            ],
            isError: true,
        };
    }

    const result = await executeQuery(query);
    if (result.success) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result.result, null, 2),
                },
            ],
        };
    } else {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${result.error}`,
                },
            ],
            isError: true,
        };
    }
});

// Add tool for getting table schema
server.tool('table-schema', { table: z.string() }, async ({ table }) => {
    const result = await getSchema(table);
    if (result.success) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result.schema, null, 2),
                },
            ],
        };
    } else {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${result.error}`,
                },
            ],
            isError: true,
        };
    }
});

// Add tool for listing all tables
server.tool('list-tables', {}, async () => {
    const result = await getSchema();
    if (result.success) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result.schema, null, 2),
                },
            ],
        };
    } else {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${result.error}`,
                },
            ],
            isError: true,
        };
    }
});

// Resource for accessing table data
server.resource('table', new ResourceTemplate('table://{name}', { list: undefined }), async (uri, { name }) => {
    const result = await executeQuery(`SELECT * FROM ${pool.escapeId(name)} LIMIT 100`);
    if (result.success) {
        return {
            contents: [
                {
                    uri: uri.href,
                    text: JSON.stringify(result.result, null, 2),
                },
            ],
        };
    } else {
        return {
            contents: [
                {
                    uri: uri.href,
                    text: `Error getting data from table ${name}: ${result.error}`,
                },
            ],
        };
    }
});

// Initialize database connection before starting
await initMySqlConnection();

// Start server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
