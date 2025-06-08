import { jest } from '@jest/globals'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}

export const TEST_DIR = path.join(
  path.dirname(__dirname),
  `test-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
)

export async function setupTestDir() {
  try {
    await cleanupTestDir()
    await fs.mkdir(TEST_DIR, { recursive: true })
    await fs.mkdir(path.join(TEST_DIR, 'scripts'), { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

export async function cleanupTestDir() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true })
  } catch (error) {
    // Directory might not exist
  }
}

export async function createTestFile(filePath, content) {
  const fullPath = path.join(TEST_DIR, filePath)
  const dir = path.dirname(fullPath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(fullPath, content, 'utf-8')
  return fullPath
}

export async function readTestFile(filePath) {
  const fullPath = path.join(TEST_DIR, filePath)
  return fs.readFile(fullPath, 'utf-8')
}

export async function fileExists(filePath) {
  try {
    const fullPath = path.join(TEST_DIR, filePath)
    await fs.access(fullPath)
    return true
  } catch {
    return false
  }
}

export function mockEnvVar(key, value) {
  const originalValue = process.env[key]
  process.env[key] = value

  return () => {
    if (originalValue === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalValue
    }
  }
}

export const TEST_CONFIG = {
  langDir: 'lang',
  sourceLanguage: 'en-us',
  languages: {
    'en-us': 'American English',
    'pt-pt': 'European Portuguese',
    'es-es': 'Spanish (Spain)',
  },
}

export const SAMPLE_TRANSLATIONS = {
  'en-us': {
    button: {
      save: 'Save',
      cancel: 'Cancel',
      submit: 'Submit',
    },
    form: {
      validation: {
        required: 'This field is required',
        email: 'Please enter a valid email',
      },
    },
    welcome: {
      title: 'Welcome',
      message: 'Welcome to our application',
    },
  },
  'pt-pt': {
    button: {
      save: 'Guardar',
      cancel: 'Cancelar',
    },
    form: {
      validation: {
        required: 'Este campo é obrigatório',
      },
    },
  },
}

export function createInquirerMock() {
  return jest.fn().mockImplementation((questions) => {
    const firstQuestion = Array.isArray(questions) ? questions[0] : questions

    if (firstQuestion.name === 'apiKey') {
      return Promise.resolve({ apiKey: 'test-api-key' })
    }

    if (firstQuestion.name === 'langDir') {
      return Promise.resolve({ langDir: 'lang' })
    }

    if (firstQuestion.name === 'languages') {
      return Promise.resolve({ languages: ['en-us', 'pt-pt'] })
    }

    if (firstQuestion.name === 'sourceLanguage') {
      return Promise.resolve({ sourceLanguage: 'en-us' })
    }

    if (firstQuestion.name === 'customLangs') {
      return Promise.resolve({ customLangs: 'fr-fr,de-de' })
    }

    return Promise.resolve({})
  })
}

export function createAIMocks() {
  return {
    generateText: jest.fn().mockResolvedValue({ text: 'Hello' }),
    google: jest.fn().mockReturnValue('mocked-model'),
    batchTranslate: jest.fn().mockResolvedValue(['Translated text']),
    translateText: jest.fn().mockResolvedValue('Translated text'),
  }
}

export async function setupCommonTestFiles() {
  await createTestFile(
    'lang/en-us.json',
    JSON.stringify(SAMPLE_TRANSLATIONS['en-us'], null, 2)
  )

  await createTestFile(
    'lang/pt-pt.json',
    JSON.stringify(SAMPLE_TRANSLATIONS['pt-pt'], null, 2)
  )

  await createTestFile(
    '.translation-cli.json',
    JSON.stringify(TEST_CONFIG, null, 2)
  )
}

export async function createMockCliScript(scriptName, scriptContent) {
  const scriptPath = path.join(TEST_DIR, 'scripts', `${scriptName}.js`)
  await fs.writeFile(scriptPath, scriptContent, 'utf-8')
  return scriptPath
}

export function setupAllMocks() {
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

  return {
    inquirerMock,
    ...aiMocks,
  }
}

export function createTestConfig(overrides = {}) {
  return {
    ...TEST_CONFIG,
    langDir: path.join(TEST_DIR, TEST_CONFIG.langDir),
    ...overrides,
  }
}

export function withTimeout(promise, timeoutMs = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Test timeout')), timeoutMs)
    ),
  ])
}
