# Productboard API v1 Fixes - Summary

## Overview
Updated all Productboard MCP tools to match the actual Productboard API v1 specification after testing against the live API. Fixed parameter names, endpoints, and pagination to match what the API actually accepts.

## Test Status
- **Before**: 935/980 passing (95.4%), 45 failures
- **After**: 961/1003 passing (95.8%), 42 failures
- **Improvement**: +26 passing tests, -3 failing tests

## Critical Fixes Completed ✅

### 1. **list-features** (src/tools/features/list-features.ts)
**Problem**: Using unsupported query parameters (`product_id`, `component_id`, `status`, etc.)
**Solution**:
- Changed `product_id` → `parent.id` (API-level filter)
- Changed `component_id` → `parent.id` (API-level filter)
- Changed `limit` → `pageLimit` (1-2000, default 100)
- Moved status, owner_email, search, tags to client-side filtering
- **Tests**: ✅ All passing (22/22)

### 2. **list-notes** (src/tools/notes/list-notes.ts)
**Problem**: Using snake_case parameters and wrong pagination
**Solution**:
- `feature_id` → `featureId`
- `customer_email` → `ownerEmail`
- `company_name` → `companyId`
- `tags` → `anyTag` / `allTags` (comma-separated strings)
- `date_from` / `date_to` → `createdFrom` / `createdTo`
- Added: `updatedFrom`, `updatedTo`, `term`, `pageCursor`
- `limit` → `pageLimit` (1-2000, default 100)
- **Tests**: ✅ All passing (11/11)

### 3. **product-hierarchy** (src/tools/products/product-hierarchy.ts)
**Problem**: Endpoint `/products/hierarchy` doesn't exist
**Solution**:
- Completely rebuilt to fetch `/products` and `/components` separately
- Builds hierarchy client-side by matching `component.parent.product.id`
- Returns formatted text output with products and their components
- **Tests**: ⚠️ Needs test rewrite (old tests reference non-existent endpoint)

### 4. **attach-note** (src/tools/notes/attach-note.ts)
**Problem**: Wrong endpoint and bulk linking not supported
**Solution**:
- Changed endpoint from `/notes/{id}/attach` → `/notes/{noteId}/links/{entityId}`
- Changed from bulk (`feature_ids` array) to single entity linking
- Parameters: `note_id`, `feature_ids` → `noteId`, `entityId`
- Now supports linking to feature, product, component, or subfeature
- **Tests**: ⚠️ Partially updated (compile errors remaining)

### 5. **link-features** (src/tools/objectives/link-features.ts)
**Problem**: Wrong endpoint, bulk linking not supported
**Solution**:
- Changed endpoint from `/objectives/{id}/features` → `/features/{featureId}/links/objectives/{objectiveId}`
- Changed from bulk to single feature linking
- Parameters: `objective_id`, `feature_ids` → `featureId`, `objectiveId`
- **Tests**: ⚠️ Needs completion

### 6. **keyresults endpoints**
**Problem**: Endpoint `/keyresults` doesn't exist
**Solution**:
- Fixed all keyresults tools to use `/key-results` (with hyphen)
- Files: create-keyresult.ts, update-keyresult.ts, list-keyresults.ts
- **Tests**: ⚠️ Pagination updates needed

### 7. **list-products** (src/tools/products/list-products.ts)
**Problem**: API doesn't accept any query parameters
**Solution**:
- Removed all query parameters from API call
- Added client-side filtering for `parent_id` and `archived`
- **Tests**: ⚠️ Needs updating to remove param expectations

### 8. **Pagination Updates**
**Files**: list-objectives.ts, list-releases.ts, list-keyresults.ts
**Changes**:
- `limit`/`offset` → `pageLimit`/`pageCursor`
- Max limit: 2000 (was 100)
- Default: 100 (was 20)
- **Tests**: ⚠️ Need pagination parameter updates

### 9. **Error Handling** (src/api/client.ts, src/tools/base.ts, src/core/protocol.ts)
**Improvements**:
- Error messages now include actual API error details
- Better extraction of error messages from Productboard API responses
- Added logging of full API error responses for debugging

