export function editorialSummaryWordCount(value: string) {
  return (
    value.match(/[A-Za-z0-9]+(?:['’.-][A-Za-z0-9]+)*/g) || []
  ).length
}

export function hasValidEditorialSummaryLength(value: string) {
  const words = editorialSummaryWordCount(value.trim())
  return words >= 15 && words <= 20
}
