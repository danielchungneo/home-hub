import { useEffect, useState } from 'react'
import { AppShell, PageHeader } from '../../components/AppShell'
import {
  BLOB_CHARACTER_IDS,
  BlobAvatar,
  parseBlobCharacter,
  type BlobAnimation,
  type BlobCharacterId,
} from '../../components/BlobAvatar'
import { ColorPicker } from '../../components/ColorPicker'
import { MemberBlobAvatar } from '../../components/MemberBlobAvatar'
import { SoftKeyboard } from '../../components/SoftKeyboard'
import { Label } from '../../components/primitives'
import { useMembers, useUpdateMember } from '../../data/hooks'
import { useLive } from '../../data/live'
import { normalizePersonColor } from '@hub/shared'
import { memberColorProps } from '../../lib/colors'
import s from './Profiles.module.css'

function titleCaseName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)\S/g, (ch) => ch.toUpperCase())
}

function characterLabel(id: BlobCharacterId) {
  return id.charAt(0).toUpperCase() + id.slice(1)
}

export default function Profiles() {
  useLive('members', 'members')
  const membersQ = useMembers()
  const members = membersQ.data ?? []
  const update = useUpdateMember()

  const [personId, setPersonId] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [motion, setMotion] = useState<BlobAnimation>('idle')
  const [motionKey, setMotionKey] = useState(0)

  useEffect(() => {
    if (!members.length) return
    if (!members.some((m) => m.id === personId)) setPersonId(members[0]!.id)
  }, [members, personId])

  const person = members.find((m) => m.id === personId)

  useEffect(() => {
    if (!person) return
    setNameDraft(person.name)
    setEditingName(false)
  }, [person?.id, person?.name])

  const play = (next: BlobAnimation) => {
    setMotion(next)
    setMotionKey((n) => n + 1)
  }

  const patch = (p: { name?: string; color?: string; avatar?: string }) => {
    if (!person) return
    void update.mutateAsync({ id: person.id, ...p }).catch(() => {})
  }

  const commitName = () => {
    if (!person) return
    const next = titleCaseName(nameDraft)
    setEditingName(false)
    if (!next || next === person.name) {
      setNameDraft(person.name)
      return
    }
    setNameDraft(next)
    patch({ name: next })
  }

  const setColor = (color: string) => {
    if (!person) return
    const next = normalizePersonColor(color, 'plum')
    if (person.color === next) return
    patch({ color: next })
    play('wiggle')
  }

  const setCharacter = (avatar: BlobCharacterId) => {
    if (!person) return
    if (person.avatar !== avatar) patch({ avatar })
    play('wiggle')
  }

  if (!person) {
    return (
      <AppShell>
        <PageHeader title="Profiles" />
        <div className={s.empty}>Add someone in Settings → Family to set up profiles.</div>
      </AppShell>
    )
  }

  const character = parseBlobCharacter(person.avatar)

  return (
    <AppShell>
      <PageHeader title="Profiles" />
      <div className={s.body}>
        <aside className={s.rail} aria-label="Family members">
          <Label as="h2" className={s.railTitle}>Who</Label>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              {...memberColorProps(m.color)}
              aria-pressed={m.id === personId}
              className={s.who}
              onClick={() => setPersonId(m.id)}
            >
              <MemberBlobAvatar memberId={m.id} size={48} decorative />
              <span>
                <span className={s.whoName}>{m.name}</span>
                <span className={s.whoMeta}>{parseBlobCharacter(m.avatar)}</span>
              </span>
            </button>
          ))}
        </aside>

        <section className={s.editor} {...memberColorProps(person.color)} aria-label={`${person.name}'s profile`}>
          <div className={s.heroCol}>
            <BlobAvatar
              character={character}
              colorway={person.color}
              size={200}
              animation={motion}
              animationKey={motionKey}
              showBackground={false}
              ariaLabel={`Animate ${person.name}'s avatar`}
              onClick={() => play('squish')}
            />
            <p className={s.heroName}>{person.name}</p>
            <p className={s.heroHint}>Tap to squish · color matches your profile</p>
          </div>

          <div className={s.fields}>
            <div className={s.field}>
              <Label>Name</Label>
              <div className={s.nameRow}>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value.slice(0, 24))}
                  onFocus={() => setEditingName(true)}
                  onBlur={commitName}
                  placeholder="Name"
                  autoComplete="off"
                  inputMode="none"
                  aria-label="Name"
                />
              </div>
            </div>

            <div className={s.field}>
              <Label>Color</Label>
              <ColorPicker value={person.color} onChange={setColor} label="Profile color" />
            </div>

            <div className={s.field}>
              <Label>Avatar</Label>
              <div className={s.chars} role="group" aria-label="Avatar character">
                {BLOB_CHARACTER_IDS.map((id) => {
                  const selected = character === id
                  return (
                    <button
                      key={id}
                      type="button"
                      {...memberColorProps(person.color)}
                      aria-pressed={selected}
                      className={selected ? `${s.char} ${s.charOn}` : s.char}
                      onClick={() => setCharacter(id)}
                    >
                      <BlobAvatar character={id} colorway={person.color} size={64} showBackground decorative />
                      <span>{characterLabel(id)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      {editingName && (
        <SoftKeyboard
          value={nameDraft}
          onChange={(next) => setNameDraft(next.slice(0, 24))}
          onDone={commitName}
        />
      )}
    </AppShell>
  )
}
