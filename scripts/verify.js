#!/usr/bin/env node

import 'dotenv/config'
import { loadConfig, validateConfig } from '../src/config.js'
import {
  verifyTranslations,
  generateMissingTranslationsReport,
  findIncompleteTranslations,
} from '../src/verification.js'
import { generateMissingKeysJSON } from '../src/commands.js'

// CLI Interface
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
🔍 Translation Verification Tool

Usage: 
  tcli-verify [options]
  tcli-verify --report [options]
  tcli-verify --incomplete
  tcli-verify --json <language>

Options:
  --detailed     Show all missing keys (not just summary)
  --report       Generate a detailed completeness report
  --incomplete   Show translations missing from source language
  --json <lang>  Generate JSON template for missing keys in specific language
  --json-format  Output report in JSON format
  --output <file> Save report to file

Examples: 
  tcli-verify                           # Basic verification
  tcli-verify --detailed                # Show all missing keys
  tcli-verify --report                  # Generate completeness report
  tcli-verify --report --json-format    # Generate JSON report
  tcli-verify --incomplete              # Check against source language
  tcli-verify --json pt-br              # Generate JSON for Portuguese (Brazil)
  tcli-verify --report --output report.json --json-format  # Save JSON report to file

Description:
  This tool verifies that all translation keys exist across all configured
  languages and helps identify missing or inconsistent translations.
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

  const detailed = args.includes('--detailed')
  const report = args.includes('--report')
  const incomplete = args.includes('--incomplete')
  const jsonFormat = args.includes('--json-format')
  const jsonIndex = args.indexOf('--json')
  const outputIndex = args.indexOf('--output')

  try {
    if (jsonIndex !== -1 && jsonIndex + 1 < args.length) {
      // Generate JSON template for specific language
      const targetLanguage = args[jsonIndex + 1]

      if (!config.languages[targetLanguage]) {
        console.error(`❌ Unsupported language: ${targetLanguage}`)
        console.log(
          `Supported languages: ${Object.keys(config.languages).join(', ')}`
        )
        process.exit(1)
      }

      await generateMissingKeysJSON(config, targetLanguage)
    } else if (report) {
      // Generate report
      const outputFile =
        outputIndex !== -1 && outputIndex + 1 < args.length
          ? args[outputIndex + 1]
          : null
      await generateMissingTranslationsReport(config, {
        format: jsonFormat ? 'json' : 'console',
        outputFile,
      })
    } else if (incomplete) {
      // Check incomplete translations against source language
      await findIncompleteTranslations(config)
    } else {
      // Basic verification
      const result = await verifyTranslations(config, { detailed })

      if (!result.isValid) {
        process.exit(1) // Exit with error code if there are issues
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
