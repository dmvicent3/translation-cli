#!/usr/bin/env node

import 'dotenv/config'
import inquirer from 'inquirer'
import { loadConfig, validateConfig } from '../src/config.js'
import { addNewLanguage } from '../src/commands.js'

// CLI Interface
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
🌍 Add New Language

Usage: 
  add-language <language-code> <language-name> [options]
  add-language --interactive

Options:
  --no-translate    Don't automatically translate from source language
  --interactive     Interactive mode to add language

Examples: 
  add-language "de-de" "German"
  add-language "fr-fr" "French"
  add-language "it-it" "Italian" --no-translate
  add-language --interactive

Description:
  Adds a new language to your translation project and automatically:
  1. Updates the configuration file (.translation-cli.json)
  2. Translates all existing keys from the source language
  3. Creates the new language file with all translations
  
  By default, it will automatically translate all existing keys.
  Use --no-translate to create an empty language file instead.
`)
    process.exit(1)
  }

  let config
  try {
    config = await loadConfig()
    validateConfig(config)
  } catch (error) {
    console.error(`❌ Configuration error: ${error.message}`)
    console.log("Run 'translate --init' to create a default configuration file")
    process.exit(1)
  }

  const noTranslate = args.includes('--no-translate')
  const interactive = args.includes('--interactive')

  if (!noTranslate && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error(
      '❌ GOOGLE_GENERATIVE_AI_API_KEY environment variable is required for automatic translation'
    )
    console.log('Get your API key from: https://aistudio.google.com/app/apikey')
    console.log('Or use --no-translate to create an empty language file')
    process.exit(1)
  }

  try {
    let langCode, languageName

    if (interactive) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'langCode',
          message: 'Enter language code (e.g., de-de, fr-fr):',
          validate: (input) => {
            if (!input.trim()) return 'Language code cannot be empty'
            if (!/^[a-z]{2}-[a-z]{2}$/.test(input)) {
              return 'Use format: xx-xx (e.g., de-de, fr-fr)'
            }
            if (config.languages[input]) {
              return `Language "${input}" already exists`
            }
            return true
          },
        },
        {
          type: 'input',
          name: 'languageName',
          message: 'Enter language name (e.g., German, French):',
          validate: (input) => {
            if (!input.trim()) return 'Language name cannot be empty'
            return true
          },
        },
        {
          type: 'confirm',
          name: 'shouldTranslate',
          message:
            'Automatically translate all existing keys from source language?',
          default: true,
          when: () => !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        },
      ])

      langCode = answers.langCode
      languageName = answers.languageName

      const result = await addNewLanguage(langCode, languageName, config, {
        translateFromSource: answers.shouldTranslate !== false,
      })

      console.log('')
      if (result.translated) {
        console.log('🎯 Language successfully added and translated!')
        console.log(`   ${result.keysCount} keys translated`)
      } else {
        console.log('🎯 Language added. Next steps:')
        console.log('1. Run: check-translations --json ' + langCode)
        console.log('2. Translate the JSON file')
        console.log('3. Run: batch-translate your-translated-file.json')
      }
    } else {
      // Command line mode
      langCode = args[0]
      languageName = args[1]

      if (!langCode || !languageName) {
        console.error('❌ Both language code and language name are required')
        console.log('Usage: add-language <language-code> <language-name>')
        process.exit(1)
      }

      // Validate language code format
      if (!/^[a-z]{2}-[a-z]{2}$/.test(langCode)) {
        console.error(
          '❌ Invalid language code format. Use: xx-xx (e.g., de-de, fr-fr)'
        )
        process.exit(1)
      }

      if (config.languages[langCode]) {
        console.error(`❌ Language "${langCode}" already exists`)
        process.exit(1)
      }

      const result = await addNewLanguage(langCode, languageName, config, {
        translateFromSource: !noTranslate,
      })

      console.log('')
      if (result.translated) {
        console.log(
          '🎉 Success! Language added and all keys translated automatically!'
        )
        console.log(
          `📊 Translated ${result.keysCount} keys from ${
            config.languages[config.sourceLanguage]
          } to ${languageName}`
        )
      } else if (result.error) {
        console.log('⚠️  Language added but translation failed')
        console.log('💡 You can manually translate using:')
        console.log(`   check-translations --json ${langCode}`)
        console.log(`   batch-translate your-translated-file.json`)
      } else {
        console.log('📝 Language added without automatic translation')
        console.log('💡 To translate all keys:')
        console.log(`   check-translations --json ${langCode}`)
        console.log(`   batch-translate your-translated-file.json`)
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
