import { loadTranslations } from './utils/file.js'
import { flattenObject } from './utils/object.js'
import fs from 'fs/promises'

export async function getAllKeys(config) {
  const allKeys = new Set()

  for (const langCode of Object.keys(config.languages)) {
    const translations = await loadTranslations(langCode, config.langDir)
    const flatTranslations = flattenObject(translations)

    Object.keys(flatTranslations).forEach((key) => allKeys.add(key))
  }

  return Array.from(allKeys).sort()
}

async function getMissingKeys(langCode, allKeys, config) {
  const translations = await loadTranslations(langCode, config.langDir)
  const flatTranslations = flattenObject(translations)
  const existingKeys = new Set(Object.keys(flatTranslations))

  return allKeys.filter((key) => !existingKeys.has(key))
}

async function getExtraKeys(langCode, allKeys, config) {
  const translations = await loadTranslations(langCode, config.langDir)
  const flatTranslations = flattenObject(translations)
  const existingKeys = Object.keys(flatTranslations)

  return existingKeys.filter((key) => !allKeys.includes(key))
}

export async function verifyTranslations(config, options = {}) {
  const { detailed = false, fixMissing = false } = options

  console.log('🔍 Checking translations across all languages...')
  console.log(`📂 Language directory: ${config.langDir}`)
  console.log('')

  const allKeys = await getAllKeys(config)

  if (allKeys.length === 0) {
    console.log('📝 No translation keys found in any language file.')
    return { isValid: true, issues: [] }
  }

  console.log(`📊 Found ${allKeys.length} unique translation keys`)
  console.log('')

  const issues = []
  let hasIssues = false

  for (const [langCode, languageName] of Object.entries(config.languages)) {
    console.log(`🌐 Checking ${languageName} (${langCode})...`)

    const missingKeys = await getMissingKeys(langCode, allKeys, config)
    const extraKeys = await getExtraKeys(langCode, allKeys, config)

    if (missingKeys.length > 0) {
      hasIssues = true
      const issue = {
        type: 'missing',
        langCode,
        languageName,
        keys: missingKeys,
      }
      issues.push(issue)

      console.log(`   ❌ Missing ${missingKeys.length} keys:`)
      if (detailed) {
        missingKeys.forEach((key) => console.log(`     - ${key}`))
      } else {
        console.log(
          `     - ${missingKeys.slice(0, 5).join(', ')}${
            missingKeys.length > 5
              ? ` and ${missingKeys.length - 5} more...`
              : ''
          }`
        )
      }
    }

    if (extraKeys.length > 0) {
      const issue = {
        type: 'extra',
        langCode,
        languageName,
        keys: extraKeys,
      }
      issues.push(issue)

      console.log(
        `   ⚠️  Extra ${extraKeys.length} keys (not in other languages):`
      )
      if (detailed) {
        extraKeys.forEach((key) => console.log(`     - ${key}`))
      } else {
        console.log(
          `     - ${extraKeys.slice(0, 5).join(', ')}${
            extraKeys.length > 5 ? ` and ${extraKeys.length - 5} more...` : ''
          }`
        )
      }
    }

    if (missingKeys.length === 0 && extraKeys.length === 0) {
      console.log(`   ✅ All keys present`)
    }

    console.log('')
  }

  // Summary
  if (hasIssues) {
    console.log('📋 Summary:')
    const missingIssues = issues.filter((issue) => issue.type === 'missing')
    const extraIssues = issues.filter((issue) => issue.type === 'extra')

    if (missingIssues.length > 0) {
      console.log(
        `❌ ${missingIssues.length} languages have missing translations`
      )
    }
    if (extraIssues.length > 0) {
      console.log(`⚠️  ${extraIssues.length} languages have extra keys`)
    }

    console.log('')
    console.log('💡 Suggestions:')
    console.log('   - Run with --detailed to see all missing keys')
    console.log('   - Use translate command to add missing translations')
    console.log(
      '   - Consider removing extra keys or adding them to other languages'
    )
  } else {
    console.log('🎉 All languages have consistent translation keys!')
  }

  return {
    isValid: !hasIssues,
    issues,
    totalKeys: allKeys.length,
    allKeys,
  }
}

