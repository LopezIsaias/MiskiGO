interface Props {
  score: number  // 0–100
  showPercent?: boolean
  size?: 'sm' | 'md'
}

export function StarRating({ score, showPercent = true, size = 'sm' }: Props) {
  const stars = Math.round(score / 20)  // 0–5
  const starSize = size === 'md' ? 'text-base' : 'text-xs'

  return (
    <span className="inline-flex items-center gap-1">
      <span className={starSize}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < stars ? 'text-amber-400' : 'text-gray-300'}>★</span>
        ))}
      </span>
      {showPercent && (
        <span className="text-xs text-gray-500 font-medium">{score.toFixed(0)}%</span>
      )}
    </span>
  )
}
