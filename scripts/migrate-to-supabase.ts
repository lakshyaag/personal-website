/**
 * Migrate data from Vercel Blob Storage to Supabase
 * Reads exported JSON files and imports into Postgres tables
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface BookExport {
  id: string
  title: string
  author: string
  isbn?: string
  coverUrl?: string
  description?: string
  categories?: string[]
  progress?: number
  status: 'reading' | 'completed' | 'want-to-read'
  dateStarted: string
  dateCompleted?: string
  notes?: string
  isCurrent?: boolean
}

interface VisitExport {
  id: string
  airportIdent: string
  date: string
  flightNumbers?: string[]
  isLayover?: boolean
  notes?: string
  photos?: string[]
}

interface AirportExport {
  ident: string
  iata_code: string
  name: string
  lat: number
  lon: number
  continent: string
  iso_country: string
  iso_region: string
  municipality: string
  elevation_ft: number
}

interface RecommendationExport {
  id: string
  bookName: string
  bookAuthor?: string
  bookCoverUrl?: string
  googleBooksId?: string
  recommenderName?: string
  comment?: string
  timestamp: number
}

function transformBook(book: BookExport) {
  return {
    // Generate new UUID for consistency, keeping track of old IDs isn't needed
    title: book.title,
    author: book.author,
    isbn: book.isbn || null,
    cover_url: book.coverUrl || null,
    description: book.description || null,
    categories: book.categories || null,
    progress: book.progress || null,
    status: book.status,
    date_started: book.dateStarted,
    date_completed: book.dateCompleted || null,
    notes: book.notes || null,
    is_current: book.isCurrent || false
  }
}

function transformVisit(visit: VisitExport) {
  return {
    // Generate new UUID
    airport_ident: visit.airportIdent,
    visit_date: visit.date,
    flight_numbers: visit.flightNumbers || null,
    is_layover: visit.isLayover || false,
    notes: visit.notes || null,
    photos: visit.photos || null
  }
}

function transformAirport(airport: AirportExport) {
  return {
    ident: airport.ident,
    iata_code: airport.iata_code,
    name: airport.name,
    lat: airport.lat,
    lon: airport.lon,
    continent: airport.continent,
    iso_country: airport.iso_country,
    iso_region: airport.iso_region,
    municipality: airport.municipality || null,
    elevation_ft: airport.elevation_ft || null
  }
}

function transformRecommendation(rec: RecommendationExport) {
  return {
    id: rec.id, // Keep existing UUIDs for recommendations
    book_name: rec.bookName,
    book_author: rec.bookAuthor || null,
    book_cover_url: rec.bookCoverUrl || null,
    google_books_id: rec.googleBooksId || null,
    recommender_name: rec.recommenderName || null,
    comment: rec.comment || null,
    created_at: new Date(rec.timestamp).toISOString()
  }
}

async function main() {
  console.log('🚀 Starting Supabase migration...\n')

  const exportDir = join(process.cwd(), 'data-export')

  // 1. Migrate airports first (needed for foreign keys)
  console.log('🌍 Migrating airports reference data...')
  const airportsData = JSON.parse(
    readFileSync(join(exportDir, 'airports.json'), 'utf-8')
  ) as AirportExport[]

  const airportsToInsert = airportsData.map(transformAirport)
  const { data: airportsResult, error: airportsError } = await supabase
    .from('airports')
    .insert(airportsToInsert)
    .select('ident')

  if (airportsError) {
    console.error('  ❌ Error migrating airports:', airportsError)
    throw airportsError
  }
  console.log(`  ✅ Migrated ${airportsResult.length} airports\n`)

  // 2. Migrate books
  console.log('📚 Migrating books...')
  const booksData = JSON.parse(
    readFileSync(join(exportDir, 'books.json'), 'utf-8')
  ) as BookExport[]

  const booksToInsert = booksData.map(transformBook)
  const { data: booksResult, error: booksError } = await supabase
    .from('books')
    .insert(booksToInsert)
    .select('id')

  if (booksError) {
    console.error('  ❌ Error migrating books:', booksError)
    throw booksError
  }
  console.log(`  ✅ Migrated ${booksResult.length} books\n`)

  // 3. Migrate visits
  console.log('✈️  Migrating airport visits...')
  const visitsData = JSON.parse(
    readFileSync(join(exportDir, 'visits.json'), 'utf-8')
  ) as VisitExport[]

  // Filter out visits for airports that don't exist in our reference data
  const validAirportIdents = new Set(airportsData.map(a => a.ident))
  const validVisits = visitsData.filter(v => {
    const isValid = validAirportIdents.has(v.airportIdent)
    if (!isValid) {
      console.log(`  ⚠️  Skipping visit for unknown airport: ${v.airportIdent}`)
    }
    return isValid
  })

  const visitsToInsert = validVisits.map(transformVisit)
  const { data: visitsResult, error: visitsError } = await supabase
    .from('visits')
    .insert(visitsToInsert)
    .select('id')

  if (visitsError) {
    console.error('  ❌ Error migrating visits:', visitsError)
    throw visitsError
  }
  console.log(`  ✅ Migrated ${visitsResult.length} visits\n`)

  // 4. Migrate recommendations
  console.log('💡 Migrating book recommendations...')
  const recommendationsData = JSON.parse(
    readFileSync(join(exportDir, 'recommendations.json'), 'utf-8')
  ) as RecommendationExport[]

  if (recommendationsData.length === 0) {
    console.log('  ℹ️  No recommendations to migrate\n')
  } else {
    const recommendationsToInsert = recommendationsData.map(transformRecommendation)
    const { data: recsResult, error: recsError } = await supabase
      .from('recommendations')
      .insert(recommendationsToInsert)
      .select('id')

    if (recsError) {
      console.error('  ❌ Error migrating recommendations:', recsError)
      throw recsError
    }
    console.log(`  ✅ Migrated ${recsResult.length} recommendations\n`)
  }

  // 5. Verify migration
  console.log('🔍 Verifying migration...')

  const { count: booksCount } = await supabase
    .from('books')
    .select('*', { count: 'exact', head: true })

  const { count: visitsCount } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })

  const { count: airportsCount } = await supabase
    .from('airports')
    .select('*', { count: 'exact', head: true })

  const { count: recsCount } = await supabase
    .from('recommendations')
    .select('*', { count: 'exact', head: true })

  console.log('\n✨ Migration complete!\n')
  console.log('Summary:')
  console.log(`  📚 Books: ${booksCount} (expected ${booksData.length})`)
  console.log(`  ✈️  Visits: ${visitsCount} (expected ${validVisits.length})`)
  console.log(`  🌍 Airports: ${airportsCount} (expected ${airportsData.length})`)
  console.log(`  💡 Recommendations: ${recsCount} (expected ${recommendationsData.length})`)

  // Check for current book
  const { data: currentBook } = await supabase
    .from('books')
    .select('title, is_current')
    .eq('is_current', true)
    .single()

  if (currentBook) {
    console.log(`\n📖 Current book: ${currentBook.title}`)
  }

  console.log('\n✅ All data successfully migrated to Supabase!')
}

main().catch(console.error)
