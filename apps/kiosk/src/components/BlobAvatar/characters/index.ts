import type { ComponentType } from 'react'
import type { BlobCharacterId, BlobCharacterProps } from '../types'
import { CloverCharacter } from './clover'
import { DumplinCharacter } from './dumplin'
import { JamCharacter } from './jam'
import { MochiCharacter } from './mochi'
import { NibCharacter } from './nib'
import { PebbleCharacter } from './pebble'
import { PuddleCharacter } from './puddle'
import { PuffCharacter } from './puff'
import { SproutCharacter } from './sprout'
import { TaterCharacter } from './tater'
import { TuftyCharacter } from './tufty'
import { WispCharacter } from './wisp'

/** Registry of implemented blob artwork (all 12 characters). */
export const CHARACTER_RENDERERS: Record<BlobCharacterId, ComponentType<BlobCharacterProps>> = {
  pebble: PebbleCharacter,
  mochi: MochiCharacter,
  sprout: SproutCharacter,
  puddle: PuddleCharacter,
  nib: NibCharacter,
  puff: PuffCharacter,
  tater: TaterCharacter,
  wisp: WispCharacter,
  dumplin: DumplinCharacter,
  jam: JamCharacter,
  clover: CloverCharacter,
  tufty: TuftyCharacter,
}

export function resolveCharacter(id: BlobCharacterId): ComponentType<BlobCharacterProps> {
  return CHARACTER_RENDERERS[id] ?? PebbleCharacter
}

export {
  CloverCharacter,
  DumplinCharacter,
  JamCharacter,
  MochiCharacter,
  NibCharacter,
  PebbleCharacter,
  PuddleCharacter,
  PuffCharacter,
  SproutCharacter,
  TaterCharacter,
  TuftyCharacter,
  WispCharacter,
}
