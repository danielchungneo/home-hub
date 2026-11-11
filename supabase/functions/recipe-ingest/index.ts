import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const PAGE =
  "https://zgobtwaajbwxdtiatjyq.supabase.co/storage/v1/object/public/recipe-ingest/index.html"

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    })
  }
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  const target = token ? `${PAGE}?token=${encodeURIComponent(token)}` : PAGE
  return Response.redirect(target, 302)
})
