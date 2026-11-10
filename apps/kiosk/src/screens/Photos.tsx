import { useState } from 'react'
import { useNav } from '../app/nav'
import { AppShell, PageHeader } from '../components/AppShell'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { Avatar, Chip, Label, Panel, Progress } from '../components/primitives'
import { PHOTOS, SETTINGS } from '../data/mock'
import { who } from '../lib/members'
import { PhotoPlaceholder } from './PhotoPlaceholder'
import s from './Photos.module.css'

const FILTERS = ['All', 'In slideshow', 'Noah', 'This month'] as const
type Filter = (typeof FILTERS)[number]

export default function Photos() {
  const { showSlideshow } = useNav()
  const [filter, setFilter] = useState<Filter>('All')
  const [inShow, setInShow] = useState(() => new Set(PHOTOS.filter((p) => p.inSlideshow).map((p) => p.id)))

  const visible = PHOTOS.filter((p) =>
    filter === 'All' || (filter === 'In slideshow' && inShow.has(p.id)) || (filter === 'Noah' && p.ofNoah) || (filter === 'This month' && p.thisMonth))
  const toggle = (id: string) => setInShow((prev) => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  return (
    <AppShell>
      <div className={s.layout}>
        <div className={s.left}>
          <PageHeader
            eyebrow={`${PHOTOS.length} photos · ${inShow.size} in the slideshow`}
            title="Photos"
            actions={FILTERS.map((f) => <Chip key={f} selected={f === filter} onClick={() => setFilter(f)}>{f}</Chip>)}
          />
          <div className={`${s.grid} scroll-y`}>
            {visible.map((p) => {
              const on = inShow.has(p.id)
              const w = who(p.who)
              return (
                <div key={p.id} className={s.photo}>
                  {/* Real build: <img loading="lazy" decoding="async" src={signedThumbUrl} /> */}
                  <PhotoPlaceholder palette={p.palette} seed={Number(p.id.slice(1))} label={`Photo placeholder from ${p.when}`} />
                  <span className={s.by}><Avatar initial={w.initial} color={w.color} size="xs" />{p.when}</span>
                  <button type="button" aria-pressed={on} aria-label={on ? 'Remove from slideshow' : 'Add to slideshow'}
                    className={on ? `${s.star} ${s.starOn}` : s.star} onClick={() => toggle(p.id)}>
                    <Icon name={on ? 'star-solid' : 'star-outline'} size={26} stroke={2} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <aside className={s.side}>
          <Button size="xl" block icon="play" onClick={showSlideshow}>Play slideshow</Button>
          <Panel className={s.card} aria-label="Slideshow settings">
            <Label>Slideshow</Label>
            <Row label="Starts after" value={`${SETTINGS.idleMinutes} min idle`} />
            <Row label="Each photo" value={`${SETTINGS.slideSeconds} seconds`} />
            <Row label="Order" value="Shuffle" last />
          </Panel>
          <section data-color="moss" className={s.tip} aria-label="Add photos">
            <span className={s.tipTitle}>Add photos from your phone</span>
            <span className={s.tipBody}>Open the family app, tap Photos, and pick from your camera roll. They’re resized before upload and show up here right away.</span>
          </section>
          <Panel className={s.card} aria-label="Storage">
            <div className={s.storageHead}><Label>Storage</Label><strong>[USED] of [PLAN LIMIT]</strong></div>
            <Progress value={0.22} tone="ink" label="Photo storage used" />
          </Panel>
        </aside>
      </div>
    </AppShell>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={last ? s.row : `${s.row} ${s.rowLine}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
