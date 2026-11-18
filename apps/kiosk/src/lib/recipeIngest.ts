/** Phone recipe importer / editor hosted on the smart-home Vercel app. */
export function recipeIngestUrl(token: string, editRecipeId?: string) {
  // Supabase Functions/Storage force text/plain + CSP sandbox for HTML on *.supabase.co.
  const base = (import.meta.env.VITE_RECIPE_INGEST_URL as string | undefined)?.replace(/\/$/, '')
    || 'https://chung-smart-home.vercel.app/recipe'
  const url = `${base}/?token=${encodeURIComponent(token)}`
  return editRecipeId ? `${url}&edit=${encodeURIComponent(editRecipeId)}` : url
}
