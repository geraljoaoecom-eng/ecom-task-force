interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'gold' | 'white' | 'blue'
  className?: string
}

export function LoadingSpinner({ 
  size = 'md', 
  color = 'gold', 
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-3 w-3 border-[1.5px]',
    md: 'h-4 w-4 border-2',
    lg: 'h-6 w-6 border-2'
  }

  const colorClasses = {
    gold: 'border-gold border-t-transparent',
    white: 'border-white border-t-transparent',
    blue: 'border-blue-500 border-t-transparent'
  }

  return (
    <div 
      className={`animate-spin rounded-full ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
    />
  )
}
