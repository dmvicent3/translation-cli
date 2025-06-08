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
  TEST_CONFIG,
  mockEnvVar,
} from './setup.js'

const mockGenerateText = jest.fn()

jest.unstable_mockModule('ai', () => ({
  generateText: mockGenerateText,
}))

jest.unstable_mockModule('@ai-sdk/google', () => ({
  google: jest.fn(() => 'mocked-model'),
}))

const mockPrompt = jest.fn()
jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: mockPrompt,
  },
}))

describe('Translation', () => {
  let translateText, batchTranslate, addTranslation, batchAddTranslations
  let restoreEnv

  beforeEach(async () => {
    await setupTestDir()
    restoreEnv = mockEnvVar('GOOGLE_GENERATIVE_AI_API_KEY', 'test-api-key')

    const translationModule = await import('../src/translation.js')
    translateText = translationModule.translateText
    batchTranslate = translationModule.batchTranslate
    addTranslation = translationModule.addTranslation
    batchAddTranslations = translationModule.batchAddTranslations

    mockGenerateText.mockClear()
    mockPrompt.mockClear()
    mockPrompt.mockResolvedValue({ replace: true })
  })

  afterEach(async () => {
    restoreEnv()
    await cleanupTestDir()
  })

  describe('translateText', () => {
    test('should translate text successfully', async () => {
      mockGenerateText.mockResolvedValue({ text: 'Guardar' })

      const result = await translateText('Save', 'Portuguese', 'English')

      expect(result).toBe('Guardar')
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: 'mocked-model',
        prompt: expect.stringContaining('Save'),
        temperature: 0.3,
      })
    })

    test('should handle translation errors', async () => {
      mockGenerateText.mockRejectedValue(new Error('API Error'))

      const result = await translateText('Save', 'Portuguese', 'English')

      expect(result).toBeNull()
    })

    test('should trim whitespace from translation', async () => {
      mockGenerateText.mockResolvedValue({ text: '  Guardar  ' })

      const result = await translateText('Save', 'Portuguese', 'English')

      expect(result).toBe('Guardar')
    })
  })

  describe('batchTranslate', () => {
    test('should translate multiple texts', async () => {
      mockGenerateText.mockResolvedValue({
        text: '1. Guardar\n2. Cancelar\n3. Submeter',
      })

      const texts = ['Save', 'Cancel', 'Submit']
      const result = await batchTranslate(texts, 'Portuguese', 'English')

      expect(result).toEqual(['Guardar', 'Cancelar', 'Submeter'])
    })

    test('should handle batch translation errors', async () => {
      mockGenerateText.mockRejectedValue(new Error('API Error'))

      const texts = ['Save', 'Cancel']
      const result = await batchTranslate(texts, 'Portuguese', 'English')

      expect(result).toBeNull()
    })
  })

  describe('addTranslation', () => {
    test('should add translation to all languages', async () => {
      mockGenerateText.mockResolvedValue({ text: 'Guardar' })

      await addTranslation('button.save', 'Save', TEST_CONFIG, {
        force: true,
        interactive: false,
      })

      // Should call generateText for non-source languages
      expect(mockGenerateText).toHaveBeenCalled()
    })
  })

  describe('batchAddTranslations', () => {
    test('should add multiple translations', async () => {
      mockGenerateText.mockResolvedValue({
        text: '1. Guardar\n2. Cancelar',
      })

      const translationPairs = [
        { key: 'button.save', text: 'Save' },
        { key: 'button.cancel', text: 'Cancel' },
      ]

      await batchAddTranslations(translationPairs, TEST_CONFIG, {
        force: true,
        interactive: false,
      })

      expect(mockGenerateText).toHaveBeenCalled()
    })
  })
})