### 10. **global-search** (src/tools/search/global-search.ts)
**Fix**: Removed `limit` parameter from `/features` call (not supported)

## Remaining Test Fixes Needed

### High Priority (Core functionality)
- ❌ product-hierarchy.test.ts - Complete rewrite needed
- ⚠️ attach-note.test.ts - Fix remaining compile errors

### Medium Priority (Common operations)
- ⚠️ link-features.test.ts - Update endpoint and parameters
- ⚠️ list-products.test.ts - Remove query parameter expectations

### Low Priority (Less frequently used)
- list-objectives.test.ts - Update pagination
- list-keyresults.test.ts - Update pagination + endpoint
- list-releases.test.ts - Update pagination
- create-keyresult.test.ts - Update endpoint
- update-keyresult.test.ts - Update endpoint
- global-search.test.ts - Remove limit param

### Integration Tests
- feature-tools.integration.test.ts
- mcp-tools-comprehensive.test.ts

## API Documentation vs Reality

### Parameters That DON'T Work (Despite Documentation)
- `product.id` on `/features` - Use `parent.id` instead
- `component.id` on `/features` - Use `parent.id` instead
- ANY query parameters on `/products` endpoint
- `limit`/`offset` pagination - Use `pageLimit`/`pageCursor` instead

### Endpoints That DON'T Exist
- `/products/hierarchy` - Must fetch `/products` and `/components` separately
- `/keyresults` - Use `/key-results` (with hyphen) instead

### Linking Endpoints
All linking is **one-to-one**, not bulk:
- Notes to entities: `POST /notes/{noteId}/links/{entityId}`
- Features to objectives: `POST /features/{featureId}/links/objectives/{objectiveId}`

## Files Modified

### Source Code (14 files)
- src/api/client.ts
- src/tools/base.ts
- src/core/protocol.ts
- src/tools/features/list-features.ts
- src/tools/notes/list-notes.ts
- src/tools/notes/attach-note.ts
- src/tools/objectives/link-features.ts
- src/tools/objectives/list-keyresults.ts
- src/tools/objectives/list-objectives.ts
- src/tools/objectives/create-keyresult.ts
- src/tools/objectives/update-keyresult.ts
- src/tools/products/list-products.ts
- src/tools/products/product-hierarchy.ts
- src/tools/releases/list-releases.ts
- src/tools/search/global-search.ts

### Tests (2 files fully updated)
- tests/unit/tools/features/list-features.test.ts ✅
- tests/unit/tools/notes/list-notes.test.ts ✅

### Documentation
- TEST_UPDATES_NEEDED.md - Detailed guide for remaining test fixes
- API_FIXES_SUMMARY.md - This file

## Next Steps

1. **Complete remaining test updates** using TEST_UPDATES_NEEDED.md as a guide
2. **Test against live API** once all tests pass
3. **Update integration tests** to match new API calls
4. **Consider updating README** with lessons learned about API discrepancies

## Key Learnings

1. **Always test against live API** - Documentation may be outdated or incorrect
2. **Parameter naming matters** - snake_case vs camelCase affects API acceptance
3. **Endpoint names matter** - `/keyresults` vs `/key-results` makes a difference
4. **Pagination is cursor-based** - Not offset-based as commonly implemented
5. **Linking is one-to-one** - No bulk operations for entity linking
6. **Client-side filtering** - Many "filters" must be applied after fetching all data

## Performance Implications

- **list-features**: Now fetches ALL features when filtering by product (no server-side limit)
- **list-products**: Always fetches ALL products (no pagination available)
- **product-hierarchy**: Makes 2 API calls instead of 1
- Consider implementing caching for frequently accessed data

## Breaking Changes

⚠️ **API Changes** - Tools now expect different parameter names:
- `feature_id` → `featureId` (and similar snake_case → camelCase)
- `note_id` / `feature_ids` → `noteId` / `entityId` (attach-note)
- `objective_id` / `feature_ids` → `featureId` / `objectiveId` (link-features)
- `limit` → pageLimit (still accepts `limit` but maps to `pageLimit`)

Existing callers may need updates if they reference parameters by name.
