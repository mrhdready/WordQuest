/**
 * Avatare als Emoji — kein Bild-Asset, keine Lizenzfrage, und auf jedem
 * Geraet sofort da. Wird spaeter durch echte Illustrationen ersetzt.
 */
export const AVATARS: Record<string, string> = {
  fox: '🦊',
  dragon: '🐉',
  owl: '🦉',
  cat: '🐱',
  robot: '🤖',
  astronaut: '🧑‍🚀',
  knight: '🛡️',
  wizard: '🧙',
}

export const AVATAR_KEYS = Object.keys(AVATARS)

export function avatarFor(key: string | undefined): string {
  return (key && AVATARS[key]) || AVATARS.fox || '🦊'
}
