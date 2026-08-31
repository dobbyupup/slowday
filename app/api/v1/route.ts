export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    name: "Slowday API",
    version: "1.0.0",
    authentication: "Sign in with ChatGPT session or Authorization: Bearer slowday_…",
    endpoints: {
      overview: `${origin}/api/v1/overview?period=month&anchor=2026-07-17`,
      tasks: `${origin}/api/v1/tasks?from=2026-07-01&to=2026-07-31`,
      reviews: `${origin}/api/v1/reviews?from=2026-07-01&to=2026-07-31`,
      apiKeys: `${origin}/api/v1/keys`,
    },
    documentation: `${origin}/#api`,
  });
}
