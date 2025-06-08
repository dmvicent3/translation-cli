import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import inquirer from 'inquirer'
import { ensureDir, loadTranslations, saveTranslations } from './utils/file.js'
import {
  getNestedProperty,
  setNestedProperty,
  sortObjectRecursively,
  translationExists,
} from './utils/object.js'

export async function translateText(
  text,
  targetLanguage,
  sourceLanguage = 'Portuguese'
) {
  try {
    const { text: translation } = await generateText({
      model: google('gemini-1.5-flash'),
      prompt: `Translate the following ${sourceLanguage} text to ${targetLanguage}. 
      
Only return the translation, nothing else. Keep the same tone and context.

Text to translate: "${text}"`,
      temperature: 0.3,
    })

    return translation.trim()
  } catch (error) {
    console.error(`❌ Error translating to ${targetLanguage}:`, error.message)
    return null
  }
}

export async function batchTranslate(
  texts,
  targetLanguage,
  sourceLanguage = 'Portuguese'
) {
  try {
    const textList = texts
      .map((text, index) => `${index + 1}. ${text}`)
      .join('\n')

    const { text: translation } = await generateText({
      model: google('gemini-1.5-flash'),
      prompt: `Translate the following numbered ${sourceLanguage} texts to ${targetLanguage}. 
      
Return only the translations in the same numbered format, nothing else. Keep the same tone and context for each.

Texts to translate:
${textList}`,
      temperature: 0.3,
    })

    const translations = translation
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())

    return translations
  } catch (error) {
    console.error(
      `❌ Error batch translating to ${targetLanguage}:`,
      error.message
    )
    return null
  }
}

async function confirmReplacement(key, existingValue, newValue) {
  const { replace } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'replace',
      message: `Key "${key}" already exists with value: "${existingValue}"\nReplace with: "${newValue}"?`,
      default: false,
    },
  ])
  return replace
}

export async function addTranslation(key, sourceText, config, options = {}) {
  const { force = false, interactive = true } = options

  console.log(`🔄 Adding translation for key: "${key}"`)
  console.log(`📝 Source text: "${sourceText}"`)
  console.log(`📂 Language directory: ${config.langDir}`)
  console.log('')

  await ensureDir(config.langDir)

  // Process each language
  for (const [langCode, languageName] of Object.entries(config.languages)) {
    console.log(`🌐 Processing ${languageName} (${langCode})...`)

    // Load existing translations
    const translations = await loadTranslations(langCode, config.langDir)

    // Check if translation already exists
    if (translationExists(translations, key)) {
      const existingValue = getNestedProperty(translations, key)

      let shouldReplace = force

      // If not forcing and in interactive mode, ask user
      if (!force && interactive) {
        shouldReplace = await confirmReplacement(key, existingValue, sourceText)
      }

      if (!shouldReplace) {
        console.log(`   ⏭️  Skipping (keeping existing translation)`)
        console.log('')
        continue
      }
    }

    let translatedText

    if (langCode === config.sourceLanguage) {
      // For source language, use the original text
      translatedText = sourceText
    } else {
      // Translate to other languages
      const sourceLanguageName =
        config.languages[config.sourceLanguage] || 'Portuguese'
      translatedText = await translateText(
        sourceText,
        languageName,
        sourceLanguageName
      )

      if (!translatedText) {
        console.log(`⚠️  Skipping ${langCode} due to translation error`)
        continue
      }
    }

    // Add/update the translation using dot notation
    const updatedTranslations = setNestedProperty(
      { ...translations },
      key,
      translatedText
    )

    // Sort and save the updated translations
    const sortedTranslations = sortObjectRecursively(updatedTranslations)
    await saveTranslations(langCode, sortedTranslations, config.langDir)

    console.log(`   → "${translatedText}"`)
    console.log('')
  }

  console.log('🎉 Translation completed successfully!')
}

export async function batchAddTranslations(
  translationPairs,
  config,
  options = {}
) {
  const { force = false, interactive = true } = options

  console.log(`🔄 Adding ${translationPairs.length} translations...`)
  console.log(`📂 Language directory: ${config.langDir}`)
  console.log('')

  await ensureDir(config.langDir)

  // Process each language
  for (const [langCode, languageName] of Object.entries(config.languages)) {
    console.log(`🌐 Processing ${languageName} (${langCode})...`)

    // Load existing translations
    const translations = await loadTranslations(langCode, config.langDir)

    // Check for existing translations
    const existingPairs = []
    const newPairs = []

    for (const pair of translationPairs) {
      if (translationExists(translations, pair.key)) {
        existingPairs.push(pair)
      } else {
        newPairs.push(pair)
      }
    }

    // Handle existing translations
    if (existingPairs.length > 0 && !force && interactive) {
      console.log(`   ⚠️  Found ${existingPairs.length} existing keys:`)

      for (const pair of existingPairs) {
        const existingValue = getNestedProperty(translations, pair.key)
        const shouldReplace = await confirmReplacement(
          pair.key,
          existingValue,
          pair.text
        )

        if (shouldReplace) {
          newPairs.push(pair)
        } else {
          console.log(`   ⏭️  Skipping "${pair.key}"`)
        }
      }
    } else if (existingPairs.length > 0 && force) {
      // If forcing, add all existing pairs to be processed
      newPairs.push(...existingPairs)
    } else if (existingPairs.length > 0) {
      console.log(
        `   ⏭️  Skipping ${existingPairs.length} existing keys (use --force to overwrite)`
      )
    }

    if (newPairs.length === 0) {
      console.log(`   📝 No translations to add`)
      console.log('')
      continue
    }

    let translatedTexts

    if (langCode === config.sourceLanguage) {
      // For source language, use the original texts
      translatedTexts = newPairs.map((pair) => pair.text)
    } else {
      // Batch translate to other languages
      const textsToTranslate = newPairs.map((pair) => pair.text)
      const sourceLanguageName =
        config.languages[config.sourceLanguage] || 'Portuguese'
      translatedTexts = await batchTranslate(
        textsToTranslate,
        languageName,
        sourceLanguageName
      )

      if (
        !translatedTexts ||
        translatedTexts.length !== textsToTranslate.length
      ) {
        console.log(`⚠️  Skipping ${langCode} due to translation error`)
        continue
      }
    }

    // Create a copy of translations to avoid direct mutation
    let updatedTranslations = { ...translations }

    // Add all translations using dot notation
    newPairs.forEach((pair, index) => {
      updatedTranslations = setNestedProperty(
        updatedTranslations,
        pair.key,
        translatedTexts[index]
      )
      console.log(`   ${pair.key}: "${translatedTexts[index]}"`)
    })

    // Sort and save the updated translations
    const sortedTranslations = sortObjectRecursively(updatedTranslations)
    await saveTranslations(langCode, sortedTranslations, config.langDir)
    console.log('')
  }

  console.log('🎉 Batch translation completed successfully!')
}
