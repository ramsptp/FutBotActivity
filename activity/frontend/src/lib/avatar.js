const VALID_SIZES = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096]
function snapSize(size) {
  return VALID_SIZES.find(s => s >= size) ?? 4096
}

// Build a Discord CDN avatar URL.
// - If both user_id and avatar hash are present → real avatar
// - Otherwise → default embed avatar based on the user id
export function avatarUrl(user_id, avatar, size = 64) {
  if (user_id && avatar) {
    return `https://cdn.discordapp.com/avatars/${user_id}/${avatar}.png?size=${snapSize(size)}`
  }
  try {
    const idx = user_id ? Number(BigInt(String(user_id)) % 5n) : 0
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`
  } catch {
    return 'https://cdn.discordapp.com/embed/avatars/0.png'
  }
}

export const FALLBACK_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png'
