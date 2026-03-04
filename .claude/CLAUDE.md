# CanvasKit

プロジェクト概要・コマンド一覧・ファイルフォーマットは [README.md](../../README.md) を参照。
CLI/MCP の詳細リファレンスは `/canvaskit` スキル を参照。

## Key Patterns

- ESM modules (`"type": "module"`, imports use `.js` extension)
- TypeScript strict mode, target ES2022
- Zod for all validation
- All mutations call `doc.touch()` to update `meta.modified`
- Node IDs: 8-char UUID prefix from `crypto.randomUUID()`
- MCP tools: `ok(data)` / `fail(error)` response pattern
- CLI mutation commands: `withDocument()` で open → mutate → auto-save

## Testing

```bash
npm test              # All tests (740+)
npm run test:coverage # Coverage report
npm run test:unit     # Core + tools only
npm run test:e2e      # CLI smoke tests
npm run test:watch    # Watch mode
```

Framework: Vitest with `@vitest/coverage-v8`
Mocking: `vi.mock('node:fs/promises')` for CanvasManager, `vi.useFakeTimers()` for timestamps

### Test Structure
```
tests/
├── helpers/          # createTestDocument, createTempDir, MCP helpers
├── fixtures/         # JSON fixtures (valid, minimal, refs, invalid)
├── core/             # Unit tests for core modules (~230 tests)
├── tools/            # Unit tests for tools + MCP handlers (~82 tests)
├── services/         # Shared service tests (node-screenshot, terminal-image)
├── export/           # Export module tests (shared, vue-sfc, react-jsx, css-tokens, svg)
├── import/           # Import module tests (figma-mapper, figma)
├── preview/          # Preview server + screenshot tests
├── integration/      # Lifecycle + MCP server tests (~14 tests)
└── e2e/              # CLI smoke tests (~20 tests)
```