export async function generateMissingTranslationsReport(config, options = {}) {
  const { format = 'console', outputFile = null } = options

  console.log('📊 Generating missing translations report...')
  console.log('')

  const allKeys = await getAllKeys(config)
  const report = {
    timestamp: new Date().toISOString(),
    totalKeys: allKeys.length,
    languages: {},
  }

  for (const [langCode, languageName] of Object.entries(config.languages)) {
    const missingKeys = await getMissingKeys(langCode, allKeys, config)
    const translations = await loadTranslations(langCode, config.langDir)
    const flatTranslations = flattenObject(translations)

    report.languages[langCode] = {
      name: languageName,
      totalKeys: Object.keys(flatTranslations).length,
      missingKeys: missingKeys,
      missingCount: missingKeys.length,
      completeness: (
        ((allKeys.length - missingKeys.length) / allKeys.length) *
        100
      ).toFixed(1),
    }
  }

  if (format === 'json') {
    const jsonReport = JSON.stringify(report, null, 2)

    if (outputFile) {
      await fs.writeFile(outputFile, jsonReport, 'utf-8')
      console.log(`📄 Report saved to ${outputFile}`)
    } else {
      console.log(jsonReport)
    }
  } else {
    console.log('📈 Translation Completeness Report')
    console.log('='.repeat(50))
    console.log('')

    for (const [langCode, data] of Object.entries(report.languages)) {
      const completeness = Number.parseFloat(data.completeness)
      const status =
        completeness === 100 ? '✅' : completeness >= 90 ? '⚠️ ' : '❌'

      console.log(
        `${status} ${data.name} (${langCode}): ${data.completeness}% complete`
      )
      console.log(
        `   Keys: ${data.totalKeys}/${report.totalKeys} | Missing: ${data.missingCount}`
      )

      if (data.missingKeys.length > 0) {
        console.log(
          `   Missing keys: ${data.missingKeys.slice(0, 3).join(', ')}${
            data.missingKeys.length > 3 ? '...' : ''
          }`
        )
      }
      console.log('')
    }
  }

  return report
}

export async function findIncompleteTranslations(config) {
  console.log(
    `🔍 Finding incomplete translations (using ${config.sourceLanguage} as reference)...`
  )
  console.log('')

  const sourceTranslations = await loadTranslations(
    config.sourceLanguage,
    config.langDir
  )
  const sourceKeys = Object.keys(flattenObject(sourceTranslations))

  if (sourceKeys.length === 0) {
    console.log(
      `📝 No translations found in source language (${config.sourceLanguage})`
    )
    return { sourceKeys: [], incompleteLanguages: [] }
  }

  console.log(`📊 Found ${sourceKeys.length} keys in source language`)
  console.log('')

  const incompleteLanguages = []

  for (const [langCode, languageName] of Object.entries(config.languages)) {
    if (langCode === config.sourceLanguage) continue

    const missingKeys = await getMissingKeys(langCode, sourceKeys, config)

    if (missingKeys.length > 0) {
      incompleteLanguages.push({
        langCode,
        languageName,
        missingKeys,
        missingCount: missingKeys.length,
        completeness: (
          ((sourceKeys.length - missingKeys.length) / sourceKeys.length) *
          100
        ).toFixed(1),
      })

      console.log(
        `❌ ${languageName} (${langCode}): Missing ${missingKeys.length} translations`
      )
      console.log(
        `   Completeness: ${(
          ((sourceKeys.length - missingKeys.length) / sourceKeys.length) *
          100
        ).toFixed(1)}%`
      )
      console.log(
        `   Missing: ${missingKeys.slice(0, 5).join(', ')}${
          missingKeys.length > 5 ? '...' : ''
        }`
      )
    } else {
      console.log(`✅ ${languageName} (${langCode}): Complete`)
    }
    console.log('')
  }

  if (incompleteLanguages.length === 0) {
    console.log('🎉 All languages are complete!')
  } else {
    console.log(
      `📋 Summary: ${incompleteLanguages.length} languages need attention`
    )
  }

  return {
    sourceKeys,
    incompleteLanguages,
    totalLanguages: Object.keys(config.languages).length - 1, // Exclude source language
  }
}
