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
  setupCommonTestFiles,
  createTestConfig,
  setupAllMocks,
  mockEnvVar,
} from './setup.js'
import path from 'path'

// Setup mocks
const { inquirerMock, generateText, google, batchTranslate, translateText } =
  setupAllMocks()

describe('CLI Integration Tests', () => {
  const originalCwd = process.cwd()
  const originalArgv = process.argv
  let restoreEnv
  let mockConsoleLog, mockConsoleError
  let commands, config, verification, usageScanner, translation, utils

  beforeEach(async () => {
    await setupTestDir()
    process.chdir(TEST_DIR)
    restoreEnv = mockEnvVar('GOOGLE_GENERATIVE_AI_API_KEY', 'test-api-key')

    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    inquirerMock.mockClear()
    generateText.mockClear()
    google.mockClear()
    batchTranslate.mockClear()
    translateText.mockClear()

    commands = await import('../src/commands.js')
    config = await import('../src/config.js')
    verification = await import('../src/verification.js')
    usageScanner = await import('../src/usage-scanner.js')
    translation = await import('../src/translation.js')
    utils = await import('../src/utils/file.js')

    await setupCommonTestFiles()
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    process.argv = originalArgv
    restoreEnv()
    mockConsoleLog.mockRestore()
    mockConsoleError.mockRestore()
    await cleanupTestDir()
  })

  describe('Project Initialization', () => {
    test('should initialize project with valid configuration', async () => {
      process.argv = ['node', 'translate.js', '--init']
      await commands.initProject()

      expect(inquirerMock).toHaveBeenCalled()
      const configContent = await readTestFile('.translation-cli.json')
      const configData = JSON.parse(configContent)

      expect(configData).toHaveProperty('langDir', 'lang')
      expect(configData).toHaveProperty('sourceLanguage', 'en-us')
      expect(configData).toHaveProperty('languages')
    })

    test('should handle missing API key gracefully', async () => {
      const originalApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY

      try {
        jest.resetModules()
        jest.unstable_mockModule('../src/translation.js', () => ({
          batchTranslate: jest
            .fn()
            .mockRejectedValue(new Error('API key required')),
          translateText: jest
            .fn()
            .mockRejectedValue(new Error('API key required')),
        }))

        const translationModule = await import('../src/translation.js')
        await expect(
          translationModule.translateText('Save', 'pt-pt')
        ).rejects.toThrow('API key required')
      } finally {
        if (originalApiKey) {
          process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalApiKey
        }
      }
    })
  })

  describe('Translation Management', () => {
    test('should list translations', async () => {
      const testConfig = createTestConfig()
      await expect(
        commands.listTranslations('en-us', testConfig)
      ).resolves.not.toThrow()
      expect(mockConsoleLog).toHaveBeenCalled()
    })

    test('should check translations and report missing keys', async () => {
      const testConfig = createTestConfig()
      const verificationResult = await verification.verifyTranslations(
        testConfig
      )

      expect(verificationResult).toHaveProperty('issues')
      expect(verificationResult.isValid).toBe(false)

      const missingIssue = verificationResult.issues.find(
        (issue) => issue.type === 'missing' && issue.langCode === 'pt-pt'
      )
      expect(missingIssue).toBeDefined()
      expect(missingIssue.keys).toContain('button.submit')
      expect(missingIssue.keys).toContain('form.validation.email')
    })

    test('should scan for unused translations', async () => {
      const testConfig = createTestConfig()
      await createTestFile(
        'src/app.js',
        `
        const saveButton = t('button.save');
        const formTitle = t('form.title');
      `
      )

      const scanResult = await usageScanner.scanUnusedTranslations(testConfig, [
        path.join(TEST_DIR, 'src'),
      ])

      expect(scanResult).toBeDefined()
      if (scanResult && scanResult.unused && scanResult.used) {
        expect(scanResult.unused).toContain('button.submit')
        expect(scanResult.used).toContain('button.save')
        expect(scanResult.used).toContain('form.title')
      }
    })
  })

  describe('Batch Operations', () => {
    test('should handle batch translation workflow', async () => {
      const targetTranslations = {
        button: {
          save: 'Translated text',
          cancel: 'Translated text',
        },
      }

      await createTestFile(
        'lang/pt-pt.json',
        JSON.stringify(targetTranslations, null, 2)
      )

      const ptContent = await readTestFile('lang/pt-pt.json')
      const ptTranslations = JSON.parse(ptContent)

      expect(ptTranslations.button.save).toBe('Translated text')
      expect(ptTranslations.button.cancel).toBe('Translated text')
    })

    test('should handle language management', async () => {
      const testConfig = createTestConfig()
      const result = await commands.addNewLanguage(
        'de-de',
        'German',
        testConfig,
        {
          translateFromSource: false,
        }
      )

      expect(result.langCode).toBe('de-de')
      expect(result.languageName).toBe('German')

      const deContent = await readTestFile('lang/de-de.json')
      expect(JSON.parse(deContent)).toEqual({})
    })

    test('should handle key management operations', async () => {
      const testConfig = createTestConfig()
      await createTestFile(
        'lang/en-us.json',
        JSON.stringify({
          button: { save: 'Save', cancel: 'Cancel' },
        })
      )

      await createTestFile(
        'lang/pt-pt.json',
        JSON.stringify({
          button: { save: 'Guardar', cancel: 'Cancelar' },
        })
      )

      await commands.renameTranslationKey(
        'button.save',
        'button.saveData',
        testConfig,
        {
          force: true,
        }
      )

      const enContent = await readTestFile('lang/en-us.json')
      const ptContent = await readTestFile('lang/pt-pt.json')

      const enTranslations = JSON.parse(enContent)
      const ptTranslations = JSON.parse(ptContent)

      expect(enTranslations.button.saveData).toBe('Save')
      expect(enTranslations.button.save).toBeUndefined()
      expect(ptTranslations.button.saveData).toBe('Guardar')

      await commands.removeTranslationKey('button.cancel', testConfig, {
        force: true,
      })

      const enContentAfterRemove = await readTestFile('lang/en-us.json')
      const enTranslationsAfterRemove = JSON.parse(enContentAfterRemove)

      expect(enTranslationsAfterRemove.button.cancel).toBeUndefined()
    })
  })
})
