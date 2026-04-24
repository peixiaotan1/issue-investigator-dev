import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AuthButtons } from "@/components/auth-buttons";
import { InvestigationConsole } from "@/components/investigation-console";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isLoggedIn = Boolean(session?.accessToken);
  const githubLogin = session?.githubLogin;
  const displayName = githubLogin || session?.user?.name || session?.user?.email;
  const avatar = session?.user?.image;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="rounded-2xl border bg-card p-7 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Read-only issue analysis workspace
            </p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              GitHub Issue Investigator
            </h1>
            <p className="max-w-xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
              Collect repository facts, inspect likely root causes, and draft a
              maintainer-ready response from one focused workspace.
            </p>
          </div>
          <div className="flex items-center gap-3 sm:pt-1">
            {isLoggedIn && displayName ? (
              <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt={`${displayName} avatar`}
                    className="h-5 w-5 rounded-full border object-cover"
                  />
                ) : null}
                <span>
                  Signed in as{" "}
                  <span className="font-medium text-foreground">
                    {githubLogin ? `@${githubLogin}` : displayName}
                  </span>
                </span>
              </div>
            ) : null}
            <AuthButtons isLoggedIn={isLoggedIn} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t pt-5 text-xs text-muted-foreground sm:grid-cols-3">
          <p>1. Paste issue details</p>
          <p>2. Ask the investigator to trace context</p>
          <p>3. Ship a high-signal maintainer comment</p>
        </div>
      </header>

      {isLoggedIn ? (
        <InvestigationConsole />
      ) : (
        <section className="rounded-2xl border bg-card p-7 shadow-sm">
          <h2 className="text-balance text-xl font-semibold">Sign in to start</h2>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
            Continue with GitHub OAuth to grant read-only repository access. After
            signing in, you can run targeted investigations with structured prompts
            and tool-assisted evidence.
          </p>
        </section>
      )}
    </main>
  );
}
