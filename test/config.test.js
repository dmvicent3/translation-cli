import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import {
  setupTestDir,
  cleanupTestDir,
  createTestFile,
  TEST_DIR,
} from './setup.js'

describe('Config', () => {
  const originalCwd = process.cwd()
  let loadConfig, validateConfig, DEFAULT_CONFIG

  beforeEach(async () => {
    await setupTestDir()
    process.chdir(TEST_DIR)

    const configModule = await import('../src/config.js')
    loadConfig = configModule.loadConfig
    validateConfig = configModule.validateConfig
    DEFAULT_CONFIG = configModule.DEFAULT_CONFIG
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await cleanupTestDir()
  })

  describe('loadConfig', () => {
    test('should return default config when no config file exists', async () => {
      const config = await loadConfig()
      expect(config).toEqual(DEFAULT_CONFIG)
    })

    test('should load from .translation-cli.json', async () => {
      const customConfig = {
        langDir: 'custom-lang',
        sourceLanguage: 'pt-pt',
        languages: {
          'pt-pt': 'Portuguese',
          'en-us': 'English',
        },
      }

      await createTestFile(
        '.translation-cli.json',
        JSON.stringify(customConfig)
      )

      const config = await loadConfig()
      expect(config).toEqual({ ...DEFAULT_CONFIG, ...customConfig })
    })

    test('should load from translation-cli.config.json', async () => {
      const customConfig = {
        langDir: 'i18n',
        sourceLanguage: 'es-es',
        languages: {
          'es-es': 'Spanish',
          'en-us': 'English',
        },
      }

      await createTestFile(
        'translation-cli.config.json',
        JSON.stringify(customConfig)
      )

      const config = await loadConfig()
      expect(config.langDir).toBe('i18n')
      expect(config.sourceLanguage).toBe('es-es')
    })

    test('should load from package.json translationCli field', async () => {
      const packageJson = {
        name: 'test-project',
        translationCli: {
          langDir: 'locales',
          sourceLanguage: 'fr-fr',
          languages: {
            'fr-fr': 'French',
            'en-us': 'English',
          },
        },
      }

      await createTestFile('package.json', JSON.stringify(packageJson))

      const config = await loadConfig()
      expect(config.langDir).toBe('locales')
      expect(config.sourceLanguage).toBe('fr-fr')
    })

    test('should prioritize .translation-cli.json over other configs', async () => {
      await createTestFile(
        '.translation-cli.json',
        JSON.stringify({
          langDir: 'priority-lang',
        })
      )

      await createTestFile(
        'translation-cli.config.json',
        JSON.stringify({
          langDir: 'secondary-lang',
        })
      )

      const config = await loadConfig()
      expect(config.langDir).toBe('priority-lang')
    })
  })

  describe('validateConfig', () => {
    test('should validate valid config', () => {
      const validConfig = {
        langDir: 'lang',
        sourceLanguage: 'en-us',
        languages: {
          'en-us': 'English',
          'pt-pt': 'Portuguese',
        },
      }

      expect(() => validateConfig(validConfig)).not.toThrow()
    })

    test('should throw error if source language not in languages list', () => {
      const invalidConfig = {
        langDir: 'lang',
        sourceLanguage: 'fr-fr',
        languages: {
          'en-us': 'English',
          'pt-pt': 'Portuguese',
        },
      }

      expect(() => validateConfig(invalidConfig)).toThrow(
        'Source language "fr-fr" is not defined in the languages list'
      )
    })
  })
})
