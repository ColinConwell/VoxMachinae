const configuredBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''

export function apiUrl(path: string): string {
  if (!configuredBase) {
    return path
  }
  return `${configuredBase}${path.startsWith('/') ? path : `/${path}`}`
}

export function wsUrl(path: string): string {
  if (configuredBase) {
    const wsBase = configuredBase.replace(/^http/, 'ws')
    return `${wsBase}${path.startsWith('/') ? path : `/${path}`}`
  }

  if (typeof window === 'undefined') {
    return path
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${path.startsWith('/') ? path : `/${path}`}`
}
