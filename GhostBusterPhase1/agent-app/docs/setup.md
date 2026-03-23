# Setup Guide

1. **Install dependencies**
   ```bash
   cd agent-app
   npm install
   ```
2. **Create Supabase project**
   - Run `supabase db push` with `supabase/schema.sql` or paste the SQL file in the dashboard SQL editor.
   - Create a storage bucket called `debug-assets` with `public` access.
3. **Seed demo code**
   ```bash
   npm run seed:supabase
   ```
4. **Configure environment** – copy `.env.example` (create it) to `.env.local`.
5. **Start dev server**
   ```bash
   npm run dev
   ```
6. **Load Chrome extension**
   - Open `chrome://extensions` → enable Developer Mode → Load unpacked → `extension/` folder.
   - Update options with API base URL `http://localhost:3000` (dev) and Clerk session token if needed.
