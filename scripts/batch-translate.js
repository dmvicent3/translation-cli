#!/usr/bin/env node

import 'dotenv/config'
import { readFile } from '../src/utils/file.js'
import { loadConfig, validateConfig } from '../src/config.js'
import { batchAddTranslations } from '../src/translation.js'
import { parseTranslationInput } from '../src/commands.js'

// CLI Interface
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`
🌍 Batch Translation CLI Tool

Usage: 
  tcli-batch <file.json> [options]
  tcli-batch --stdin [options]

Options:
  --force       Force overwrite existing translations without prompting
  --no-prompt   Don't prompt for confirmation (skip existing translations)

JSON Format (supports nested structures):
  {
    "button": {
      "submit": "Submeter",
      "cancel": "Cancelar"
    },
    "errors": {
      "validation": {
        "required": "Este campo é obrigatório"
      }
    },
    "user": {
      "profile": {
        "name": "Nome do utilizador"
      }
    }
  }

Examples:
  tcli-batch translations.json
  tcli-batch translations.json --force
  echo '{"welcome":"Olá mundo"}' |tcli-batch --stdin

Stdin Example:
  echo '{"welcome":{"message":"Olá mundo"}}' | tcli-batch --stdin

Configuration:
  The tool uses the same configuration as the tcli command.
  Run 'tcli --config' to see current settings.
`)
    process.exit(1)
  }

  let config
  try {
    config = await loadConfig()
    validateConfig(config)
  } catch (error) {
    console.error(`❌ Configuration error: ${error.message}`)
    console.log("Run 'tcli --init' to create a default configuration file")
    process.exit(1)
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error(
      '❌ GOOGLE_GENERATIVE_AI_API_KEY environment variable is required'
    )
    console.log('Get your API key from: https://aistudio.google.com/app/apikey')
    process.exit(1)
  }

  const force = args.includes('--force')
  const noPrompt = args.includes('--no-prompt')
  let translationPairs = []

  try {
    if (args[0] === '--stdin') {
      const input = await new Promise((resolve) => {
        let data = ''
        process.stdin.on('data', (chunk) => (data += chunk))
        process.stdin.on('end', () => resolve(data))
      })

      translationPairs = parseTranslationInput(input)
    } else {
      const filePath = args.filter((arg) => !arg.startsWith('--'))[0]
      const content = await readFile(filePath)
      translationPairs = parseTranslationInput(content)
    }

    if (translationPairs.length === 0) {
      console.error('❌ No valid translation pairs found')
      process.exit(1)
    }

    console.log(`📊 Found ${translationPairs.length} translation pairs`)

    await batchAddTranslations(translationPairs, config, {
      force,
      interactive: !noPrompt,
    })
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
