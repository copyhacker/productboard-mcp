# Test Updates Needed for API Parameter Fixes

## Overview
After fixing API parameters to match Productboard API v1 spec, the following test files need updates to match the new implementation.

## Test Files Requiring Updates

### 1. tests/unit/tools/features/list-features.test.ts
**Changes needed:**
- Update calls to expect `parent.id` instead of `product_id` or `component_id`
- Update pagination: `{ pageLimit: 100 }` instead of `{}`
- Tests should verify client-side filtering for status, owner, search, tags

**Example fix:**
```typescript
// Old:
expect(mockClient.get).toHaveBeenCalledWith('/features', {
  product_id: 'prod-1'
});

// New:
expect(mockClient.get).toHaveBeenCalledWith('/features', {
  'parent.id': 'prod-1',
  pageLimit: 100
});
```

### 2. tests/unit/tools/notes/list-notes.test.ts
**Changes needed:**
- Change all snake_case params to camelCase (feature_id → featureId)
- Update pagination: limit → pageLimit, add pageCursor support
- Remove customer_email, company_name (now ownerEmail, companyId)
- Add new params: anyTag, allTags, term, createdFrom/To, updatedFrom/To

**Example fix:**
```typescript
// Old:
expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
  method: 'GET',
  endpoint: '/notes',
  params: { feature_id: 'feat-1', limit: 20 }
});

// New:
expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
  method: 'GET',
  endpoint: '/notes',
  params: { featureId: 'feat-1', pageLimit: 20 }
});
```

### 3. tests/unit/tools/notes/attach-note.test.ts
**Changes needed:**
- Update endpoint from `/notes/${id}/attach` to `/notes/${noteId}/links/${entityId}`
- Change from bulk (feature_ids array) to single entity (noteId, entityId)
- Update parameter names to camelCase

**Example fix:**
```typescript
// Old:
await tool.execute({
  note_id: 'note-1',
  feature_ids: ['feat-1', 'feat-2']
});
expect(mockClient.post).toHaveBeenCalledWith('/notes/note-1/attach', {
  feature_ids: ['feat-1', 'feat-2']
});

// New:
await tool.execute({
  noteId: 'note-1',
  entityId: 'feat-1'
});
expect(mockClient.post).toHaveBeenCalledWith('/notes/note-1/links/feat-1', {});
```

### 4. tests/unit/tools/objectives/link-features.test.ts
**Changes needed:**
- Update endpoint from `/objectives/${id}/features` to `/features/${featureId}/links/objectives/${objectiveId}`
- Change from bulk to single linking
- Update parameter names to camelCase

**Example fix:**
```typescript
// Old:
await tool.execute({
  objective_id: 'obj-1',
  feature_ids: ['feat-1', 'feat-2']
});
expect(mockClient.post).toHaveBeenCalledWith('/objectives/obj-1/features', {
  feature_ids: ['feat-1', 'feat-2']
});

// New:
await tool.execute({
  featureId: 'feat-1',
  objectiveId: 'obj-1'
});
expect(mockClient.post).toHaveBeenCalledWith('/features/feat-1/links/objectives/obj-1', {});
```

### 5. tests/unit/tools/objectives/list-keyresults.test.ts
**Changes needed:**
- Update endpoint from `/keyresults` to `/key-results`
- Update pagination: limit/offset → pageLimit/pageCursor

### 6. tests/unit/tools/objectives/create-keyresult.test.ts
**Changes needed:**
- Update endpoint from `/keyresults` to `/key-results`

### 7. tests/unit/tools/objectives/update-keyresult.test.ts
**Changes needed:**
- Update endpoint from `/keyresults/{id}` to `/key-results/{id}`

### 8. tests/unit/tools/objectives/list-objectives.test.ts
**Changes needed:**
- Update pagination: limit/offset → pageLimit/pageCursor

### 9. tests/unit/tools/releases/list-releases.test.ts
**Changes needed:**
- Update pagination: limit/offset → pageLimit/pageCursor

### 10. tests/unit/tools/products/list-products.test.ts
**Changes needed:**
- Remove query parameters from API calls (API doesn't accept them)
- Tests should verify client-side filtering for parent_id and archived

**Example fix:**
```typescript
// Old:
expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
  method: 'GET',
  endpoint: '/products',
  params: { parent_id: 'prod-1' }
});

// New:
expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
  method: 'GET',
  endpoint: '/products'
});
// Then verify client-side filtering in response
```

### 11. tests/unit/tools/products/product-hierarchy.test.ts
**Changes needed:**
- Complete rewrite - endpoint `/products/hierarchy` doesn't exist
- Now fetches `/products` and `/components` separately
- Tests should mock both endpoints
- Verify hierarchy is built client-side

**Example structure:**
```typescript
it('should build hierarchy from products and components', async () => {
  mockClient.get.mockResolvedValueOnce({ data: [mockProduct] }); // /products
  mockClient.get.mockResolvedValueOnce({ data: [mockComponent] }); // /components

  const result = await tool.execute({});

  expect(mockClient.get).toHaveBeenCalledWith('/products');
  expect(mockClient.get).toHaveBeenCalledWith('/components');
  // Verify hierarchy structure in result
});
```

### 12. tests/unit/tools/search/global-search.test.ts
**Changes needed:**
- Remove `params: { limit: 100 }` from `/features` call

### 13. Integration tests
**Files:**
- tests/integration/tools/features/feature-tools.integration.test.ts
- tests/integration/mcp-tools-comprehensive.test.ts

**Changes:** Same as unit tests above

## Test Execution Summary

Current status after fixes:
- **Total tests:** 980
- **Passing:** 935
- **Failing:** 45 (all in the files listed above)

## Quick Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/tools/features/list-features.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Priority Order for Fixes

1. **High Priority** (Core functionality):
   - list-features.test.ts
   - list-notes.test.ts
   - product-hierarchy.test.ts

2. **Medium Priority** (Common operations):
   - attach-note.test.ts
   - link-features.test.ts
   - list-products.test.ts

3. **Low Priority** (Less frequently used):
   - list-objectives.test.ts
   - list-keyresults.test.ts
   - list-releases.test.ts
   - create/update-keyresult.test.ts
   - global-search.test.ts
