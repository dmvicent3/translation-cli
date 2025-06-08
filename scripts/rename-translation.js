#!/usr/bin/env node

import 'dotenv/config'
import inquirer from 'inquirer'
import { loadConfig, validateConfig } from '../src/config.js'
import { renameTranslationKey } from '../src/commands.js'

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
🔄 Rename Translation

Usage: 
  rename-translation <old-key> <new-key> [options]
  rename-translation --interactive

Options:
  --force        Force rename even if new key already exists
  --interactive  Interactive mode to select and rename keys

Examples: 
  rename-translation "button.submit" "button.send"
  rename-translation "user.name" "user.fullName" --force
  rename-translation --interactive

Description:
  Renames a translation key across all configured languages.
  The key structure and values are preserved, only the key name changes.
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

      const { oldKey } = await inquirer.prompt([
        {
          type: 'list',
          name: 'oldKey',
          message: 'Select the key to rename:',
          choices: existingKeys,
          pageSize: 15,
        },
      ])

      const { newKey } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newKey',
          message: 'Enter the new key name:',
          default: oldKey,
          validate: (input) => {
            if (!input.trim()) return 'Key cannot be empty'
            if (!/^[a-zA-Z0-9._-]+$/.test(input)) {
              return 'Use alphanumeric characters, dots, hyphens, and underscores only'
            }
            return true
          },
        },
      ])

      if (oldKey === newKey) {
        console.log('⏭️  Key names are the same, nothing to do')
        process.exit(0)
      }

      await renameTranslationKey(oldKey, newKey, config, { force })
    } else {
      // Command line mode
      const oldKey = args[0]
      const newKey = args[1]

      if (!oldKey || !newKey) {
        console.error('❌ Both old key and new key are required')
        console.log('Usage: rename-translation <old-key> <new-key>')
        process.exit(1)
      }

      await renameTranslationKey(oldKey, newKey, config, { force })
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
