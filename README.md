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

## MVP Scope

- Paste CSV with `Question,Answer,Context,Explanation`.
- Review one local deck from browser storage.
- Ask for one hint when stuck.
- Submit typed answer for LLM critique.
- Self-rate with `Again`, `Hard`, `Good`, or `Easy`.

No Anki sync, auth, multi-deck support, or full answer history.
