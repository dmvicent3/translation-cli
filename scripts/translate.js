#!/usr/bin/env node

import 'dotenv/config'
import { loadConfig, validateConfig } from '../src/config.js'
import { addTranslation } from '../src/translation.js'
import { initProject, listTranslations, showConfig } from '../src/commands.js'

// CLI Interface
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`
🌍 Translation CLI Tool

Usage: 
  tcli <key> <source_text> [options]
  tcli --list [language]
  tcli --init
  tcli --config

Examples: 
  tcli "button.submit" "Submeter"
  tcli "errors.validation.required" "Este campo é obrigatório"
  tcli "welcome.message" "Bem-vindo" --force
  tcli --list
  tcli --list en-us
  tcli --init
  tcli --config

Options:
  --force       Force overwrite existing translations without prompting
  --no-prompt   Don't prompt for confirmation (skip existing translations)
  --list        List existing translations
  --init        Initialize configuration for current project
  --config      Show current configuration

Configuration:
  Create a .translation-cli.json file in your project root to customize:
  - Language directory path
  - Supported languages
  - Source language

Example .translation-cli.json:
  {
    "langDir": "src/i18n",
    "sourceLanguage": "en-us",
    "languages": {
      "en-us": "American English",
      "pt-pt": "European Portuguese",
      "it-it": "Italian",
      "de-de": "German"
    }
  }

Related Commands:
  tcli-check            # Check for missing translation keys
  tcli-batch file.json  # Add multiple translations from JSON
  tcli-scan             # Scan for unused translation keys
`)
    process.exit(1)
  }

  // Handle --init command
  if (args[0] === '--init') {
    try {
      await initProject()
      return
    } catch (error) {
      console.error('❌ Error initializing project:', error.message)
      process.exit(1)
    }
  }

  // Load and validate configuration
  let config
  try {
    config = await loadConfig()
    validateConfig(config)
  } catch (error) {
    console.error(`❌ Configuration error: ${error.message}`)
    console.log("Run 'tcli --init' to create a default configuration file")
    process.exit(1)
  }

  // Handle --config command
  if (args[0] === '--config') {
    try {
      await showConfig(config)
    } catch (error) {
      console.error('❌ Error showing configuration:', error.message)
      process.exit(1)
    }
    return
  }

  // Handle --list command
  if (args[0] === '--list') {
    const langCode = args[1] || config.sourceLanguage

    if (!config.languages[langCode]) {
      console.error(`❌ Unsupported language: ${langCode}`)
      console.log(
        `Supported languages: ${Object.keys(config.languages).join(', ')}`
      )
      process.exit(1)
    }

    try {
      await listTranslations(langCode, config)
    } catch (error) {
      console.error('❌ Error listing translations:', error.message)
      process.exit(1)
    }
    return
  }

  // Parse arguments
  const key = args[0]
  const sourceText = args[1]
  const force = args.includes('--force')
  const noPrompt = args.includes('--no-prompt')

  if (!key || !sourceText) {
    console.error('❌ Both key and source text are required')
    process.exit(1)
  }

  // Validate key format (basic check for dot notation)
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    console.error(
      '❌ Invalid key format. Use alphanumeric characters, dots, hyphens, and underscores only.'
    )
    process.exit(1)
  }

  // Check for Google API key
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error(
      '❌ GOOGLE_GENERATIVE_AI_API_KEY environment variable is required'
    )
    console.log('Get your API key from: https://aistudio.google.com/app/apikey')
    console.log("Or run 'tcli --init' to set up your API key")
    process.exit(1)
  }

  try {
    await addTranslation(key, sourceText, config, {
      force,
      interactive: !noPrompt,
    })
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the CLI
main()
