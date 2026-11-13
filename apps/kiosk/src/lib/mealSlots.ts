import type { MealSlot, MemberColor } from '@hub/shared'
import type { IconName } from '../components/Icon'

/** Fridge-board / meal-plan row metadata (not demo content). */
export const MEAL_SLOTS: {
  id: MealSlot
  label: string
  icon: IconName
  color: MemberColor
}[] = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sunrise', color: 'honey' },
  { id: 'lunch', label: 'Lunch', icon: 'sun', color: 'fjord' },
  { id: 'dinner', label: 'Dinner', icon: 'utensils', color: 'clay' },
  { id: 'snack', label: 'Snack', icon: 'plant', color: 'moss' },
]
