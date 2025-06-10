import path from 'path'
import fs from 'fs/promises'
import {
  saveJsonFile,
  loadTranslations,
  saveTranslations,
  ensureDir,
} from './utils/file.js'
import {
  flattenObject,
  getNestedProperty,
  setNestedProperty,
  sortObjectRecursively,
} from './utils/object.js'
import { DEFAULT_CONFIG } from './config.js'
import inquirer from 'inquirer'

// Language mappings for consistent use throughout the code
const LANGUAGE_MAPPINGS = {
  'en-us': 'American English',
  'en-gb': 'British English',
  'pt-pt': 'European Portuguese',
  'pt-br': 'Brazilian Portuguese',
  'es-es': 'Spanish (Spain)',
  'es-mx': 'Spanish (Latin America)',
  'fr-fr': 'French',
  'de-de': 'German',
  'it-it': 'Italian',
  'nl-nl': 'Dutch',
  'ru-ru': 'Russian',
  'ja-jp': 'Japanese',
  'zh-cn': 'Chinese (Simplified)',
  'ko-kr': 'Korean',
}

// Predefined language choices for the selection menu
const PREDEFINED_LANGUAGES = Object.entries(LANGUAGE_MAPPINGS).map(
  ([code, name]) => ({
    name: `${name} (${code})`,
    value: code,
  })
)

export async function listTranslations(langCode, config) {
  const translations = await loadTranslations(langCode, config.langDir)
  const flatTranslations = flattenObject(translations)

  console.log(`📋 Existing translations in ${langCode}.json:`)
  console.log('')

  if (Object.keys(flatTranslations).length === 0) {
    console.log('   No translations found.')
    return
  }

  Object.entries(flatTranslations).forEach(([key, value]) => {
    console.log(`   ${key}: "${value}"`)
  })
}

export async function initProject() {
  const configPath = path.join(process.cwd(), '.translation-cli.json')

  try {
    // Step 1: API Key
    const hasApiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY

    if (!hasApiKey) {
      console.log(
        '🔑 Google Gemini API key not found in environment variables.'
      )

      const { apiKey } = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiKey',
          message:
            'Enter your Google Gemini API key (get one from https://aistudio.google.com/app/apikey):',
          validate: (input) => {
            if (!input.trim()) return 'API key cannot be empty'
            if (input.includes(' ')) return 'API key should not contain spaces'
            return true
          },
        },
      ])

      // Save API key to .env file
      const envPath = path.join(process.cwd(), '.env')
      let envContent = ''

      try {
        // Check if .env file exists and read it
        envContent = await fs.readFile(envPath, 'utf-8')
      } catch (error) {
        // File doesn't exist, create new one
        envContent = ''
      }

      // Check if API key is already in .env file
      if (!envContent.includes('GOOGLE_GENERATIVE_AI_API_KEY=')) {
        // Add API key to .env file
        envContent += `\nGOOGLE_GENERATIVE_AI_API_KEY=${apiKey}\n`
        await fs.writeFile(envPath, envContent.trim())
        console.log('✅ API key saved to .env file')

        process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey
      } else {
        // Update existing API key in .env file
        envContent = envContent.replace(
          /GOOGLE_GENERATIVE_AI_API_KEY=.*/,
          `GOOGLE_GENERATIVE_AI_API_KEY=${apiKey}`
        )
        await fs.writeFile(envPath, envContent.trim())
        console.log('✅ Updated API key in .env file')

        process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey
      }
    }

    // Step 2: Languages Folder Path
    const { langDir } = await inquirer.prompt([
      {
        type: 'input',
        name: 'langDir',
        message:
          'Enter the path to your languages folder (e.g., src/lang, locales):',
        default: 'lang',
        validate: (input) => {
          if (!input.trim()) return 'Path cannot be empty'
          if (input.includes(' ')) return 'Path should not contain spaces'
          return true
        },
      },
    ])

    // Check if directory exists and scan for existing language files
    const langDirPath = path.join(process.cwd(), langDir)
    let existingLanguages = []
    let customLanguages = []

    try {
      await fs.access(langDirPath)
      // Directory exists, scan for language files
      const files = await fs.readdir(langDirPath)
      existingLanguages = files
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''))

      if (existingLanguages.length > 0) {
        console.log(
          `📂 Found ${existingLanguages.length} existing language files in ${langDir}`
        )
      }
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(langDirPath, { recursive: true })
      console.log(`📂 Created languages directory: ${langDir}`)
    }

    // Step 3: Languages to Add
    const customLangChoices = existingLanguages
      .filter((lang) => !PREDEFINED_LANGUAGES.some((pl) => pl.value === lang))
      .map((lang) => ({
        name: `${lang} (custom)`,
        value: lang,
        custom: true,
      }))

    const { languages } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'languages',
        message: 'Select the languages to add:',
        instructions:
          'Press <space> to select, <a> to toggle all, <i> to invert selection, and <enter> to proceed',
        choices: [
          ...PREDEFINED_LANGUAGES,
          ...(customLangChoices.length > 0
            ? [
                new inquirer.Separator('Custom Languages:'),
                ...customLangChoices,
              ]
            : []),
          new inquirer.Separator(),
          { name: 'Add custom language...', value: 'custom' },
        ],
        default: existingLanguages,
        validate: (input) => {
          if (input.length === 0) return 'Please select at least one language'
          return true
        },
      },
    ])

    // Handle custom language input
    let finalLanguages = languages.filter((lang) => lang !== 'custom')
    if (languages.includes('custom')) {
      const { customLangs } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customLangs',
          message:
            'Enter custom language codes (comma-separated, e.g., ar-sa, hi-in, th-th):',
          validate: (input) => {
            if (!input.trim()) return 'Language codes cannot be empty'
            const codes = input.split(',').map((code) => code.trim())
            if (codes.some((code) => code.includes(' ')))
              return 'Language codes should not contain spaces'
            if (codes.some((code) => !code))
              return 'Empty language codes are not allowed'
            if (codes.some((code) => finalLanguages.includes(code)))
              return 'Some language codes are already selected'
            return true
          },
        },
      ])
      const newLangs = customLangs.split(',').map((code) => code.trim())
      finalLanguages.push(...newLangs)
    }

    // Step 4: Source Language Selection
    const { sourceLanguage } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sourceLanguage',
        message: 'Select the source language:',
        choices: finalLanguages.map((lang) => ({
          name: `${LANGUAGE_MAPPINGS[lang] || lang} (${lang})`,
          value: lang,
        })),
      },
    ])

    // Create config object
    const config = {
      ...DEFAULT_CONFIG,
      langDir,
      sourceLanguage,
      languages: finalLanguages.reduce((acc, lang) => {
        acc[lang] = LANGUAGE_MAPPINGS[lang] || lang
        return acc
      }, {}),
    }

    // Create config file
    await saveJsonFile(configPath, config)
    console.log('✅ Created .translation-cli.json configuration file')
    console.log(
      '📝 Edit this file to customize languages and settings for your project'
    )

    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.log('🔄 Testing API key...')
      try {
        const { generateText } = await import('ai')
        const { google } = await import('@ai-sdk/google')

        await generateText({
          model: google('gemini-1.5-flash'),
          prompt: 'Hello',
          temperature: 0.3,
        })

        console.log('✅ API key is valid!')
      } catch (error) {
        console.error('❌ API key test failed:', error.message)
        console.log('⚠️ Please check your API key and try again')
      }
    }
  } catch (error) {
    throw new Error(`Failed to create configuration file: ${error.message}`)
  }
}

