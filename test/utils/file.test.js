import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import {
  ensureDir,
  loadJsonFile,
  saveJsonFile,
  loadTranslations,
  saveTranslations,
  readFile,
} from '../../src/utils/file.js'
import {
  setupTestDir,
  cleanupTestDir,
  createTestFile,
  TEST_DIR,
} from '../setup.js'
import path from 'path'
import fs from 'fs/promises'

describe('File Utils', () => {
  beforeEach(async () => {
    await setupTestDir()
  })

  afterEach(async () => {
    await cleanupTestDir()
  })

  describe('ensureDir', () => {
    test('should create directory if it does not exist', async () => {
      const dirPath = path.join(TEST_DIR, 'new-dir')
      await ensureDir(dirPath)

      // Check if directory was created
      await expect(fs.access(dirPath)).resolves.not.toThrow()
    })

    test('should not throw if directory already exists', async () => {
      const dirPath = path.join(TEST_DIR, 'existing-dir')
      await fs.mkdir(dirPath, { recursive: true })

      await expect(ensureDir(dirPath)).resolves.not.toThrow()
    })
  })

  describe('loadJsonFile', () => {
    test('should load valid JSON file', async () => {
      const testData = { test: 'value', nested: { key: 'data' } }
      await createTestFile('test.json', JSON.stringify(testData))

      const result = await loadJsonFile(path.join(TEST_DIR, 'test.json'))
      expect(result).toEqual(testData)
    })

    test('should return null for non-existent file', async () => {
      const result = await loadJsonFile(
        path.join(TEST_DIR, 'non-existent.json')
      )
      expect(result).toBeNull()
    })

    test('should throw for invalid JSON', async () => {
      await createTestFile('invalid.json', '{ invalid json }')

      await expect(
        loadJsonFile(path.join(TEST_DIR, 'invalid.json'))
      ).rejects.toThrow()
    })
  })

  describe('saveJsonFile', () => {
    test('should save JSON file with proper formatting', async () => {
      const testData = { test: 'value', nested: { key: 'data' } }
      const filePath = path.join(TEST_DIR, 'output.json')

      await saveJsonFile(filePath, testData)

      const content = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(content)

      expect(parsed).toEqual(testData)
      expect(content).toContain('  ') // Check for proper indentation
    })
  })

  describe('loadTranslations', () => {
    test('should load existing translation file', async () => {
      const translations = { button: { save: 'Save' } }
      await createTestFile('lang/en-us.json', JSON.stringify(translations))

      const result = await loadTranslations(
        'en-us',
        path.join(TEST_DIR, 'lang')
      )
      expect(result).toEqual(translations)
    })

    test('should return empty object for non-existent file', async () => {
      const result = await loadTranslations(
        'fr-fr',
        path.join(TEST_DIR, 'lang')
      )
      expect(result).toEqual({})
    })
  })

  describe('saveTranslations', () => {
    test('should save translations with proper formatting', async () => {
      const translations = { button: { save: 'Save', cancel: 'Cancel' } }
      const langDir = path.join(TEST_DIR, 'isolated-lang')

      await fs.mkdir(langDir, { recursive: true })

      await saveTranslations('test-lang', translations, langDir)

      const result = await loadTranslations('test-lang', langDir)
      expect(result).toEqual(translations)
    })
  })

  describe('readFile', () => {
    test('should read file content', async () => {
      const content = 'test file content'
      await createTestFile('test.txt', content)

      const result = await readFile(path.join(TEST_DIR, 'test.txt'))
      expect(result).toBe(content)
    })
  })
})
