# Darsync hosted migration — GitHub Pages + Supabase

This work is isolated on `migration/github-pages-supabase`. The existing `master` branch and its FastAPI deployment have not been intentionally changed.

## Implemented in this branch

- Supabase browser client with persistent Auth sessions; login uses email/password and reads the role from `public.profiles`.
- PostgreSQL schema and RLS policies, including a database-side five-account cap.
- Supabase private Storage bucket `study-pdfs` for uploaded PDFs (100 MiB per file in the migration).
- Browser-side PDF.js extraction. Pages with fewer than 80 extracted characters are sent through Tesseract.js Arabic + English OCR.
- Extracted page text, Arabic-normalized search text, and text-region coordinates are stored in `study_pages`; reindexing uses generation IDs so the old index stays active until a new index is inserted.
- Supabase Edge Function `lesson` verifies the signed-in user, retrieves pages in the chat's course scope, calls NVIDIA with a server-side secret, streams SSE events to the existing lesson UI, and stores messages.
- Supabase Edge Function `admin-users` provides super-admin-only account creation, listing, role/permission changes and deletion. It uses the server-side Supabase service-role key only inside the Edge Function.
- Feedback read/write operations and taxonomy management use Supabase directly.
- PDF source-page previews are rendered in the browser from private Storage downloads.

## Still required before production

- Apply both SQL migrations to the Supabase project.
- Set the NVIDIA Edge Function secret and deploy both Edge Functions.
- Create the first `super_admin` account and test login, upload, Arabic OCR, reindex, source preview, lesson streaming, and feedback.
- Review the remaining UI flows and run an end-to-end test on desktop and mobile.
- Import old SQLite users/chats/feedback and PDFs only if that data must be retained. No old data has been copied.
- Enable GitHub Pages only after the tests pass.

The app is not live merely because these files exist in GitHub. No SQL was executed against your Supabase project, no Edge Function has been deployed, and no production Pages deployment has been enabled from this branch.

## 1. Apply the database migrations

In Supabase Dashboard → **SQL Editor**, run these files in this order:

1. `supabase/migrations/202611050001_initial_schema.sql`
2. `supabase/migrations/202611050002_hosted_pdf_ai.sql`

The second migration is a safe repair/patch for the super-admin RLS function and adds a scope index. It is okay to run after the first migration.

The migration creates a private `study-pdfs` Storage bucket with a 100 MiB per-file limit. Keep it private. PDF uploads are allowed only to admins under the current RLS policies.

## 2. Create the first owner account

1. In Authentication → Providers, enable Email sign-in.
2. In Authentication → Users, create the owner's email/password account and confirm the email if needed.
3. Copy that user's UUID.
4. Run this in SQL Editor, replacing the placeholder with that exact UUID:

```sql
update public.profiles
set role = 'super_admin',
    permissions = '{"update_rag":true,"add_rag":true,"remove_rag":true}'::jsonb
where id = '<AUTH_USER_UUID>';
```

5. Sign in to Darsync with that email and password.

Every new profile starts as `user`; browser metadata cannot assign privileged roles. The database trigger rejects a sixth Auth account. For the private pilot, disable public sign-ups and let the super-admin create accounts from the app.

## 3. Configure and deploy Edge Functions

Install the Supabase CLI and run these commands from the repository root in PowerShell:

```powershell
supabase login
supabase link --project-ref ttbqqxpgcnijguoygsdz
supabase db push
supabase secrets set NVIDIA_API_KEY="YOUR_NVIDIA_API_KEY"
supabase secrets set NVIDIA_CHAT_MODEL="minimaxai/minimax-m3.1-flash"
supabase functions deploy lesson
supabase functions deploy admin-users
```

Supabase provides its project URL, anon key and service-role key to Edge Functions at runtime. The `admin-users` function uses the service-role key only on the server. Do not put it in the frontend or commit it to GitHub. If the runtime does not expose it in your project, configure it as an Edge Function secret from the Dashboard; never send it in chat.

The NVIDIA API key must be entered directly into the Supabase secret configuration. Do not paste it into `supabase-config.js`, frontend code, GitHub files, or this conversation.

Default NVIDIA endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`. To override it, set `NVIDIA_API_URL` as an Edge Function secret.

## 4. How PDF processing works

- Admin uploads a PDF directly to the private `study-pdfs` bucket.
- PDF.js extracts embedded text page-by-page in the browser.
- If a page has fewer than 80 characters of embedded text, Tesseract.js runs Arabic + English OCR for that page.
- Page text and region coordinates are stored in Postgres. Arabic text is normalized for lexical matching.
- The browser downloads the private PDF again only when it needs to render a source-page preview.
- OCR is client-side, not a Supabase Edge Function workload. Large/scanned PDFs may take time and use device memory.

PDF.js and Tesseract.js are loaded from public CDNs, and Tesseract downloads its language data when needed. The site therefore needs an internet connection for these assets and for Supabase/NVIDIA calls.

## 5. Lesson generation

The frontend calls `/functions/v1/lesson` with the user's Supabase access token. The function verifies the user and chat ownership, retrieves only study pages matching the chat's grade/subject/semester/topic, then calls NVIDIA and streams the response in the event format expected by the current lesson player.

The browser never receives the NVIDIA API key. The function does not run OCR or parse PDF files.

## 6. GitHub Pages

The frontend uses relative `static/...` asset paths for the repository subpath. After the Supabase setup and end-to-end tests pass, configure Pages to deploy the `frontend/` folder (or use the included workflow when added). Do not switch the production site to this branch before verifying the pilot.

## 7. Data retention and limits

The Supabase project currently uses a private Storage bucket and Postgres. Free-tier quotas and inactivity pausing can change; do not treat free hosting as a guaranteed lifetime service. The current app pilot is limited to five Auth accounts by a database trigger and the admin provisioning function.
