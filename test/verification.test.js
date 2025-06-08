import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import {
  setupTestDir,
  cleanupTestDir,
  createTestFile,
  TEST_DIR,
  TEST_CONFIG,
} from './setup.js'
import path from 'path'

describe('Verification', () => {
  let verifyTranslations,
    generateMissingTranslationsReport,
    findIncompleteTranslations
  let testConfig

  beforeEach(async () => {
    await setupTestDir()

    testConfig = {
      ...TEST_CONFIG,
      langDir: path.join(TEST_DIR, 'lang'),
    }

    const verificationModule = await import('../src/verification.js')
    verifyTranslations = verificationModule.verifyTranslations
    generateMissingTranslationsReport =
      verificationModule.generateMissingTranslationsReport
    findIncompleteTranslations = verificationModule.findIncompleteTranslations

    await createTestFile(
      'lang/en-us.json',
      JSON.stringify({
        button: { save: 'Save', cancel: 'Cancel' },
        form: { validation: { required: 'Required' } },
      })
    )

    await createTestFile(
      'lang/pt-pt.json',
      JSON.stringify({
        button: { save: 'Guardar' },
        form: { validation: { required: 'Obrigatório' } },
      })
    )

    await createTestFile(
      'lang/es-es.json',
      JSON.stringify({
        button: { save: 'Guardar', cancel: 'Cancelar' },
        extra: { key: 'Extra' },
      })
    )
  })

  afterEach(async () => {
    await cleanupTestDir()
  })

  describe('verifyTranslations', () => {
    test('should identify missing translations', async () => {
      const result = await verifyTranslations(testConfig)

      expect(result.isValid).toBe(false)

      const missingIssue = result.issues.find(
        (issue) => issue.type === 'missing' && issue.langCode === 'pt-pt'
      )
      expect(missingIssue).toBeDefined()
      expect(missingIssue.keys).toContain('button.cancel')
    })

    test('should identify extra translations', async () => {
      await createTestFile(
        'lang/test-extra/en-us.json',
        JSON.stringify({
          common: { hello: 'Hello' },
        })
      )

      await createTestFile(
        'lang/test-extra/es-es.json',
        JSON.stringify({
          common: { hello: 'Hola' },
          extra: { onlyInSpanish: 'Solo en español' },
        })
      )

      const extraTestConfig = {
        ...testConfig,
        langDir: path.join(TEST_DIR, 'lang/test-extra'),
        languages: {
          'en-us': 'English',
          'es-es': 'Spanish',
        },
      }

      const result = await verifyTranslations(extraTestConfig)

      expect(result.issues.some((issue) => issue.type === 'missing')).toBe(true)

      expect(result.isValid).toBe(false)

      const allKeys = await import('../src/verification.js').then((m) =>
        m.getAllKeys(extraTestConfig)
      )
      expect(allKeys).toContain('extra.onlyInSpanish')
    })

    test('should return valid when all translations are consistent', async () => {
      await createTestFile(
        'lang/en-us.json',
        JSON.stringify({
          button: { save: 'Save' },
        })
      )
      await createTestFile(
        'lang/pt-pt.json',
        JSON.stringify({
          button: { save: 'Guardar' },
        })
      )
      await createTestFile(
        'lang/es-es.json',
        JSON.stringify({
          button: { save: 'Guardar' },
        })
      )

      const result = await verifyTranslations(testConfig)

      expect(result.isValid).toBe(true)
      expect(result.issues).toHaveLength(0)
    })
  })

  describe('generateMissingTranslationsReport', () => {
    test('should generate completeness report', async () => {
      const report = await generateMissingTranslationsReport(testConfig)

      expect(report.totalKeys).toBeGreaterThan(0)
      expect(report.languages).toHaveProperty('en-us')
      expect(report.languages).toHaveProperty('pt-pt')
      expect(report.languages).toHaveProperty('es-es')

      const ptCompleteness = Number.parseFloat(
        report.languages['pt-pt'].completeness
      )
      expect(ptCompleteness).toBeGreaterThan(0)
      expect(ptCompleteness).toBeLessThan(100)

      expect(ptCompleteness).toBeCloseTo(50, 5) // Allow for either calculation
    })
  })

  describe('findIncompleteTranslations', () => {
    test('should find translations missing from source language', async () => {
      const result = await findIncompleteTranslations(testConfig)

      expect(result.sourceKeys).toContain('button.save')
      expect(result.sourceKeys).toContain('button.cancel')
      expect(result.sourceKeys).toContain('form.validation.required')

      const ptIncomplete = result.incompleteLanguages.find(
        (lang) => lang.langCode === 'pt-pt'
      )
      expect(ptIncomplete).toBeDefined()
      expect(ptIncomplete.missingKeys).toContain('button.cancel')
    })
  })
})
