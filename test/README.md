# Translation CLI Tests

## Test Structure

```
test/
├── setup.js              # Test setup and utilities
├── utils/
│   ├── file.test.js      # File utility tests
│   └── object.test.js    # Object utility tests
├── config.test.js        # Configuration tests
├── translation.test.js   # Translation logic tests
├── verification.test.js  # Translation verification tests
├── usage-scanner.test.js # Usage scanning tests
├── commands.test.js      # CLI commands tests
├── integration.test.js   # End-to-end integration tests
└── README.md            # This file
```

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

### Specific Test Files

```bash
# Run specific test file
npx jest test/utils/file.test.js

# Run tests matching pattern
npx jest --testNamePattern="should load"
```

## Test Categories

### Unit Tests

- **File Utils**: Test file operations, JSON loading/saving
- **Object Utils**: Test nested object manipulation, flattening
- **Config**: Test configuration loading and validation
- **Translation**: Test AI translation logic (mocked)
- **Verification**: Test translation completeness checking
- **Usage Scanner**: Test unused translation detection
- **Commands**: Test CLI command implementations

### Integration Tests

- **CLI Integration**: Test actual CLI command execution
- **Workflow Integration**: Test complete user workflows

## Test Utilities

### Setup Helpers

```js
import { setupTestDir, cleanupTestDir, createTestFile } from './setup.js'

// Create temporary test directory
await setupTestDir()

// Create test files
await createTestFile('lang/en-us.json', JSON.stringify(translations))

// Clean up after tests
await cleanupTestDir()
```

### Mocking

```js
import { mockEnvVar } from './setup.js'

// Mock environment variables
const restore = mockEnvVar('API_KEY', 'test-key')
// ... test code ...
restore() // Restore original value
```

## Test Data

### Sample Configuration

```js
const TEST_CONFIG = {
  langDir: 'lang',
  sourceLanguage: 'en-us',
  languages: {
    'en-us': 'American English',
    'pt-pt': 'European Portuguese',
    'es-es': 'Spanish (Spain)',
  },
}
```

### Sample Translations

```js
const SAMPLE_TRANSLATIONS = {
  'en-us': {
    button: { save: 'Save', cancel: 'Cancel' },
    form: { validation: { required: 'Required' } },
  },
}
```

## Mocked Dependencies

### AI SDK

The AI translation calls are mocked to avoid API calls during testing:

```js
jest.mock('ai', () => ({
  generateText: jest.fn(),
}))
```

### Example Test Structure

```js
describe('New Feature', () => {
  beforeEach(async () => {
    await setupTestDir()
    // Setup test data
  })

  afterEach(async () => {
    await cleanupTestDir()
  })

  test('should handle normal case', async () => {
    // Test implementation
  })

  test('should handle error case', async () => {
    // Test error handling
  })
})
```
