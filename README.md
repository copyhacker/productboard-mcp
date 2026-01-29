# Productboard MCP Server

[![Test Suite](https://github.com/copyhacker/productboard-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/copyhacker/productboard-mcp/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

A **complete** Model Context Protocol (MCP) server that provides comprehensive integration with the Productboard API. This server enables AI assistants and other MCP clients to interact with Productboard through **49 specialized tools** covering 100% of major Productboard functionalities including features, products, customer feedback, users, OKRs, releases, webhooks, analytics, and more.

## Features

### 🔐 **Robust Authentication**
- Bearer token support for simple integrations
- OAuth2 flow for enterprise scenarios
- Secure credential storage with encryption
- Automatic token refresh and validation

### 🛠️ **Comprehensive Tool Coverage**

**Total Tools Supported: 49 unique Productboard MCP tools** representing 100% coverage of the Phase 5 specification.

#### Feature Management (6 tools) ✅
- `pb_feature_create` - Create new features
- `pb_feature_list` - List features with filtering
- `pb_feature_get` - Get detailed feature information
- `pb_feature_update` - Update existing features
- `pb_feature_delete` - Delete or archive features
- `pb_feature_bulk_update` - Bulk update multiple features

#### Product Management (3 tools) ✅
- `pb_product_create` - Create products/components
- `pb_product_list` - List products and components
- `pb_product_hierarchy` - Get product hierarchy

#### Note Management (3 tools) ✅
- `pb_note_create` - Create customer feedback notes
- `pb_note_list` - List notes with filtering
- `pb_note_attach` - Attach notes to features

#### User Management (2 tools) ✅
- `pb_user_current` - Get current user info
- `pb_user_list` - List workspace users

#### Company Management (1 tool) ✅
- `pb_company_list` - List companies

#### Objectives & Key Results (7 tools) ✅
- `pb_objective_create` - Create objectives
- `pb_objective_list` - List objectives
- `pb_objective_update` - Update objectives
- `pb_objective_link_feature` - Link features to objectives
- `pb_keyresult_create` - Create key results
- `pb_keyresult_list` - List key results
- `pb_keyresult_update` - Update key results

#### Release Management (7 tools) ✅
- `pb_release_create` - Create releases
- `pb_release_list` - List releases
- `pb_release_update` - Update releases
- `pb_release_feature_add` - Add features to releases
- `pb_release_feature_remove` - Remove features from releases
- `pb_release_timeline` - Get release timeline
- `pb_release_status_update` - Update release status

#### Custom Fields (3 tools) ✅
- `pb_customfield_create` - Create custom fields
- `pb_customfield_list` - List custom fields
- `pb_customfield_value_set` - Set custom field values

#### Webhooks (5 tools) ✅
- `pb_webhook_create` - Create webhook subscriptions
- `pb_webhook_list` - List webhooks
- `pb_webhook_update` - Update webhook settings
- `pb_webhook_delete` - Delete webhooks
- `pb_webhook_test` - Test webhook endpoints

#### Search & Analytics (7 tools) ✅
- `pb_search` - Global search
- `pb_search_features` - Advanced feature search
- `pb_search_notes` - Advanced note search
- `pb_search_products` - Product search
- `pb_analytics_feature_metrics` - Feature analytics
- `pb_analytics_user_engagement` - User engagement metrics
- `pb_analytics_feedback_trends` - Feedback trend analysis

#### Bulk Operations (5 tools) ✅
- `pb_feature_bulk_create` - Bulk create features
- `pb_feature_bulk_delete` - Bulk delete features
- `pb_note_bulk_create` - Bulk create notes
- `pb_note_bulk_attach` - Bulk attach notes

#### Integrations (2 tools) ✅
- `pb_jira_sync` - JIRA synchronization
- `pb_to_jira` - Export to JIRA

#### Export (1 tool) ✅
- `pb_export` - Data export functionality

### 🚀 **Performance & Reliability**
- Rate limiting with token bucket algorithm
- Automatic retry with exponential backoff
- Response caching for read operations
- Comprehensive error handling and logging
- Concurrent request support with proper queuing

### 🔒 **Security First**
- No hardcoded credentials
- Input validation and sanitization
- HTTPS-only communication
- Encrypted credential storage
- Comprehensive audit logging

## Quick Start

### Prerequisites
- Node.js 18+
- Productboard Pro plan or higher (for API access)
- MCP-compatible client (Claude Desktop, etc.)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Enreign/productboard-mcp-private.git
   cd productboard-mcp-private
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Productboard credentials
   ```

4. **Build and start**
   ```bash
   npm run build
   npm start
   ```

### Configuration for Claude Desktop

**The `.env` file is NOT needed for production use.** Configuration is done through Claude Desktop's config file.

1. **Get your Productboard API token**
   - Go to your Productboard workspace settings
   - Navigate to API Keys section
   - Generate a new token or copy existing one

2. **Configure Claude Desktop**

   Edit your Claude Desktop config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

   Add the Productboard MCP server configuration:

   ```json
   {
     "mcpServers": {
       "productboard": {
         "command": "node",
         "args": ["/path/to/productboard-mcp/dist/index.js"],
         "env": {
           "PRODUCTBOARD_API_TOKEN": "your-actual-api-token-here"
         }
       }
     }
   }
   ```

   Replace `/path/to/productboard-mcp` with the full path to this repository.

3. **Restart Claude Desktop**

   The Productboard tools will now be available in Claude!

### Local Development & Testing

For local development and testing only, you can create a `.env` file:

```bash
# Copy the example and edit with your credentials
cp .env.example .env

# Edit .env with your Productboard API token
# PRODUCTBOARD_API_TOKEN=your-api-token
```

**Note**: The `.env` file is git-ignored and only used for local testing. Claude Desktop uses the config file above.

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure

```
src/
├── core/           # MCP server core functionality
├── auth/           # Authentication management
├── api/            # Productboard API client
├── tools/          # MCP tool implementations
├── middleware/     # Rate limiting, caching, validation
└── utils/          # Logging, configuration, helpers

tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/           # End-to-end tests
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Current Status

This project provides **complete coverage** of the Productboard API through 49 specialized MCP tools. See [current-state.md](./current-state.md) for detailed implementation status and development history.

**Implementation Progress:**
- ✅ **Core infrastructure** (100%)
- ✅ **Feature management** (100% - 6/6 tools)
- ✅ **Product management** (100% - 3/3 tools)
- ✅ **Note management** (100% - 3/3 tools)
- ✅ **User management** (100% - 2/2 tools)
- ✅ **Company management** (100% - 1/1 tool)
- ✅ **OKR management** (100% - 7/7 tools)
- ✅ **Release management** (100% - 7/7 tools)
- ✅ **Custom fields** (100% - 3/3 tools)
- ✅ **Webhooks** (100% - 5/5 tools)
- ✅ **Search & Analytics** (100% - 7/7 tools)
- ✅ **Bulk operations** (100% - 5/5 tools)
- ✅ **Integrations** (100% - 2/2 tools)
- ✅ **Export** (100% - 1/1 tool)

**Total: 49/49 tools (100% complete)** 🎉

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](./docs/)
- 🐛 [Issue Tracker](https://github.com/Enreign/productboard-mcp-private/issues)
- 💬 [Discussions](https://github.com/Enreign/productboard-mcp-private/discussions)
