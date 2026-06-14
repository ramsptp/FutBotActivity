export async function apiFetch(path, token, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const errorText = await res.text()
    console.error(`API error ${res.status}:`, errorText)
    throw new Error(`API error ${res.status}: ${errorText}`)
  }
  return res.json()
}

export function preloadImage(url) {
  if (!url) return Promise.resolve()
  return new Promise(resolve => {
    const img = new Image()
    img.onload = resolve
    img.onerror = resolve  // resolve anyway so we never block
    img.src = url
  })
}

export function preloadImages(urls) {
  return Promise.all(urls.filter(Boolean).map(preloadImage))
}
