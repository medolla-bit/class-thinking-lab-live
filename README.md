# Class Thinking Lab

## Make it live

This app is deployment-ready as a Node web service.

Recommended easiest path: **Render**.

1. Push this folder to a GitHub repository.
2. In Render, create a new **Web Service** from that repo.
3. Use:
   - Build command: leave blank
   - Start command: `node server.js`
4. Create the Supabase tables by running `supabase-schema.sql` in the Supabase SQL Editor.
5. Add environment variables in Render:
   - `OPENAI_API_KEY`: your real OpenAI API key
   - `OPENAI_MODEL`: `gpt-4.1-mini`
   - `SUPABASE_URL`: your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: your Supabase service role key
6. Deploy.

Render will give you a public URL that works from any network.

If Supabase variables are present, class sessions, students, thoughts, nudges, final pieces, and class poems are stored in Supabase. If Supabase variables are missing, the app falls back to temporary in-memory sessions for local demos.

## Local live AI

Run locally with live AI:

```bash
cp .env.example .env
```

Put your real OpenAI API key in `.env`, then start:

To use Supabase locally too, also add:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

```bash
node server.js
```

Open:

```text
http://127.0.0.1:3000
```

Temporary local click-through mode:

```bash
AI_TEST_MODE=1 node server.js
```

Do not use test mode for real student coaching.
