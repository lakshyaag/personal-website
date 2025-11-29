# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website for Lakshya Agarwal built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS 4. Features a blog with MDX support, project showcase, bookshelf with recommendations, airport visit tracker, and workout tracking.

## Common Commands

```bash
# Development
npm run dev              # Start dev server with webpack (runs on http://localhost:3000)

# Build & Deploy
npm run build            # Production build with webpack
npm start                # Start production server

# Code Quality
npm run lint             # Run ESLint
```

## Architecture & Structure

### Framework & Routing
- **Next.js 16** with App Router architecture
- All routes in `app/` directory follow Next.js file conventions
- MDX blog posts in `app/blogs/(blogs)/[slug]/page.mdx` with grouped routing
- API routes in `app/api/` using Route Handlers (GET/POST/DELETE patterns)

### Data Storage Pattern
All dynamic data uses Vercel Blob Storage with a consistent pattern:
- Storage modules: `lib/*-storage.ts` (books, workouts, visits, recommendations)
- Each module exports `get*()` and `save*()` functions
- Public URLs constructed from `BLOB_READ_WRITE_TOKEN` environment variable
- JSON files stored with public access at predictable paths (e.g., `books/library.json`)

### MDX Configuration
- MDX pages configured in `next.config.mjs` with custom plugins:
  - `remark-gfm` - GitHub Flavored Markdown
  - `remark-math` - Math notation support
  - `rehype-katex` - KaTeX rendering for equations
  - `rehype-highlight` - Syntax highlighting
- Blog layout in `app/blogs/(blogs)/layout.tsx` includes scroll progress and back navigation
- Custom styles: `lib/styles/tokyo-night-dark.css` for code highlighting

### Component Organization
- Reusable UI components in `components/ui/` (animations, effects, interactions)
- Feature components in `components/` (BookCard, ProjectItem, etc.)
- Motion/animation components using Framer Motion (`motion` package)

### Path Aliases
- `@/*` maps to project root (defined in `tsconfig.json`)
- Use for all internal imports: `@/lib/...`, `@/components/...`

### API Security
- Admin endpoints (books, workouts, airports) use API key authentication
- `lib/api-key-auth.ts` provides `verifyApiKey()` and `checkApiKeyRateLimit()`
- Rate limiting: 10 requests per minute per API key
- Required env vars: `WORKOUT_API_KEY`, `BLOB_READ_WRITE_TOKEN`

### Styling
- Tailwind CSS 4 with PostCSS
- Dark mode via `next-themes` (system/light/dark)
- Typography plugin for prose content (`@tailwindcss/typography`)
- Uses Geist and Geist Mono fonts from `next/font/google`

### Key Features

**Blog System:**
- Posts defined in `lib/data/blogs.ts` with metadata (title, description, tags, date)
- Content in individual MDX files with math and code highlighting support
- Dynamic OG image generation at `app/api/og/blogs/[slug]/route.tsx`

**Bookshelf:**
- Public recommendations via `/api/recommend` (POST to submit, GET to list)
- Admin interface at `/admin/books` for managing library
- Drag-and-drop reordering via `/api/books/reorder`

**Airport Visits:**
- Interactive map using Leaflet/React-Leaflet (client-side only)
- Visit tracking with timestamps
- Admin interface at `/admin/airports`

### Analytics & Monitoring
- Vercel Analytics (`@vercel/analytics`)
- Vercel Speed Insights (`@vercel/speed-insights`)
- GoatCounter analytics (script loaded in root layout)

## Development Notes

- **Webpack Mode:** Development and build commands use `--webpack` flag explicitly
- **Client Components:** Leaflet maps and interactive components require `"use client"` directive
- **Image Optimization:** Remote images allowed from `books.google.com` and `public.blob.vercel-storage.com`
- **Static Data:** Jobs, projects, and social links defined in `lib/data/` as TypeScript constants
