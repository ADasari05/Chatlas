# Chatlas

Senior Capstone Project — Purdue University (CS 40800)

## Tech Stack
- **Frontend:** React.js
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
Create a local `.env` file from the template:

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase project credentials (**Project Settings → API**):
- `VITE_SUPABASE_URL`: Your Supabase Project URL
- `VITE_SUPABASE_ANON_KEY`: Your **`anon` (public)** key

> [!IMPORTANT]
> Always use the **`anon` (public)** key for client-side development. Never commit `.env` or use the `service_role` secret key.
