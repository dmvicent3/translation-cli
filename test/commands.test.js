import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals'
import {
  setupTestDir,
  cleanupTestDir,
  createTestFile,
  readTestFile,
  TEST_DIR,
  SAMPLE_TRANSLATIONS,
  createInquirerMock,
  createAIMocks,
  setupCommonTestFiles,
  createTestConfig,
} from './setup.js'

// Setup mocks
const inquirerMock = createInquirerMock()
const aiMocks = createAIMocks()

jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: inquirerMock,
    Separator: class Separator {
      constructor(message = '') {
        this.type = 'separator'
        this.line = message
      }
    },
  },
}))

jest.unstable_mockModule('ai', () => ({
  generateText: aiMocks.generateText,
}))

jest.unstable_mockModule('@ai-sdk/google', () => ({
  google: aiMocks.google,
}))

jest.unstable_mockModule('../src/translation.js', () => ({
  batchTranslate: aiMocks.batchTranslate,
  translateText: aiMocks.translateText,
}))

describe('Commands', () => {
  const originalCwd = process.cwd()
  let listTranslations, initProject, parseTranslationInput
  let generateMissingKeysJSON
  let renameTranslationKey, removeTranslationKey, addNewLanguage
  let testConfig

  beforeEach(async () => {
    await setupTestDir()
    process.chdir(TEST_DIR)

    testConfig = createTestConfig()

    const commandsModule = await import('../src/commands.js')
    listTranslations = commandsModule.listTranslations
    initProject = commandsModule.initProject
    parseTranslationInput = commandsModule.parseTranslationInput
    generateMissingKeysJSON = commandsModule.generateMissingKeysJSON
    renameTranslationKey = commandsModule.renameTranslationKey
    removeTranslationKey = commandsModule.removeTranslationKey
    addNewLanguage = commandsModule.addNewLanguage

    await setupCommonTestFiles()

    // Reset mocks between tests
    inquirerMock.mockClear()
    Object.values(aiMocks).forEach((mock) => mock.mockClear())
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await cleanupTestDir()
  })

  describe('listTranslations', () => {
    test('should list existing translations', async () => {
      await expect(listTranslations('en-us', testConfig)).resolves.not.toThrow()
    })
  })

  describe('initProject', () => {
    test('should create configuration file', async () => {
      await initProject()

      const configContent = await readTestFile('.translation-cli.json')
      const config = JSON.parse(configContent)

      expect(config).toHaveProperty('langDir')
      expect(config).toHaveProperty('sourceLanguage')
      expect(config).toHaveProperty('languages')

      // Verify inquirer was called with the expected questions
      expect(inquirerMock).toHaveBeenCalled()

      // Check that the config has the expected values
      expect(config.langDir).toBe('lang')
      expect(config.sourceLanguage).toBe('en-us')
      expect(config.languages).toHaveProperty('en-us')
      expect(config.languages).toHaveProperty('pt-pt')
    })
  })

  describe('parseTranslationInput', () => {
    test('should parse flat JSON correctly', () => {
      const input = JSON.stringify({
        'button.save': 'Save',
        'button.cancel': 'Cancel',
        'form.validation.required': 'This field is required',
      })

      const result = parseTranslationInput(input)

      expect(result).toEqual([
        { key: 'button.save', text: 'Save' },
        { key: 'button.cancel', text: 'Cancel' },
        { key: 'form.validation.required', text: 'This field is required' },
      ])
    })

    test('should parse nested JSON correctly', () => {
      const input = JSON.stringify({
        button: {
          save: 'Save',
          cancel: 'Cancel',
        },
        form: {
          validation: {
            required: 'This field is required',
          },
        },
      })

      const result = parseTranslationInput(input)

      expect(result).toEqual([
        { key: 'button.save', text: 'Save' },
        { key: 'button.cancel', text: 'Cancel' },
        { key: 'form.validation.required', text: 'This field is required' },
      ])
    })

    test('should skip non-string values', () => {
      const input = JSON.stringify({
        'valid.key': 'Valid text',
        'number.key': 123,
        'boolean.key': true,
        'null.key': null,
        'empty.key': '',
        'whitespace.key': '   ',
      })

      const result = parseTranslationInput(input)

      expect(result).toEqual([{ key: 'valid.key', text: 'Valid text' }])
    })

    test('should throw error for invalid JSON', () => {
      const input = '{ invalid json }'

      expect(() => parseTranslationInput(input)).toThrow('Invalid JSON format')
    })

    test('should skip invalid key formats', () => {
      const input = JSON.stringify({
        'valid.key': 'Valid',
        'invalid key with spaces': 'Invalid',
        'another.valid.key': 'Valid',
      })

      const result = parseTranslationInput(input)

      expect(result).toEqual([
        { key: 'valid.key', text: 'Valid' },
        { key: 'another.valid.key', text: 'Valid' },
      ])
    })
  })

  describe('generateMissingKeysJSON', () => {
    test('should generate JSON for missing keys', async () => {
      const json = await generateMissingKeysJSON(testConfig, 'pt-pt')

      expect(json).toHaveProperty('button.submit', 'Submit')
      expect(json).toHaveProperty(
        'form.validation.email',
        'Please enter a valid email'
      )
      expect(json).toHaveProperty('welcome.title', 'Welcome')
      expect(json).toHaveProperty(
        'welcome.message',
        'Welcome to our application'
      )
    })

    test('should return empty object when no missing keys', async () => {
      // Create complete pt-pt translations
      await createTestFile(
        'lang/pt-pt.json',
        JSON.stringify(SAMPLE_TRANSLATIONS['en-us'])
      )

      const json = await generateMissingKeysJSON(testConfig, 'pt-pt')

      expect(json).toEqual({})
    })

    test('should generate nested JSON structure', async () => {
      const json = await generateMissingKeysJSON(testConfig, 'pt-pt')

      // Should maintain nested structure
      expect(json).toHaveProperty('button.submit', 'Submit')
      expect(json).toHaveProperty(
        'form.validation.email',
        'Please enter a valid email'
      )
      expect(json).toHaveProperty('welcome.title', 'Welcome')
      expect(json).toHaveProperty(
        'welcome.message',
        'Welcome to our application'
      )
    })
  })

  describe('renameTranslationKey', () => {
    test('should rename key across all languages', async () => {
      await renameTranslationKey('button.save', 'button.saveData', testConfig, {
        force: true,
      })

      const enContent = await readTestFile('lang/en-us.json')
      const ptContent = await readTestFile('lang/pt-pt.json')

      const enTranslations = JSON.parse(enContent)
      const ptTranslations = JSON.parse(ptContent)

      expect(enTranslations.button.saveData).toBe('Save')
      expect(enTranslations.button.save).toBeUndefined()

      expect(ptTranslations.button.saveData).toBe('Guardar')
      expect(ptTranslations.button.save).toBeUndefined()
    })

    test('should throw error for non-existent key', async () => {
      await expect(
        renameTranslationKey('nonexistent.key', 'new.key', testConfig)
      ).rejects.toThrow('Translation key "nonexistent.key" does not exist')
    })

    test('should throw error when new key exists without force', async () => {
      await expect(
        renameTranslationKey('button.save', 'button.cancel', testConfig)
      ).rejects.toThrow('Translation key "button.cancel" already exists')
    })
  })

  describe('removeTranslationKey', () => {
    test('should remove key from all languages', async () => {
      await removeTranslationKey('button.save', testConfig, { force: true })

      const enContent = await readTestFile('lang/en-us.json')
      const ptContent = await readTestFile('lang/pt-pt.json')

      const enTranslations = JSON.parse(enContent)
      const ptTranslations = JSON.parse(ptContent)

      expect(enTranslations.button.save).toBeUndefined()
      expect(ptTranslations.button.save).toBeUndefined()

      // Other keys should remain
      expect(enTranslations.button.cancel).toBe('Cancel')
      expect(ptTranslations.button.cancel).toBe('Cancelar')
    })

    test('should throw error for non-existent key', async () => {
      await expect(
        removeTranslationKey('nonexistent.key', testConfig)
      ).rejects.toThrow('Translation key "nonexistent.key" does not exist')
    })
  })

  describe('addNewLanguage', () => {
    test('should create new language file and update config', async () => {
      const result = await addNewLanguage('de-de', 'German', testConfig, {
        translateFromSource: false,
      })

      expect(result.langCode).toBe('de-de')
      expect(result.languageName).toBe('German')
      expect(result.translated).toBe(false)

      const deContent = await readTestFile('lang/de-de.json')
      expect(JSON.parse(deContent)).toEqual({})
    })

    test('should throw error for existing language in config', async () => {
      await expect(
        addNewLanguage('en-us', 'English', testConfig, {
          translateFromSource: false,
        })
      ).rejects.toThrow('already exists in configuration')
    })

    test('should validate language code format', async () => {
      await expect(
        addNewLanguage('invalid-code', 'Invalid', testConfig)
      ).rejects.toThrow('Invalid language code format')
    })
  })
})