export async function showConfig(config) {
  console.log('🔧 Current Configuration:')
  console.log('')
  console.log(`📂 Language Directory: ${config.langDir}`)
  console.log(
    `🌍 Source Language: ${config.sourceLanguage} (${
      config.languages[config.sourceLanguage]
    })`
  )
  console.log('')
  console.log('📋 Supported Languages:')
  Object.entries(config.languages).forEach(([code, name]) => {
    const marker = code === config.sourceLanguage ? '🔸' : '  '
    console.log(`${marker} ${code}: ${name}`)
  })
}

export function parseTranslationInput(jsonContent) {
  try {
    const data = JSON.parse(jsonContent)
    const pairs = []

    const flatData = flattenObject(data)

    for (const [key, value] of Object.entries(flatData)) {
      if (typeof value === 'string' && value.trim()) {
        if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
          console.warn(`⚠️  Skipping invalid key format: "${key}"`)
          continue
        }
        pairs.push({ key, text: value })
      }
    }

    return pairs
  } catch (error) {
    throw new Error(`Invalid JSON format: ${error.message}`)
  }
}

export async function generateMissingKeysJSON(config, targetLanguage) {
  console.log(
    `🔍 Generating JSON template for missing keys in ${config.languages[targetLanguage]}...`
  )
  console.log(
    `📝 Using ${config.languages[config.sourceLanguage]} as reference`
  )
  console.log('')

  const sourceTranslations = await loadTranslations(
    config.sourceLanguage,
    config.langDir
  )
  const flatSourceTranslations = flattenObject(sourceTranslations)
  const sourceKeys = Object.keys(flatSourceTranslations)

  if (sourceKeys.length === 0) {
    console.log(
      `❌ No translations found in source language (${config.sourceLanguage})`
    )
    return {}
  }

  const targetTranslations = await loadTranslations(
    targetLanguage,
    config.langDir
  )
  const flatTargetTranslations = flattenObject(targetTranslations)
  const targetKeys = new Set(Object.keys(flatTargetTranslations))

  const missingKeys = sourceKeys.filter((key) => !targetKeys.has(key))

  if (missingKeys.length === 0) {
    console.log(
      `✅ No missing keys found for ${config.languages[targetLanguage]}`
    )
    console.log(
      `   All ${sourceKeys.length} keys from source language are present`
    )
    return {}
  }

  const missingTranslations = {}
  missingKeys.forEach((key) => {
    const sourceValue = flatSourceTranslations[key] || ''
    setNestedProperty(missingTranslations, key, sourceValue)
  })

  const sortedMissingTranslations = sortObjectRecursively(missingTranslations)

  console.log(
    `📄 JSON template for ${missingKeys.length} missing keys in ${config.languages[targetLanguage]}:`
  )
  console.log('')
  console.log(JSON.stringify(sortedMissingTranslations, null, 2))
  console.log('')
  console.log(`💡 Instructions:`)
  console.log(`   1. Copy the above content to a JSON file`)
  console.log(
    `   2. Translate the values from ${
      config.languages[config.sourceLanguage]
    } to ${config.languages[targetLanguage]}`
  )
  console.log(`   3. Run: tcli-batch your-file.json`)

  return sortedMissingTranslations
}

