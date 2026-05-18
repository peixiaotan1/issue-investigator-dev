import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

function verifyGitHubSignature(payload: string, signature: string, secret: string) {
  const expected = `sha256=${createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return (
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  const secret = process.env.GITHUB_MARKETPLACE_WEBHOOK_SECRET;

  if (!secret) {
    return Response.json(
      { ok: false, error: "GITHUB_MARKETPLACE_WEBHOOK_SECRET is not set." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!signature) {
    return Response.json(
      { ok: false, error: "Missing X-Hub-Signature-256 header." },
      { status: 401 },
    );
  }

  const payload = await request.text();

  if (!verifyGitHubSignature(payload, signature, secret)) {
    return Response.json(
      { ok: false, error: "Invalid webhook signature." },
      { status: 401 },
    );
  }

  const event = request.headers.get("x-github-event") ?? "unknown";
  const delivery = request.headers.get("x-github-delivery") ?? "unknown";

  return Response.json({
    ok: true,
    event,
    delivery,
  });
}
