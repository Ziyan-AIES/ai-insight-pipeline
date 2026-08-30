import { categoryLabels } from '../labels'
import type { NewsCategory } from '../types'

type CategoryLabelProps = {
  category: NewsCategory
  className?: string
}

export function CategoryLabel({ category, className = 'category-label' }: CategoryLabelProps) {
  return (
    <span className={`${className} cat-${category}`}>
      <span className="cat-dot" aria-hidden="true" />
      {categoryLabels[category]}
    </span>
  )
}
