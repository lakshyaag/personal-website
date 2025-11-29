/**
 * Export current data from Vercel Blob Storage to local JSON files
 * This creates a backup before migration to Supabase
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!BLOB_TOKEN) {
  throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required')
}

// Extract store ID from token (format: vercel_blob_rw_STOREID_RANDOMCHARS)
const storeId = BLOB_TOKEN.split('_')[3]
const baseUrl = `https://${storeId}.public.blob.vercel-storage.com`

async function fetchBlobData(path: string): Promise<any> {
  const url = `${baseUrl}/${path}`
  console.log(`Fetching ${url}...`)

  try {
    const response = await fetch(url)
    if (response.status === 404) {
      console.log(`  ⚠️  Not found, returning empty array`)
      return []
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error(`  ❌ Error fetching ${path}:`, error)
    return []
  }
}

async function main() {
  console.log('🚀 Starting blob data export...\n')

  // Create export directory
  const exportDir = join(process.cwd(), 'data-export')
  mkdirSync(exportDir, { recursive: true })

  // Export books
  console.log('📚 Exporting books...')
  const books = await fetchBlobData('books/library.json')
  writeFileSync(
    join(exportDir, 'books.json'),
    JSON.stringify(books, null, 2)
  )
  console.log(`  ✅ Exported ${books.length} books\n`)

  // Export visits
  console.log('✈️  Exporting airport visits...')
  const visits = await fetchBlobData('airports/visits.json')
  writeFileSync(
    join(exportDir, 'visits.json'),
    JSON.stringify(visits, null, 2)
  )
  console.log(`  ✅ Exported ${visits.length} visits\n`)

  // Export recommendations
  console.log('💡 Exporting book recommendations...')
  const recommendations = await fetchBlobData('books/recommendations.json')
  writeFileSync(
    join(exportDir, 'recommendations.json'),
    JSON.stringify(recommendations, null, 2)
  )
  console.log(`  ✅ Exported ${recommendations.length} recommendations\n`)

  // Export airports reference data (from local file)
  console.log('🌍 Copying airports reference data...')
  const airportsData = await import('../data/airports.min.json')
  writeFileSync(
    join(exportDir, 'airports.json'),
    JSON.stringify(airportsData.default || airportsData, null, 2)
  )
  console.log(`  ✅ Copied airports reference data\n`)

  console.log('✨ Export complete!')
  console.log(`📁 Data exported to: ${exportDir}`)
  console.log('\nSummary:')
  console.log(`  - Books: ${books.length}`)
  console.log(`  - Visits: ${visits.length}`)
  console.log(`  - Recommendations: ${recommendations.length}`)
}

main().catch(console.error)
