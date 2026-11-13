import { BlobAvatar, parseBlobCharacter, type BlobAnimation } from './BlobAvatar'
import { who } from '../lib/members'

interface MemberBlobAvatarProps {
  memberId: string
  size?: number
  animation?: BlobAnimation
  animationKey?: number | string
  showBackground?: boolean
  decorative?: boolean
  className?: string
  onClick?: () => void
  ariaLabel?: string
}

/**
 * Resolves a member (or Home/Family) into a colored blob avatar.
 * Character comes from `members.avatar`; color from the member's profile color.
 */
export function MemberBlobAvatar({
  memberId,
  size = 48,
  animation = 'idle',
  animationKey = 0,
  showBackground = true,
  decorative = false,
  className,
  onClick,
  ariaLabel,
}: MemberBlobAvatarProps) {
  const person = who(memberId)
  const label = ariaLabel ?? `${person.name}'s avatar`

  return (
    <BlobAvatar
      character={parseBlobCharacter(person.avatar)}
      colorway={person.color}
      size={size}
      animation={animation}
      animationKey={animationKey}
      showBackground={showBackground}
      decorative={decorative}
      className={className}
      onClick={onClick}
      ariaLabel={decorative ? undefined : label}
    />
  )
}
