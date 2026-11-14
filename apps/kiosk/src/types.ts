// Re-export shared UI types, pinning icon-bearing ones to the kiosk IconName set.
// Screens under tasks/ import from here (see docs/TASKS.md).
import type {
  Recipe as SharedRecipe,
  Reward as SharedReward,
  ShoppingList as SharedShoppingList,
  TaskTemplate as SharedTaskTemplate,
} from '@hub/shared'
import type { IconName } from './components/Icon'

export type {
  Activity,
  ActivityKind,
  AthleteProfile,
  Bounty,
  CalendarEvent,
  CardioKind,
  CardioPlan,
  CoachDirection,
  CoachPlan,
  Countdown,
  DayWeather,
  Exercise,
  Feel,
  Frequency,
  Ingredient,
  LedgerEntry,
  MealEntry,
  MealSlot,
  Member,
  MemberColor,
  Photo,
  Redemption,
  RewardAisle,
  RewardDeal,
  Schedule,
  ScreenId,
  Speaker,
  StrengthPlan,
  SwapReason,
  Task,
  WeatherKind,
} from '@hub/shared'
export type { Course, FoodPhoto } from '@hub/shared'
export type { IconName } from './components/Icon'

export type TaskTemplate = SharedTaskTemplate<IconName>
export type Reward = SharedReward<IconName>
export type Recipe = SharedRecipe<IconName>
export type ShoppingList = SharedShoppingList<IconName>
