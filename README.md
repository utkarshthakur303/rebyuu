# Rebyuu – Anime Discovery Platform

This is a code bundle for Rebyuu, an anime discovery and review platform. The original project is available at https://www.figma.com/design/8qLrGOMplrJZutb2Da0ZAl/Anime-Discovery-Web-App.

## Setup

1. Install dependencies:
   ```bash
   npm i
   ```

2. Set up Supabase:
   - Create a new project at https://supabase.com
   - Go to Project Settings > API
   - Copy your Project URL and anon/public key

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_KEY=your_supabase_anon_key
   ```

4. Set up the database:
   - In Supabase Dashboard, go to SQL Editor
   - Run the SQL from `supabase/schema.sql` to create tables and RLS policies

5. Sync anime data from AniList:
   ```bash
   npm run sync:anime
   ```
   Note: You may need to set `SUPABASE_SERVICE_ROLE_KEY` in your environment for the sync script.

6. Start the development server:
   ```bash
   npm run dev
   ```

## Features

- User authentication (email/password and Google OAuth)
- Browse and search anime
- View anime details and reviews
- Create and manage custom lists
- Rate and review anime
- User profiles with bio and avatar
- Admin panel for moderating comments

## Tech Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Supabase (PostgreSQL + Auth)
- External API: AniList GraphQL API

## Project Structure

- `src/app/` - React components and pages
- `src/services/` - Supabase client and service functions
- `src/context/` - React context providers (Auth)
- `supabase/` - Database schema SQL
- `scripts/` - Utility scripts (AniList sync)