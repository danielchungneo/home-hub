// Stand-in artwork until real photos come from Supabase Storage.
// Delete this file once <img> thumbnails are wired up.
const PALETTES = [
  ['#E9D9C4', '#F3C98B', '#B9A58C', '#55623F'],
  ['#D6E0E6', '#F4E3C3', '#A9BAC4', '#4B6270'],
  ['#F2DCCB', '#E9A27E', '#CDA88F', '#7D513C'],
  ['#E6E9DA', '#F4D58D', '#AEB896', '#6B7A55'],
  ['#EADFEB', '#F2C6B4', '#C4B2C6', '#6E5A72'],
  ['#F4ECDA', '#E9B566', '#D2BE95', '#735623'],
]

export function PhotoPlaceholder({ palette, seed = 0, label, full }: { palette: number; seed?: number; label: string; full?: boolean }) {
  const [sky, sun, far, near] = PALETTES[palette % PALETTES.length]
  const w = full ? 1920 : 300
  const h = full ? 1080 : 250
  const k = w / 300
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <rect width={w} height={h} fill={sky} />
      <circle cx={(60 + ((seed * 47) % 180)) * k} cy={h * 0.3} r={26 * k} fill={sun} />
      <path d={`M0 ${h * 0.64} C ${60 * k} ${h * 0.52}, ${120 * k} ${h * 0.56}, ${170 * k} ${h * 0.62} S ${260 * k} ${h * 0.52}, ${w} ${h * 0.58} L${w} ${h} L0 ${h} Z`} fill={far} />
      <path d={`M0 ${h * 0.82} C ${80 * k} ${h * 0.72}, ${160 * k} ${h * 0.76}, ${220 * k} ${h * 0.82} S ${280 * k} ${h * 0.78}, ${w} ${h * 0.8} L${w} ${h} L0 ${h} Z`} fill={near} />
    </svg>
  )
}
