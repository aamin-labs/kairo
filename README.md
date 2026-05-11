# Kairo Review

Small Anki-style review app with LLM feedback.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set:

```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

## Deploy on Vercel

This is a standard Next.js app; Vercel auto-detects it.

1. Push this repo to GitHub.
2. In Vercel, import the repo as a Next.js project.
3. Add environment variables in Vercel Project Settings:
   - `ANTHROPIC_API_KEY`
   - `ANTHROPIC_MODEL` (optional; defaults to `claude-sonnet-4-6`)
4. Deploy. Build command stays `npm run build`; install command stays `npm install`.

API routes use a 30-second max duration for Anthropic calls.

## MVP Scope

- Paste CSV with `Question,Answer,Context,Explanation`.
- Add more CSV cards later without resetting existing review progress.
- Review one local deck from browser storage.
- Ask for one hint when stuck.
- Submit typed answer for LLM critique.
- Self-rate with `Again`, `Hard`, `Good`, or `Easy`.

No Anki sync, auth, multi-deck support, or full answer history.
