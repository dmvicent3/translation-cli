#!/usr/bin/env node

import 'dotenv/config'
import inquirer from 'inquirer'
import { loadConfig, validateConfig } from '../src/config.js'
import { removeTranslationKey } from '../src/commands.js'

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
🗑️  Remove Translation

Usage: 
  remove-translation <key> [options]
  remove-translation --interactive

Options:
  --force        Skip confirmation prompt
  --interactive  Interactive mode to select and remove keys

Examples: 
  remove-translation "button.old"
  remove-translation "deprecated.feature" --force
  remove-translation --interactive

Description:
  Removes a translation from all configured languages.
  This action cannot be undone, so use with caution.
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

  const force = args.includes('--force')
  const interactive = args.includes('--interactive')

  try {
    let keyToRemove

    if (interactive) {
      // Interactive mode - show existing keys and let user select
      const { loadTranslations } = await import('../src/utils/file.js')
      const { flattenObject } = await import('../src/utils/object.js')

      const sourceTranslations = await loadTranslations(
        config.sourceLanguage,
        config.langDir
      )
      const flatTranslations = flattenObject(sourceTranslations)
      const existingKeys = Object.keys(flatTranslations).sort()

      if (existingKeys.length === 0) {
        console.log('📝 No translation keys found')
        process.exit(0)
      }

      const { selectedKey } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedKey',
          message: 'Select the key to remove:',
          choices: existingKeys,
          pageSize: 15,
        },
      ])

      keyToRemove = selectedKey
    } else {
      // Command line mode
      keyToRemove = args[0]

      if (!keyToRemove) {
        console.error('❌ Translation key is required')
        console.log('Usage: remove-translation <key>')
        process.exit(1)
      }
    }

    // Confirmation prompt
    if (!force) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Are you sure you want to remove "${keyToRemove}" from all languages?`,
          default: false,
        },
      ])

      if (!confirmed) {
        console.log('⏭️  Operation cancelled')
        process.exit(0)
      }
    }

    await removeTranslationKey(keyToRemove, config, { force })
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the CLI
main()
