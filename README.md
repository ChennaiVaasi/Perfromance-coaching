# Performance Coaching

MVP coaching app for:

- uploading a user PDF report
- extracting report text
- detecting a persona from the report
- giving the coach a shared dashboard across uploaded users

## Run locally

```bash
npm install
npm start
```

Open `http://127.0.0.1:4783`.

## Current scope

- PDF upload only
- in-memory PDF processing with saved JSON records
- persona engine based on report text heuristics
- coach dashboard that can review all uploaded users

## Next useful upgrades

- API-based report ingestion
- stronger metric extraction from structured report formats
- authentication for coach access
- persistent database instead of JSON file
