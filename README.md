# GitHub Issue Investigator

Evidence-backed GitHub issue investigation assistant for engineers.

## Problem

AI issue summaries are easy to generate and hard to trust. Maintainers need short answers that separate observed repository facts from guesses, cite where each fact came from, and keep repository access read-only.

## What It Does

Sign in with GitHub OAuth, submit an issue URL or repository metadata, and run a read-only investigation that returns:

- evidence-backed facts with source labels and links
- concrete next actions
- a maintainer-ready draft comment

Example input:

```txt
https://github.com/vercel/next.js/issues/<number>
Focus path: packages/next/src/server
```

Example structured output:

```json
{
  "schemaVersion": "1.2",
  "facts": [
    {
      "text": "The issue is open and labeled as a bug.",
      "sourceType": "issue",
      "sourceLabel": "Issue #123",
      "sourceUrl": "https://github.com/example/project/issues/123"
    }
  ],
  "whatToDo": ["Reproduce the request with the issue payload."],
  "draftMaintainerComment": "Thanks for the report. The linked issue is open and labeled as a bug, so I would start by reproducing the request payload..."
}
```

## Why It Is Reliable

- **Structured output**: the prompt requires JSON and Zod validates the model response before the UI renders it.
- **Evidence-backed facts**: every fact must include `sourceType`, `sourceLabel`, and `sourceUrl` (empty when no URL is available).
- **Read-only tools**: the GitHub toolset reads issues, comments, repository metadata, directories, files, and code search results only.
- **Failure-aware behavior**: permission and rate-limit failures become one clear `api_error` fact and one recovery action.
- **Deterministic evals**: `npm run eval` checks schema shape, source coverage, draft presence, and markdown-fence rejection without requiring an LLM key.

## Demo Flow

1. Sign in with GitHub.
2. Paste an issue URL or provide owner, repo, and issue number.
3. Click **Start Investigation**.
4. Show **Facts with Sources**, **Next Actions**, and **Draft Maintainer Comment**.
5. Use **Copy draft** to copy the maintainer response.

## Architecture

- **Next.js App Router** for UI and route handlers.
- **NextAuth GitHub OAuth** stores the GitHub access token in a server-side JWT session.
- **Octokit read-only tools** expose issue, comment, repo, directory, file, and code-search reads to the model.
- **AI SDK streaming** returns a UI message stream from `/api/investigate` using the OpenAI-compatible chat API for stable tool calls.
- **Zod report schema** validates `schemaVersion: "1.2"` and source-backed facts before rendering.

## AI Engineering Highlights

- Prompt rules require tool-backed evidence before facts.
- Facts and recommended actions are separated in the data model and UI.
- API permission failures are handled as evidence rather than hidden behind generic model prose.
- Evals can run locally without secrets, making the project easy to inspect during review.

## Prerequisites

- Node.js 20+
- npm
- GitHub OAuth App
- OpenAI-compatible LLM provider key

## Environment Variables

Create `.env.local` from the template:

```bash
cp .env.local.example .env.local
```

Fill values:

- `AUTH_SECRET`
- `NEXTAUTH_URL` such as `http://localhost:3000`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_MARKETPLACE_WEBHOOK_SECRET` for GitHub Marketplace webhook verification
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` optional OpenAI-compatible root, without `/chat/completions`
- `OPENAI_MODEL` optional, defaults to `gpt-4o-mini`

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Quick LLM check without GitHub login:

```bash
curl -s -X POST http://localhost:3000/api/llm-test -H "Content-Type: application/json" -d "{}"
```

## Quality Checks

```bash
npm run lint
npm run eval
```

On Windows PowerShell, use `npm.cmd run lint` or `npm.cmd run eval` if script execution policy blocks `npm.ps1`.

## Deploy on Vercel

1. Push repository to GitHub.
2. Import the project in Vercel.
3. Configure the same environment variables in Vercel project settings.
4. Update the GitHub OAuth callback URL to `https://your-domain/api/auth/callback/github`.
5. Redeploy and verify login plus investigation flow.

## Deploy on Render with Docker

The app includes a multi-stage `Dockerfile` and uses Next.js standalone output for a small production image.

Local Docker check:

```bash
docker build -t issue-investigator-dev .
docker run --rm -p 3000:3000 --env-file .env.local issue-investigator-dev
```

Render Dashboard settings:

- Service type: Web Service
- Runtime: Docker
- Repository: `https://github.com/peixiaotan1/issue-investigator-dev`
- Branch: `master`
- Health check path: `/api/health`
- Auto deploy: enabled

Configure the same environment variables in Render. After the first deploy, set `NEXTAUTH_URL` to the Render service URL and update the GitHub OAuth callback URL to:

```txt
https://your-render-service.onrender.com/api/auth/callback/github
```

Redeploy after updating those values, then verify `/api/health`, GitHub login, `/api/llm-test`, and one investigation flow.

## GitHub Marketplace Webhook

Use this endpoint for the Marketplace listing webhook:

```txt
https://your-render-service.onrender.com/api/github-marketplace-webhook
```

Recommended settings:

- Content type: `application/json`
- Secret: a random long string also configured as `GITHUB_MARKETPLACE_WEBHOOK_SECRET`

The endpoint verifies GitHub's `X-Hub-Signature-256` HMAC signature and returns `200` for valid deliveries. It currently acknowledges Marketplace events without storing or mutating data.

## Security Notes

- OAuth and LLM keys stay server-side.
- The GitHub tools do not create comments, issues, branches, commits, or pull requests.
- Do not commit `.env.local`.
- Rotate secrets if exposed.
