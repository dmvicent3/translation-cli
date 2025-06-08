import fs from 'fs/promises'
import path from 'path'

export async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath)
  } catch {
    await fs.mkdir(dirPath, { recursive: true })
    console.log(`📁 Created ${dirPath} directory`)
  }
}

export async function loadJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null // File doesn't exist
    }
    throw error
  }
}

export async function saveJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function loadTranslations(langCode, langDir) {
  const filePath = path.join(langDir, `${langCode}.json`)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {} // File doesn't exist, return empty object
    }
    throw error
  }
}

export async function saveTranslations(langCode, translations, langDir) {
  const filePath = path.join(langDir, `${langCode}.json`)
  await fs.writeFile(filePath, JSON.stringify(translations, null, 2), 'utf-8')
  console.log(`✅ Updated ${langCode}.json`)
}

export async function readFile(filePath) {
  return fs.readFile(filePath, 'utf-8')
}
