# Privacy Policy

Last updated: May 18, 2026

GitHub Issue Investigator is a read-only GitHub issue investigation assistant for developers and maintainers.

## Information We Process

When you use the app, we may process:

- GitHub account information returned by GitHub OAuth, such as your GitHub username, avatar, and session identity.
- GitHub access tokens granted through OAuth, used server-side to read repository and issue context.
- Issue URLs, repository owner/name, issue numbers, optional focus paths, and investigation instructions that you submit.
- Repository evidence needed for an investigation, such as issue details, issue comments, repository metadata, files, directories, and code search results that your GitHub authorization allows the app to read.
- Generated investigation output, including source-backed facts, suggested next actions, and draft maintainer comments.
- Basic operational logs from hosting infrastructure, such as request timing, errors, and service health events.

## How We Use Information

We use this information to:

- Authenticate you with GitHub.
- Run read-only investigations for the issue or repository context you provide.
- Generate structured investigation reports using an OpenAI-compatible language model provider.
- Diagnose errors, rate limits, permission failures, and service reliability issues.
- Improve the safety and reliability of the app.

## Third-Party Services

The app relies on:

- GitHub OAuth and GitHub REST API for authentication and read-only repository access.
- Render for application hosting.
- An OpenAI-compatible language model provider for generating investigation reports.

Issue context and selected repository evidence may be sent to the configured language model provider to produce the requested output. The app does not intentionally sell user data or use repository data for advertising.

## Data Storage

OAuth and language model credentials are handled server-side through environment variables and runtime sessions. The app is designed for read-only investigation and does not create or modify GitHub issues, comments, branches, commits, pull requests, or repository settings.

The app may retain operational logs through its hosting provider for debugging and reliability. Do not submit secrets, private credentials, or sensitive personal information in issue prompts or investigation notes.

## Security

The app uses server-side OAuth handling, read-only GitHub API access, structured response validation, and source labels for generated facts. No system can be guaranteed completely secure, and users should review generated output before relying on it.

## Your Choices

You can stop using the app at any time. You may also revoke the app's GitHub OAuth access from your GitHub account settings.

## Contact

For questions about this policy, open an issue in the project repository:

https://github.com/peixiaotan1/issue-investigator-dev
