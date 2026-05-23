// Build a Discord CDN avatar URL.
// - If both user_id and avatar hash are present → real avatar
// - Otherwise → default embed avatar based on the user id
export function avatarUrl(user_id, avatar, size = 64) {
  if (user_id && avatar) {
    return `https://cdn.discordapp.com/avatars/${user_id}/${avatar}.png?size=${size}`
  }
  const idx = user_id ? (Number(user_id) % 5) : 0
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`
}

export const FALLBACK_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png'
