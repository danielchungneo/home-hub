import { Fragment, useState } from 'react'
import { useNav } from '../app/nav'
import { AppShell, PageHeader } from '../components/AppShell'
import { Button, IconButton } from '../components/Button'
import { Icon } from '../components/Icon'
import { IconTile, Panel, Rail } from '../components/primitives'
import { MEAL_PLAN, MEAL_SLOTS, RECIPES } from '../data/mock'
import { useClock } from '../hooks/useClock'
import { addDays, minutes, monthDay, shortDay, startOfWeek } from '../lib/format'
import s from './Meals.module.css'

export default function Meals() {
  const now = useClock()
  const { go } = useNav()
  const today = now.getDay()
  const weekStart = startOfWeek(now)
  const [selected, setSelected] = useState(`dinner:${today}`)
  const [added, setAdded] = useState(false)

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Meals · week of ${monthDay(weekStart)}`}
        title="What’s for dinner"
        actions={<>
          <Rail label="Week">
            <IconButton variant="ghost" icon="chevron-left" label="Previous week" />
            <Button variant="surface" pill>This week</Button>
            <IconButton variant="ghost" icon="chevron-right" label="Next week" />
          </Rail>
          {added
            ? <span className={`${s.added} anim-pop`} role="status"><Icon name="tick" size={20} stroke={3} />Ingredients added to Groceries</span>
            : <Button size="lg" pill icon="cart" onClick={() => setAdded(true)}>Add this week’s ingredients</Button>}
        </>}
      />

      <Panel pad="sm" className={s.grid} aria-label="Meal plan">
        <div />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={i === today ? `${s.day} ${s.dayToday}` : s.day}>
            <span className={s.dayName}>{shortDay(i)}</span>
            <span className={s.dayNum}>{addDays(weekStart, i).getDate()}</span>
          </div>
        ))}

        {MEAL_SLOTS.map((slot) => (
          <Fragment key={slot.id}>
            <div className={s.slot}>
              <Icon name={slot.icon} size={28} />
              <span>{slot.label}</span>
            </div>
            {MEAL_PLAN[slot.id].map((entry, day) => {
              const key = `${slot.id}:${day}`
              const isSel = key === selected
              const recipe = entry && 'recipeId' in entry ? RECIPES.find((r) => r.id === entry.recipeId) : undefined
              const aria = `${shortDay(day)} ${slot.label}: ${recipe?.title ?? (entry && 'text' in entry ? entry.text : 'empty, add a meal')}`
              const cls = [s.cell, isSel && s.cellSel, recipe ? s.cellRecipe : entry ? s.cellText : s.cellEmpty].filter(Boolean).join(' ')
              return (
                <button key={key} type="button" data-color={slot.color} aria-label={aria} aria-pressed={isSel} className={cls}
                  onClick={() => (isSel && recipe ? go('recipes') : setSelected(key))}>
                  {recipe && <>
                    <IconTile icon={recipe.icon} size={48} />
                    <span className={s.cellBody}>
                      <span className={s.cellTitle}>{recipe.title}</span>
                      <span className={s.cellMeta}>Recipe · {minutes(recipe.prepMin + recipe.cookMin)}</span>
                    </span>
                  </>}
                  {entry && 'text' in entry && <span className={s.note}>{entry.text}</span>}
                  {!entry && <span className={s.add}><Icon name="plus" size={20} />Add</span>}
                </button>
              )
            })}
          </Fragment>
        ))}
      </Panel>
    </AppShell>
  )
}
