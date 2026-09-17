# Chatlas

Senior Capstone Project — Purdue University (CS 40800)

## Tech Stack
- **Frontend & App Framework:** [Next.js](https://nextjs.org/) (React)
- **Backend & Auth:** [Supabase](https://supabase.com)
- **Database:** PostgreSQL (managed via Supabase)

---

## Getting Started

### 1. Prerequisites
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (LTS recommended)

### 2. Clone the Repository
```bash
git clone https://github.com/ADasari05/Chatlas.git
cd Chatlas
```

### 3. Environment Configuration
Create a local environment file from the template:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your Supabase project credentials (**Project Settings → API**):
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your **`anon` (public)** key

### 4. Install Dependencies
```bash
npm install
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

> [!IMPORTANT]
> Always use the **`anon` (public)** key for client-side development. Never commit `.env` / `.env.local` or use the `service_role` secret key.

