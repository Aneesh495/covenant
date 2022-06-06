# covenant

Upload PDF or DOCX. Text extraction and model-backed review on the server; dashboard on the client. Postgres through Drizzle. Anonymous sessions only.

```bash
cp .env.example .env
npm install
npm run db:push
npm run dev
```

Production needs `SESSION_SECRET` and `OPENAI_API_KEY`. Parsing errors return 422; no placeholder documents.

`client/` · UI · `server/` · API · `shared/` · schema  

More detail: `docs/ARCHITECTURE.md`
