export function resolveBinding(source, path) {
  if (!path) return undefined

  return path
    .replace(/^\$row\.?/, '')
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => value?.[key], source)
}

export function resolveLabel(value, label) {
  if (typeof label === 'string') return label
  if (label && typeof label.static === 'string') return label.static
  return value
}
