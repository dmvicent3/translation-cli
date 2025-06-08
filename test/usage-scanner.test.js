import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import {
  setupTestDir,
  cleanupTestDir,
  createTestFile,
  TEST_DIR,
  TEST_CONFIG,
} from './setup.js'
import path from 'path'

describe('Usage Scanner', () => {
  let scanUnusedTranslations
  let testConfig

  beforeEach(async () => {
    await setupTestDir()

    testConfig = {
      ...TEST_CONFIG,
      langDir: path.join(TEST_DIR, 'lang'),
    }

    const usageScannerModule = await import('../src/usage-scanner.js')
    scanUnusedTranslations = usageScannerModule.scanUnusedTranslations

    await createTestFile(
      'lang/en-us.json',
      JSON.stringify({
        button: {
          save: 'Save',
          cancel: 'Cancel',
          submit: 'Submit',
          unused: 'Unused Button',
        },
        form: {
          validation: {
            required: 'Required',
            email: 'Invalid email',
          },
        },
        unused: {
          key: 'Unused translation',
        },
      })
    )

    await createTestFile(
      'src/components/Button.js',
      `
      import { t } from 'i18n'
      
      export function SaveButton() {
        return <button>{t('button.save')}</button>
      }
      
      export function CancelButton() {
        return <button>{t("button.cancel")}</button>
      }
    `
    )

    await createTestFile(
      'src/components/Form.jsx',
      `
      import { useTranslation } from 'react-i18n'
      
      export function ValidationMessage({ field }) {
        const { t } = useTranslation()
        
        if (!field.value) {
          return <span>{t('form.validation.required')}</span>
        }
        
        if (field.type === 'email' && !isValid(field.value)) {
          return <span>{t(\`form.validation.email\`)}</span>
        }
        
        return null
      }
    `
    )

    await createTestFile(
      'src/pages/Home.vue',
      `
      <template>
        <div>
          <button @click="submit">{{ $t('button.submit') }}</button>
        </div>
      </template>
    `
    )

    await createTestFile(
      'src/utils/helpers.js',
      `
      export function formatDate(date) {
        return date.toLocaleDateString()
      }
    `
    )
  })

  afterEach(async () => {
    await cleanupTestDir()
  })

  describe('scanUnusedTranslations', () => {
    test('should identify used and unused translation keys', async () => {
      const result = await scanUnusedTranslations(testConfig, {
        scanDir: path.join(TEST_DIR, 'src'),
      })

      expect(result.usedKeys).toContain('button.save')
      expect(result.usedKeys).toContain('button.cancel')
      expect(result.usedKeys).toContain('button.submit')
      expect(result.usedKeys).toContain('form.validation.required')
      expect(result.usedKeys).toContain('form.validation.email')

      expect(result.unusedKeys).toContain('button.unused')
      expect(result.unusedKeys).toContain('unused.key')

      expect(result.totalKeys).toBe(7)
      expect(result.usedKeys.length).toBe(5)
      expect(result.unusedKeys.length).toBe(2)
      expect(result.usageRate).toBeCloseTo(71.4, 1)
    })

    test('should handle different file extensions', async () => {
      const result = await scanUnusedTranslations(testConfig, {
        scanDir: path.join(TEST_DIR, 'src'),
        extensions: ['.js', '.jsx', '.vue'],
      })

      expect(result.scannedFiles).toBe(4)
    })

    test('should ignore specified directories', async () => {
      await createTestFile(
        'src/node_modules/package/index.js',
        `
        t('should.not.be.found')
      `
      )

      const result = await scanUnusedTranslations(testConfig, {
        scanDir: path.join(TEST_DIR, 'src'),
        ignoreDirs: ['node_modules'],
      })

      expect(result.usedKeys).not.toContain('should.not.be.found')
    })

    test('should handle dynamic keys correctly', async () => {
      await createTestFile(
        'src/dynamic.js',
        `
        // These should not be detected as they contain variables
        t(\`dynamic.\${variable}.key\`)
        t('dynamic.' + variable + '.key')
        t('dynamic.{{variable}}.key')
        
        // This should be detected
        t('static.key')
      `
      )

      await createTestFile(
        'lang/en-us.json',
        JSON.stringify({
          static: { key: 'Static' },
          dynamic: { variable: { key: 'Dynamic' } },
        })
      )

      const result = await scanUnusedTranslations(testConfig, {
        scanDir: path.join(TEST_DIR, 'src'),
      })

      expect(result.usedKeys).toContain('static.key')
      expect(result.unusedKeys).toContain('dynamic.variable.key')
    })

    test('should handle empty translation files', async () => {
      await createTestFile('lang/en-us.json', JSON.stringify({}))

      const result = await scanUnusedTranslations(testConfig, {
        scanDir: path.join(TEST_DIR, 'src'),
      })

      expect(result.totalKeys).toBe(0)
      expect(result.usedKeys).toHaveLength(0)
      expect(result.unusedKeys).toHaveLength(0)
    })

    test('should track key usage in files', async () => {
      const result = await scanUnusedTranslations(testConfig, {
        scanDir: path.join(TEST_DIR, 'src'),
      })

      expect(result.keyUsageMap.has('button.save')).toBe(true)

      const usageFiles = result.keyUsageMap.get('button.save')
      const normalizedFiles = usageFiles.map((file) => file.replace(/\\/g, '/'))
      expect(normalizedFiles).toContain('components/Button.js')
    })
  })
})
