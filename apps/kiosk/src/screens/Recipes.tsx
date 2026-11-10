import { useState } from 'react'
import { useNav } from '../app/nav'
import { AppShell, PageHeader } from '../components/AppShell'
import { Button, IconButton } from '../components/Button'
import { Icon } from '../components/Icon'
import { Chip, IconTile, Label, Panel } from '../components/primitives'
import { RECIPES } from '../data/mock'
import { minutes, quantity } from '../lib/format'
import s from './Recipes.module.css'

const TAGS = ['All', 'Dinner', 'Breakfast', 'Quick', 'Slow cooker']

export default function Recipes() {
  const { cook } = useNav()
  const [tag, setTag] = useState('All')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(RECIPES[0].id)
  const [servings, setServings] = useState<number | null>(null)

  const recipe = RECIPES.find((r) => r.id === selectedId)!
  const serv = servings ?? recipe.servings
  const scale = serv / recipe.servings
  const q = query.trim().toLowerCase()
  const visible = RECIPES.filter((r) =>
    (tag === 'All' || r.tags.includes(tag)) &&
    (!q || r.title.toLowerCase().includes(q) || r.ingredients.some((i) => i.name.toLowerCase().includes(q))))

  return (
    <AppShell>
      <div className={s.layout}>
        <div className={s.left}>
          <PageHeader eyebrow={`Recipe box · ${RECIPES.length} recipes`} title="Recipes" />
          <label className={s.search}>
            <Icon name="search" size={24} />
            <span className="sr-only">Search recipes</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes or ingredients" />
          </label>
          <div className={s.tags}>
            {TAGS.map((t) => <Chip key={t} selected={t === tag} onClick={() => setTag(t)}>{t}</Chip>)}
          </div>
          <div className={`${s.grid} scroll-y`}>
            {visible.map((r) => (
              <button key={r.id} type="button" data-color={r.color} aria-pressed={r.id === selectedId}
                className={r.id === selectedId ? `${s.card} ${s.cardOn}` : s.card}
                onClick={() => { setSelectedId(r.id); setServings(null) }}>
                <span className={s.photo} role="img" aria-label="Recipe photo placeholder"><IconTile icon={r.icon} size={96} /></span>
                <span className={s.cardText}>
                  <span className={s.cardTitle}>{r.title}</span>
                  <span className={s.cardMeta}>{minutes(r.prepMin + r.cookMin)} · serves {r.servings}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <Panel as="aside" pad="sm" data-color={recipe.color} className={s.detail} aria-label={recipe.title}>
          <div className={s.hero} role="img" aria-label="Recipe photo placeholder"><IconTile icon={recipe.icon} size={140} /></div>
          <div className={s.detailHead}>
            <h2 className={s.h2}>{recipe.title}</h2>
            <div className={s.meta}>
              <span>Prep {minutes(recipe.prepMin)}</span>
              <span>Cook {minutes(recipe.cookMin)}</span>
            </div>
          </div>
          <div className={s.servings}>
            <span>Servings</span>
            <span className={s.stepper}>
              <IconButton variant="surface" round={false} icon="minus" label="Fewer servings" onClick={() => setServings(Math.max(1, serv - 1))} />
              <span className={s.servNum} aria-live="polite">{serv}</span>
              <IconButton variant="surface" round={false} icon="plus" label="More servings" onClick={() => setServings(Math.min(16, serv + 1))} />
            </span>
          </div>
          <div className={`${s.ingredients} scroll-y`}>
            <Label>Ingredients</Label>
            {recipe.ingredients.map((i) => (
              <div key={i.name} className={s.ing}>
                <span className={s.amt}>{i.qty ? `${quantity(i.qty * scale)}${i.unit ? ' ' + i.unit : ''}` : 'To taste'}</span>
                <span>{i.name}</span>
              </div>
            ))}
          </div>
          <div className={s.actions}>
            <Button variant="secondary" size="lg" className={s.grow}>Add to meal plan</Button>
            <Button size="lg" icon="pot" className={s.grow2} onClick={() => cook(recipe.id)}>Start cooking mode</Button>
          </div>
        </Panel>
      </div>
    </AppShell>
  )
}