function removeNestedProperty(obj, path) {
  const keys = path.split('.')
  const lastKey = keys.pop()
  const target = keys.reduce((current, key) => current?.[key], obj)

  if (target && typeof target === 'object') {
    delete target[lastKey]

    let current = obj
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const nextKey = keys[i + 1]

      if (nextKey) {
        current = current[key]
      } else {
        if (
          current[key] &&
          typeof current[key] === 'object' &&
          Object.keys(current[key]).length === 0
        ) {
          delete current[key]
        }
      }
    }
  }

  return obj
}

export async function renameTranslationKey(
  oldKey,
  newKey,
  config,
  options = {}
) {
  const { force = false } = options

  console.log(`🔄 Renaming translation key: "${oldKey}" → "${newKey}"`)
  console.log(`📂 Language directory: ${config.langDir}`)
  console.log('')

  if (!/^[a-zA-Z0-9._-]+$/.test(newKey)) {
    throw new Error(
      'Invalid new key format. Use alphanumeric characters, dots, hyphens, and underscores only.'
    )
  }

  let keyExists = false
  let newKeyExists = false

  for (const [langCode, languageName] of Object.entries(config.languages)) {
    const translations = await loadTranslations(langCode, config.langDir)

    if (getNestedProperty(translations, oldKey) !== undefined) {
      keyExists = true
    }

    if (getNestedProperty(translations, newKey) !== undefined) {
      newKeyExists = true
    }
  }

  if (!keyExists) {
    throw new Error(
      `Translation key "${oldKey}" does not exist in any language`
    )
  }

  if (newKeyExists && !force) {
    throw new Error(
      `Translation key "${newKey}" already exists. Use --force to overwrite`
    )
  }

  for (const [langCode, languageName] of Object.entries(config.languages)) {
    console.log(`🌐 Processing ${languageName} (${langCode})...`)

    const translations = await loadTranslations(langCode, config.langDir)
    const oldValue = getNestedProperty(translations, oldKey)

    if (oldValue !== undefined) {
      setNestedProperty(translations, newKey, oldValue)

      removeNestedProperty(translations, oldKey)

      const sortedTranslations = sortObjectRecursively(translations)
      await saveTranslations(langCode, sortedTranslations, config.langDir)

      console.log(
        `   ✅ Renamed: "${oldKey}" → "${newKey}" (value: "${oldValue}")`
      )
    } else {
      console.log(`   ⏭️  Key "${oldKey}" not found, skipping`)
    }
  }

  console.log('')
  console.log('🎉 Translation key renamed successfully!')
}

export async function removeTranslationKey(key, config, options = {}) {
  const { force = false } = options

  console.log(`🗑️  Removing translation key: "${key}"`)
  console.log(`📂 Language directory: ${config.langDir}`)
  console.log('')

  let keyExists = false

  for (const [langCode, languageName] of Object.entries(config.languages)) {
    const translations = await loadTranslations(langCode, config.langDir)

    if (getNestedProperty(translations, key) !== undefined) {
      keyExists = true
      break
    }
  }

  if (!keyExists) {
    throw new Error(`Translation key "${key}" does not exist in any language`)
  }

  for (const [langCode, languageName] of Object.entries(config.languages)) {
    console.log(`🌐 Processing ${languageName} (${langCode})...`)

    const translations = await loadTranslations(langCode, config.langDir)
    const value = getNestedProperty(translations, key)

    if (value !== undefined) {
      removeNestedProperty(translations, key)

      const sortedTranslations = sortObjectRecursively(translations)
      await saveTranslations(langCode, sortedTranslations, config.langDir)

      console.log(`   ✅ Removed: "${key}" (was: "${value}")`)
    } else {
      console.log(`   ⏭️  Key "${key}" not found, skipping`)
    }
  }

  console.log('')
  console.log('🎉 Translation key removed successfully!')
}

