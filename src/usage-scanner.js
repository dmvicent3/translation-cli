import fs from 'fs/promises'
import path from 'path'
import { loadTranslations } from './utils/file.js'
import { flattenObject } from './utils/object.js'

const TRANSLATION_PATTERNS = [
  // t('key.name') or t("key.name")
  /\bt\s*\(\s*['"`]([^'"`]+)['"`]/g,
  // t(`key.name`) - template literals
  /\bt\s*\(\s*`([^`]+)`/g,
  // $t('key.name') - Vue i18n style
  /\$t\s*\(\s*['"`]([^'"`]+)['"`]/g,
  // i18n.t('key.name') - explicit i18n object
  /i18n\.t\s*\(\s*['"`]([^'"`]+)['"`]/g,
]

async function getFilesToScan(dir, config) {
  const files = []
  const extensions = config.verification?.extensions || [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.vue',
    '.svelte',
  ]
  const ignoreDirs = config.verification?.exclude || [
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
  ]
  const includeDirs = config.verification?.include || null

  async function scanDirectory(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        const relativePath = path.relative(dir, fullPath)

        if (entry.isDirectory()) {
          // Skip ignored directories
          if (ignoreDirs.includes(entry.name)) {
            continue
          }

          // If includeDirs is specified, only scan those directories
          if (
            includeDirs &&
            !includeDirs.some(
              (includeDir) =>
                relativePath.startsWith(includeDir) ||
                fullPath.includes(path.sep + includeDir + path.sep) ||
                entry.name === includeDir
            )
          ) {
            continue
          }

          await scanDirectory(fullPath)
        } else if (entry.isFile()) {
          // Check if file has a supported extension
          const ext = path.extname(entry.name)
          if (extensions.includes(ext)) {
            // If includeDirs is specified, only include files in those directories
            if (
              includeDirs &&
              !includeDirs.some(
                (includeDir) =>
                  relativePath.startsWith(includeDir) ||
                  fullPath.includes(path.sep + includeDir + path.sep)
              )
            ) {
              continue
            }
            files.push(fullPath)
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Skipping directory ${currentDir}: ${error.message}`)
    }
  }

  await scanDirectory(dir)
  return files
}

function extractTranslationKeys(content) {
  const keys = new Set()

  for (const pattern of TRANSLATION_PATTERNS) {
    let match
    pattern.lastIndex = 0

    while ((match = pattern.exec(content)) !== null) {
      const key = match[1]
      // Skip dynamic keys
      if (!key.includes('${') && !key.includes('{{') && !key.includes('+')) {
        keys.add(key)
      }
    }
  }

  return Array.from(keys)
}

async function scanFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const keys = extractTranslationKeys(content)
    return { filePath, keys, error: null }
  } catch (error) {
    return { filePath, keys: [], error: error.message }
  }
}

export async function scanUnusedTranslations(config, options = {}) {
  const {
    scanDir = process.cwd(),
    detailed = false,
    showUsed = false,
  } = options

  console.log('🔍 Scanning for unused translation keys...')
  console.log(`📂 Scan directory: ${scanDir}`)
  console.log(`📁 Language directory: ${config.langDir}`)
  console.log(`🌍 Source language: ${config.sourceLanguage}`)

  const includeDirs = config.verification?.include
  const excludeDirs = config.verification?.exclude || []
  const extensions = config.verification?.extensions || [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.vue',
    '.svelte',
  ]

  if (includeDirs) {
    console.log(`📋 Include directories: ${includeDirs.join(', ')}`)
  } else {
    console.log(`📋 Scanning all directories`)
  }
  console.log(`🚫 Exclude directories: ${excludeDirs.join(', ')}`)
  console.log(`📄 File extensions: ${extensions.join(', ')}`)
  console.log('')

  console.log('📋 Loading translation keys...')
  const sourceTranslations = await loadTranslations(
    config.sourceLanguage,
    config.langDir
  )
  const flatTranslations = flattenObject(sourceTranslations)
  const allTranslationKeys = Object.keys(flatTranslations)

  if (allTranslationKeys.length === 0) {
    console.log('❌ No translation keys found in source language')
    return { usedKeys: [], unusedKeys: [], totalKeys: 0 }
  }

  console.log(`📊 Found ${allTranslationKeys.length} translation keys`)
  console.log('')

  console.log('📁 Scanning project files...')
  const filesToScan = await getFilesToScan(scanDir, config)

  if (filesToScan.length === 0) {
    console.log('❌ No files found to scan')
    return {
      usedKeys: [],
      unusedKeys: allTranslationKeys,
      totalKeys: allTranslationKeys.length,
    }
  }

  console.log(`📄 Found ${filesToScan.length} files to scan`)
  console.log('')

  const usedKeys = new Set()
  const keyUsageMap = new Map() // Track which files use which keys
  let scannedFiles = 0
  let errorFiles = 0

  console.log('🔄 Scanning files for translation usage...')

  for (const filePath of filesToScan) {
    const result = await scanFile(filePath)
    scannedFiles++

    if (result.error) {
      errorFiles++
      if (detailed) {
        console.log(`   ❌ Error scanning ${result.filePath}: ${result.error}`)
      }
    } else {
      // Add found keys to used set
      for (const key of result.keys) {
        usedKeys.add(key)

        // Track usage for detailed reporting
        if (!keyUsageMap.has(key)) {
          keyUsageMap.set(key, [])
        }
        keyUsageMap.get(key).push(path.relative(scanDir, result.filePath))
      }
    }

    // Show progress
    if (scannedFiles % 100 === 0) {
      console.log(
        `   📄 Scanned ${scannedFiles}/${filesToScan.length} files...`
      )
    }
  }

  console.log(`✅ Scanned ${scannedFiles} files (${errorFiles} errors)`)
  console.log('')

  // Calculate unused keys
  const usedKeysArray = Array.from(usedKeys)
  const unusedKeys = allTranslationKeys.filter((key) => !usedKeys.has(key))

  // Results
  console.log('📊 Scan Results:')
  console.log('='.repeat(50))
  console.log(`📋 Total translation keys: ${allTranslationKeys.length}`)
  console.log(`✅ Used keys: ${usedKeysArray.length}`)
  console.log(`❌ Unused keys: ${unusedKeys.length}`)
  console.log(
    `📈 Usage rate: ${(
      (usedKeysArray.length / allTranslationKeys.length) *
      100
    ).toFixed(1)}%`
  )
  console.log('')

  // Show unused keys
  if (unusedKeys.length > 0) {
    console.log('🗑️  Unused Translation Keys:')
    console.log('-'.repeat(30))

    if (detailed) {
      unusedKeys.forEach((key) => {
        const value = flatTranslations[key]
        console.log(`   ${key}: "${value}"`)
      })
    } else {
      // Show first 20 unused keys
      const keysToShow = unusedKeys.slice(0, 20)
      keysToShow.forEach((key) => {
        console.log(`   ${key}`)
      })

      if (unusedKeys.length > 20) {
        console.log(`   ... and ${unusedKeys.length - 20} more`)
        console.log(`   (use --detailed to see all unused keys)`)
      }
    }
    console.log('')

    console.log('💡 Suggestions:')
    console.log('   - Review unused keys and remove if no longer needed')
    console.log('   - Use tcli-remove command to clean up')
    console.log('   - Some keys might be used dynamically (not detected)')
  } else {
    console.log('🎉 All translation keys are being used!')
  }

  // Show used keys if requested
  if (showUsed && usedKeysArray.length > 0) {
    console.log('')
    console.log('✅ Used Translation Keys:')
    console.log('-'.repeat(30))

    if (detailed) {
      usedKeysArray.sort().forEach((key) => {
        const files = keyUsageMap.get(key) || []
        console.log(`   ${key}`)
        console.log(
          `     Used in: ${files.slice(0, 3).join(', ')}${
            files.length > 3 ? ` +${files.length - 3} more` : ''
          }`
        )
      })
    } else {
      usedKeysArray.sort().forEach((key) => {
        console.log(`   ${key}`)
      })
    }
  }

  return {
    usedKeys: usedKeysArray,
    unusedKeys,
    totalKeys: allTranslationKeys.length,
    usageRate: (usedKeysArray.length / allTranslationKeys.length) * 100,
    keyUsageMap,
    scannedFiles,
    errorFiles,
  }
}

export async function generateUnusedTranslationsReport(config, options = {}) {
  const { format = 'console', outputFile = null } = options

  const scanResult = await scanUnusedTranslations(config, {
    ...options,
    detailed: true,
  })

  const report = {
    timestamp: new Date().toISOString(),
    scanDirectory: options.scanDir || process.cwd(),
    sourceLanguage: config.sourceLanguage,
    totalKeys: scanResult.totalKeys,
    usedKeys: scanResult.usedKeys.length,
    unusedKeys: scanResult.unusedKeys.length,
    usageRate: scanResult.usageRate.toFixed(1),
    scannedFiles: scanResult.scannedFiles,
    errorFiles: scanResult.errorFiles,
    unusedKeysList: scanResult.unusedKeys,
    usedKeysList: scanResult.usedKeys,
  }

  if (format === 'json') {
    const jsonReport = JSON.stringify(report, null, 2)

    if (outputFile) {
      await fs.writeFile(outputFile, jsonReport, 'utf-8')
      console.log(`📄 Report saved to ${outputFile}`)
    } else {
      console.log(jsonReport)
    }
  }

  return report
}
