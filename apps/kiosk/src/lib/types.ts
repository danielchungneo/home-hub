// Shared types pinned to the kiosk's icon set, so `<Icon name={task.icon} />` stays strictly typed.
import type {
  Recipe as SharedRecipe,
  Reward as SharedReward,
  ShoppingList as SharedShoppingList,
  Task as SharedTask,
} from '@hub/shared'
import type { IconName } from '../components/Icon'

export type Task = SharedTask<IconName>
export type Reward = SharedReward<IconName>
export type Recipe = SharedRecipe<IconName>
export type ShoppingList = SharedShoppingList<IconName>
