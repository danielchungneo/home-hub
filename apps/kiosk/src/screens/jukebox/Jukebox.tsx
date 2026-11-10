import { useEffect, useRef, useState } from 'react'
import { AppShell, PageHeader } from '../../components/AppShell'
import { Icon } from '../../components/Icon'
import { StatusPill } from '../../components/primitives'
import type { Collection } from '@hub/shared'
import { DetailView, SearchView, SongsView, WallView } from './Browse'
import { MiniPlayer, NowPlaying } from './NowPlaying'
import { PICK_MS, PickOverlay, REVEAL_MS, Reveal } from './PickOverlay'
import { Cover, Equalizer } from './parts'
import { useJukebox } from './useJukebox'
import s from './Jukebox.module.css'

type Tab = 'songs' | 'playlists' | 'albums' | 'now'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function Jukebox() {
  const jb = useJukebox()
  const [tab, setTab] = useState<Tab>(() => {
    const h = window.location.hash.replace('#jukebox-', '')
    return (['now', 'albums', 'playlists'] as Tab[]).includes(h as Tab) ? (h as Tab) : 'songs'
  })
  const [detail, setDetail] = useState<Collection | null>(null)
  const [query, setQuery] = useState('')
  const [picking, setPicking] = useState<Collection | null>(null)
  const [reveal, setReveal] = useState<Collection | null>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  if (!jb.ready) return <AppShell>{null}</AppShell>

  const speaker = jb.speakers.find((x) => x.id === jb.player.speakerId)?.name ?? jb.speakers[0]?.name ?? 'Speaker'
  const goTab = (t: Tab) => { setTab(t); setDetail(null); setQuery('') }
  const open = (c: Collection) => { setTab(c.kind === 'album' ? 'albums' : 'playlists'); setDetail(c); setQuery('') }

  const pick = (c: Collection) => {
    timers.current.forEach((t) => window.clearTimeout(t))
    const start = () => { jb.playCollection(c); setTab('now'); setDetail(null); setQuery('') }
    if (reducedMotion()) { start(); return }
    setPicking(c)
    timers.current = [
      window.setTimeout(() => { start(); setPicking(null); setReveal(c) }, PICK_MS),
      window.setTimeout(() => setReveal(null), PICK_MS + REVEAL_MS),
    ]
  }

  const current = jb.player.track
  const tabs: { id: Exclude<Tab, 'now'>; label: string; count: number }[] = [
    { id: 'songs', label: 'Songs', count: jb.songs.length },
    { id: 'playlists', label: 'Playlists', count: jb.playlists.length },
    { id: 'albums', label: 'Albums', count: jb.albums.length },
  ]

  let body
  if (query.trim()) body = <SearchView jb={jb} query={query} onPick={pick} onOpen={open} />
  else if (tab === 'now') body = <NowPlaying jb={jb} />
  else if (detail) body = <DetailView jb={jb} c={detail} onBack={() => setDetail(null)} onPick={pick} />
  else if (tab === 'albums') body = <WallView items={jb.albums} kind="album" onPick={pick} onOpen={open} />
  else if (tab === 'playlists') body = <WallView items={jb.playlists} kind="playlist" onPick={pick} onOpen={open} />
  else body = <SongsView jb={jb} tracks={jb.songs} recent={[...jb.albums, ...jb.playlists].slice(0, 4)} onPick={pick} onOpen={open} />

  return (
    <AppShell>
      <div className={s.screen}>
        <PageHeader
          title="Jukebox"
          actions={<>
            <span className={s.speakerPill}><Icon name="speaker" size={22} />{jb.player.playing ? `Playing in ${speaker}` : `Speaker: ${speaker}`}</span>
            <StatusPill tone={jb.speakers.some((sp) => sp.available) ? 'ok' : 'off'}>
              {jb.speakers.some((sp) => sp.available) ? 'Spotify connected' : 'No speakers yet'}
            </StatusPill>
          </>}
        />

        <div className={s.toolbar}>
          <div role="tablist" aria-label="Browse music" className={s.tabs}>
            {tabs.map((t) => {
              const on = tab === t.id && !query
              return (
                <button key={t.id} type="button" role="tab" aria-selected={on} className={on ? `${s.tab} ${s.tabOn}` : s.tab} onClick={() => goTab(t.id)}>
                  {t.label}<span className={s.tabCount}>{t.count}</span>
                </button>
              )
            })}
          </div>
          <label className={s.searchBox}>
            <Icon name="search" size={24} />
            <span className="sr-only">Search Spotify</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Spotify for songs, albums, playlists" />
            {query && <button type="button" className={s.searchClear} aria-label="Clear search" onClick={() => setQuery('')}><Icon name="close" size={20} /></button>}
          </label>
          {current && (
            <button type="button" aria-pressed={tab === 'now' && !query} className={tab === 'now' && !query ? `${s.nowBtn} ${s.nowBtnOn}` : s.nowBtn} onClick={() => { setTab('now'); setQuery('') }}>
              <span className={s.nowBtnArt}><Cover item={current} size={48} /></span>
              <Equalizer playing={jb.player.playing} />
              Now playing
            </button>
          )}
        </div>

        <div className={s.body}>{body}</div>

        {tab !== 'now' && !query && current && <MiniPlayer jb={jb} onOpen={() => setTab('now')} />}

        {jb.toast && (
          <div role="status" className={s.toast}><Icon name="tick" size={20} stroke={3} />{jb.toast}</div>
        )}
        {picking && <PickOverlay item={picking} line={`${picking.subtitle} · putting it on in the ${speaker}`} />}
        {reveal && <Reveal item={reveal} />}
      </div>
    </AppShell>
  )
}
