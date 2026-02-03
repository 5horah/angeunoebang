# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

필사 모임 출석 시스템 (Pilsa Group Attendance System) - A check-in system for a Korean writing study group. Members mark daily attendance, confirm completion with checkboxes, and view weekly statistics with rankings.

## Commands

```bash
npm run dev      # Start development server (port 3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Tech Stack

- **Next.js 16** with App Router
- **React 19** with TypeScript (strict mode)
- **Tailwind CSS 4** for styling
- **Supabase** (PostgreSQL) for backend
- **date-fns** with Korean locale for date handling

## Architecture

```
app/
├── page.tsx              # Main check-in page (client component)
├── stats/page.tsx        # Weekly statistics & ranking page
├── api/weekly-report/    # GET endpoint for automated weekly reports
├── layout.tsx            # Root layout with Geist font
└── globals.css           # Tailwind + custom animations (scale-in, slide-up, slide-down)

lib/
└── supabase.ts           # Supabase client initialization
```

## Database Schema (Supabase)

**`members` table:**

- `id`, `name`, `emoji`

**`attendance` table:**

- `member_name`, `check_in_date` (yyyy-MM-dd format)
- Unique constraint on (member_name, check_in_date)

## Key Patterns

- All pages use `'use client'` directive with React hooks for state management
- Direct Supabase queries (no ORM) using `.from().select()` pattern
- Korean UI text throughout - maintain Korean language in user-facing strings
- Path alias: `@/*` maps to project root
- Database columns use snake_case (`check_in_date`, `member_name`)

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

For image cleanup cron (server-only, do not expose to client):

```
SUPABASE_SERVICE_ROLE_KEY=
```

## Deployment

Deployed on Vercel with cron jobs in `vercel.json`:

- `/api/weekly-report` — 매주 토요일 00:00
- `/api/cleanup-old-images` — 매월 1일 03:00 (한 달 지난 인증 이미지 Storage 삭제 + DB `image_url` NULL 처리)

## 커밋 방법

git add .
git commit -m "Add: 통계 페이지 카톡 공유 기능 (클립보드 복사)"
git push origin main
