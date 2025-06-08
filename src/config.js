import path from 'path'
import { loadJsonFile } from './utils/file.js'

// Default configuration
export const DEFAULT_CONFIG = {
  langDir: 'lang',
  languages: {
    'pt-pt': 'European Portuguese',
    'pt-br': 'Brazilian Portuguese',
    'es-es': 'Spanish (Spain)',
    'en-us': 'American English',
  },
  sourceLanguage: 'pt-pt',
  verification: {
    include: ['src', 'components', 'pages', 'app'],
    exclude: [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.nuxt',
      '.output',
      'public',
      'static',
      'test',
      'tests',
      '__tests__',
    ],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'],
  },
}

export async function loadConfig() {
  const configFiles = [
    '.translation-cli.json',
    'translation-cli.config.json',
    'package.json',
  ]

  for (const configFile of configFiles) {
    try {
      const configPath = path.join(process.cwd(), configFile)
      const data = await loadJsonFile(configPath)

      if (!data) continue

      if (configFile === 'package.json') {
        // Look for translationCli field in package.json
        if (data.translationCli) {
          return { ...DEFAULT_CONFIG, ...data.translationCli }
        }
      } else {
        return { ...DEFAULT_CONFIG, ...data }
      }
    } catch {
      // Continue to next config file
    }
  }

  return DEFAULT_CONFIG
}

export function validateConfig(config) {
  if (!config.languages[config.sourceLanguage]) {
    throw new Error(
      `Source language "${config.sourceLanguage}" is not defined in the languages list`
    )
  }

  return config
}
