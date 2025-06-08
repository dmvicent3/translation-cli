#!/usr/bin/env node

import 'dotenv/config'
import { loadConfig, validateConfig } from '../src/config.js'
import {
  scanUnusedTranslations,
  generateUnusedTranslationsReport,
} from '../src/usage-scanner.js'

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
🔍 Translation Usage Scanner

Usage: 
  scan-usage [options]
  scan-usage --dir <path> [options]

Options:
  --dir <path>       Directory to scan (default: current directory)
  --detailed         Show detailed information about unused keys
  --show-used        Also show which keys are being used
  --report           Generate detailed report
  --json             Output report in JSON format
  --output <file>    Save report to file

Examples: 
  scan-usage                                    # Scan using config settings
  scan-usage --dir src/                         # Scan specific directory
  scan-usage --detailed                         # Show all unused keys with values
  scan-usage --show-used                        # Also show used keys
  scan-usage --report --json --output usage.json # Generate JSON report

Configuration:
  Configure scan settings in your .translation-cli.json:
  {
    "verification": {
      "include": ["src", "components", "pages"],
      "exclude": ["node_modules", "dist", "test"],
      "extensions": [".js", ".jsx", ".ts", ".tsx", ".vue"]
    }
  }

Description:
  Scans your project files for translation key usage and identifies unused
  translation keys. Uses configuration settings to determine which files
  and directories to scan.
  
  Looks for patterns like:
  - t('key.name')
  - t("key.name")
  - $t('key.name')  (Vue i18n)
  - i18n.t('key.name')
  
  Note: Dynamic keys (with variables) are not detected and may appear as unused.
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
  const showUsed = args.includes('--show-used')
  const report = args.includes('--report')
  const jsonFormat = args.includes('--json')

  const dirIndex = args.indexOf('--dir')
  const scanDir =
    dirIndex !== -1 && dirIndex + 1 < args.length
      ? args[dirIndex + 1]
      : process.cwd()

  const outputIndex = args.indexOf('--output')
  const outputFile =
    outputIndex !== -1 && outputIndex + 1 < args.length
      ? args[outputIndex + 1]
      : null

  try {
    if (report) {
      // Generate report
      await generateUnusedTranslationsReport(config, {
        scanDir,
        detailed,
        showUsed,
        format: jsonFormat ? 'json' : 'console',
        outputFile,
      })
    } else {
      // Basic scan
      const result = await scanUnusedTranslations(config, {
        scanDir,
        detailed,
        showUsed,
      })

      // Exit with error code if there are unused keys
      if (result.unusedKeys.length > 0) {
        console.log('')
        console.log(
          `⚠️  Found ${result.unusedKeys.length} unused translation keys`
        )
        process.exit(1)
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the CLI
main()
