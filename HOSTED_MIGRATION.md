# Darsync hosted migration (GitHub Pages + Supabase)

This branch starts the migration without changing the existing `master` deployment.

## Current state

- [x] Create an isolated migration branch: `migration/github-pages-supabase`.
- [x] Add the initial Supabase schema and Row Level Security policies:
  `supabase/migrations/202611050001_initial_schema.sql`.
- [ ] Apply the SQL in a new Supabase project.
- [ ] Create the first administrator securely.
- [ ] Adapt the existing frontend API client to Supabase Auth/Postgres/Storage.
- [ ] Replace FastAPI PDF ingestion with browser-side PDF.js extraction and Arabic OCR.
- [ ] Move lesson generation behind a Supabase Edge Function (NVIDIA key stays server-side).
- [ ] Configure and test GitHub Pages paths and deployment.
- [ ] Import existing SQLite data and PDFs, if they need to be retained.

## Important

The existing UI is plain HTML/CSS/JavaScript in `frontend/`, not React. It currently calls relative FastAPI routes such as `/api/auth/login`, `/api/files`, `/api/taxonomy`, and streams lessons from `/api/chats/{id}/stream`. Publishing these files to GitHub Pages alone will **not** make the application work. The frontend must be migrated to Supabase before Pages is enabled for production.

Do not point GitHub Pages at `master` yet. This branch is an isolated migration workspace; the existing FastAPI app remains unchanged on `master`.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run the complete SQL migration in `supabase/migrations/202611050001_initial_schema.sql`.
3. In **Authentication → Providers**, enable Email sign-in. For a closed five-account pilot, disable public sign-ups after the initial accounts are provisioned, or use an administrator-controlled invite flow.
4. In **Project Settings → API**, copy the Project URL and the publishable/anon key. These are intended for browser use when RLS is correctly configured. Never put the `service_role` key or NVIDIA API key in frontend files, GitHub, or Pages secrets exposed to browser code.
5. Keep the `study-pdfs` bucket private. The migration creates it with a 100 MiB per-file limit as a conservative starting point; adjust only after confirming the selected plan and upload path support the intended size.

### First administrator

The migration deliberately creates every new profile as role `user`. Do not accept a role from browser signup metadata. After creating the owner account, promote that exact profile from the Supabase SQL Editor, using its verified auth user UUID:

```sql
update public.profiles
set role = 'super_admin',
    permissions = '{"update_rag":true,"add_rag":true,"remove_rag":true}'::jsonb
where id = '<AUTH_USER_UUID>';
```

Never expose a public endpoint that lets a user promote themselves.

## Data migration

The old app stores users, taxonomy, study files, chats, messages, feedback, OCR page indexes and indexing jobs in SQLite, with PDFs in `uploads/`. The SQL schema provides hosted equivalents, but no data has been copied automatically. Before switching production, export/import the records and upload each PDF to the private Storage bucket, preserving the file IDs and course scope.

## Browser-side document processing

Use PDF.js for page rendering and native text extraction. Use Tesseract.js with the Arabic language pack only for scanned pages or pages with insufficient embedded text. OCR runs on the user's device, so large PDFs may be slow and require browser memory; process pages in batches and persist extracted page text to Postgres. This replaces PaddleOCR on the server, not the need for OCR itself.

## AI lesson generation

Use a Supabase Edge Function as the trusted proxy to NVIDIA. Store `NVIDIA_API_KEY` as an Edge Function secret. Verify the caller's Supabase JWT, validate the requested chat and course scope, retrieve only authorized indexed passages, then call NVIDIA. The browser must never receive the NVIDIA secret. Edge Functions have execution/resource limits, so they should orchestrate bounded retrieval and generation, not run heavyweight OCR or parse huge PDFs.

## GitHub Pages

GitHub Pages serves only static files. The production workflow should be enabled only after the API migration is complete and all asset paths work under the project subpath `/Darsync/`. The current HTML uses root-absolute `/static/...` paths and FastAPI routes, so it is not Pages-ready yet.
