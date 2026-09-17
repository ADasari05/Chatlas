# Chatlas

**Senior Capstone Project — Purdue University (CS 40800)**

---

## Overview

**Chatlas** is a senior capstone project designed for collaborative communication and mapping. 

### Planned Tech Stack
- **Frontend:** React.js
- **Backend & Authentication:** [Supabase](https://supabase.com)
- **Database:** PostgreSQL (hosted and managed via Supabase)
- **Security:** Row Level Security (RLS) policies

---

## Current Status & Roadmap

- [x] Repository initialized with Git and GitHub integration
- [x] Security and ignore rules configured (`.gitignore`, `.env.example`)
- [x] Supabase project created with PostgreSQL database & Auth enabled
- [ ] Team members onboarded to GitHub repository & Supabase organization
- [ ] Frontend application initialization (React.js)
- [ ] Database schema definition & Row Level Security (RLS) setup
- [ ] Core feature implementation

---

## Team Setup Guide

Group members joining the project should follow these steps to get their local development environment set up:

### 1. Prerequisites
- **Git:** Install [Git for Windows / macOS](https://git-scm.com/)
- **Node.js:** Install Node.js (LTS version recommended)
- **VS Code:** Recommended code editor

### 2. Clone the Repository
```bash
git clone https://github.com/ADasari05/Chatlas.git
cd Chatlas
```

### 3. Environment Variables Setup
1. Duplicate `.env.example` and name the new file `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your project credentials from the Supabase dashboard (**Project Settings → API**):
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your **`anon` (public)** API key

> [!WARNING]
> **Security Notice:**
> - Only use the **`anon` (public)** key in client-side code and `.env`.
> - **Never** commit the `.env` file to Git (it is already ignored by `.gitignore`).
> - **Never** paste the `service_role` secret key into frontend code or local client configs, as it bypasses all Row Level Security.
