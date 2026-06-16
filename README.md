# Misinfo Tracker

Community-driven misinformation lifecycle tracking platform built with **Next.js 16** + **Supabase**.

---

## Quick Start

### 1. Environment variables (most common issue!)

`.env.local` must be a **file** in the project root — NOT a folder.

```bash
# Check: this should print a file, not "directory"
ls -la .env.local

# If it's a directory, delete it and recreate as a file:
rm -rf .env.local
cp .env.local.example .env.local
# Then open .env.local and paste your Supabase keys
```

Get your keys from: **Supabase Dashboard → Project Settings → API**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-full-anon-key-here
```

### 2. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll see a Supabase connection status indicator.

---

## Project Structure

```
misinformation-app/
├── app/
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home / connection test
├── lib/
│   ├── supabase.ts         # Browser client (use in "use client" components)
│   ├── supabase-server.ts  # Server client (use in Server Components)
│   └── types.ts            # TypeScript types matching your DB schema
├── .env.local              # Your secrets (must be a FILE, not a folder)
└── .env.local.example      # Template — safe to commit
```

## Supabase Client Usage

**In Client Components** (`"use client"`):
```ts
import { supabase } from "@/lib/supabase";

const { data, error } = await supabase.from("claims").select("*");
```

**In Server Components / Route Handlers**:
```ts
import { createServerSupabaseClient } from "@/lib/supabase-server";

const supabase = await createServerSupabaseClient();
const { data } = await supabase.from("claims").select("*");
```

---

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **TypeScript**
- **Tailwind CSS v4**