export async function addNewLanguage(
  langCode,
  languageName,
  config,
  options = {}
) {
  const { translateFromSource = true } = options

  console.log(`🌍 Adding new language: ${languageName} (${langCode})`)
  console.log(`📂 Language directory: ${config.langDir}`)
  console.log('')

  if (config.languages[langCode]) {
    throw new Error(`Language "${langCode}" already exists in configuration`)
  }

  if (!/^[a-z]{2}-[a-z]{2}$/.test(langCode)) {
    throw new Error(
      'Invalid language code format. Use: xx-xx (e.g., de-de, fr-fr)'
    )
  }

  console.log('📝 Updating configuration file...')
  const updatedConfig = {
    ...config,
    languages: {
      ...config.languages,
      [langCode]: languageName,
    },
  }

  const configFiles = ['.translation-cli.json', 'translation-cli.config.json']
  let configUpdated = false

  for (const configFile of configFiles) {
    try {
      const configPath = path.join(process.cwd(), configFile)
      await fs.access(configPath)

      await saveJsonFile(configPath, updatedConfig)
      console.log(`✅ Updated ${configFile}`)
      configUpdated = true
      break
    } catch {
      // File doesn't exist, continue
    }
  }

  if (!configUpdated) {
    const configPath = path.join(process.cwd(), '.translation-cli.json')
    await saveJsonFile(configPath, updatedConfig)
    console.log(`✅ Created .translation-cli.json`)
  }

  const sourceTranslations = await loadTranslations(
    config.sourceLanguage,
    config.langDir
  )
  const flatSourceTranslations = flattenObject(sourceTranslations)
  const sourceKeys = Object.keys(flatSourceTranslations)

  if (sourceKeys.length === 0) {
    console.log(
      `⚠️  No translations found in source language (${config.sourceLanguage})`
    )
    console.log(`   Creating empty language file...`)

    await ensureDir(config.langDir)
    const sortedTranslations = sortObjectRecursively({})
    await saveTranslations(langCode, sortedTranslations, config.langDir)

    return {
      langCode,
      languageName,
      keysCount: 0,
      translated: false,
    }
  }

  if (translateFromSource) {
    console.log(
      `🔄 Translating ${sourceKeys.length} keys from ${
        config.languages[config.sourceLanguage]
      } to ${languageName}...`
    )

    const { batchTranslate } = await import('./translation.js')

    const sourceTexts = sourceKeys.map((key) => flatSourceTranslations[key])

    const sourceLanguageName = config.languages[config.sourceLanguage]
    const translatedTexts = await batchTranslate(
      sourceTexts,
      languageName,
      sourceLanguageName
    )

    if (!translatedTexts || translatedTexts.length !== sourceTexts.length) {
      console.log(`❌ Translation failed. Creating empty language file...`)

      await ensureDir(config.langDir)
      const sortedTranslations = sortObjectRecursively({})
      await saveTranslations(langCode, sortedTranslations, config.langDir)

      return {
        langCode,
        languageName,
        keysCount: 0,
        translated: false,
        error: 'Translation failed',
      }
    }

    const newTranslations = {}
    sourceKeys.forEach((key, index) => {
      setNestedProperty(newTranslations, key, translatedTexts[index])
    })

    await ensureDir(config.langDir)
    const sortedTranslations = sortObjectRecursively(newTranslations)
    await saveTranslations(langCode, sortedTranslations, config.langDir)

    console.log(`✅ Successfully translated ${sourceKeys.length} keys`)
    console.log('')
    console.log('🎉 New language added and translated successfully!')

    return {
      langCode,
      languageName,
      keysCount: sourceKeys.length,
      translated: true,
    }
  } else {
    await ensureDir(config.langDir)
    const sortedTranslations = sortObjectRecursively({})
    await saveTranslations(langCode, sortedTranslations, config.langDir)

    console.log(
      `📝 Created empty language file with ${sourceKeys.length} keys to translate`
    )
    console.log('')
    console.log('💡 To translate all keys automatically, run:')
    console.log(`   tcli-check --json ${langCode}`)
    console.log(
      `   # Then translate the JSON and run: tcli-batch your-file.json`
    )

    return {
      langCode,
      languageName,
      keysCount: 0,
      translated: false,
    }
  }
}
