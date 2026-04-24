# GitHub Issue Investigator (Web)

Issue-driven investigation app for engineers.  
You sign in with GitHub OAuth, submit an issue URL (or repo + issue number), and the app runs read-only GitHub tools to produce:

- facts found from the repository
- hypotheses
- suggested next steps
- draft maintainer comment

## Features in this MVP

- GitHub OAuth login (Auth.js + GitHub provider)
- Server-side Octokit tools (read only)
- Streamed assistant output with tool call parts (AI SDK UI stream protocol)
- Issue input form (URL / owner / repo / issue number / optional focus path + ref)

## 1) Prerequisites

- Node.js 20+ (LTS recommended)
- npm
- GitHub OAuth App (Client ID + Client Secret)
- LLM provider key (OpenAI-compatible, default uses OpenAI provider)

## 2) GitHub OAuth setup

Create an OAuth app in [GitHub Developer Settings](https://github.com/settings/developers):

- **Application name**: `Issue Investigator Dev` (or any name)
- **Homepage URL**: `http://localhost:3000`
- **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`

Save:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

## 3) Environment variables

Create `.env.local` from template:

```bash
cp .env.local.example .env.local
```

Fill values:

- `AUTH_SECRET`
- `NEXTAUTH_URL` (local: `http://localhost:3000`)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` (optional; OpenAI-compatible root **without** `/chat/completions`, e.g. `https://yinli.one/v1`)
- `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)

**Quick LLM check** (no GitHub login): with `npm run dev` running,

```bash
curl -s -X POST http://localhost:3000/api/llm-test -H "Content-Type: application/json" -d "{}"
```

## 4) Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with GitHub, and start an investigation.

## 5) Demo script (2-3 minutes)

1. Sign in with GitHub.
2. Paste an issue URL such as `https://github.com/vercel/next.js/issues/<number>`.
3. Click **Start Investigation**.
4. Show streamed output sections:
   - Facts Found
   - Hypotheses
   - Suggested Next Steps
   - Draft Maintainer Comment
5. Highlight that all GitHub operations are read-only in MVP.

## 6) Deploy on Vercel

1. Push repository to GitHub.
2. Import project in Vercel.
3. Configure env vars in Vercel project settings:
   - `AUTH_SECRET`
   - `NEXTAUTH_URL` (your production URL)
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (optional)
4. Update GitHub OAuth callback URL to production:
   - `https://your-domain/api/auth/callback/github`
5. Redeploy and verify login + investigation flow.

## Security notes

- Keep OAuth and LLM keys server-side only.
- Do not commit `.env.local`.
- Rotate secrets if exposed.
