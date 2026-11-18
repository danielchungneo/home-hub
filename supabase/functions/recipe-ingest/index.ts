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
  const edit = url.searchParams.get("edit")
  const target = new URL(PAGE)
  if (token) target.searchParams.set("token", token)
  if (edit) target.searchParams.set("edit", edit)
  return Response.redirect(target.toString(), 302)
})
