'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'

interface EditableTagsListProps {
  label: string
  tags: string[]
  onUpdate: (tags: string[]) => void
  placeholder?: string
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow'
}

const colorClasses = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  green: 'bg-green-500/10 text-green-400 border-green-500/30',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  red: 'bg-red-500/10 text-red-400 border-red-500/30',
  yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
}

export function EditableTagsList({ 
  label, 
  tags, 
  onUpdate, 
  placeholder = "Adicionar...",
  color = 'blue'
}: EditableTagsListProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newTag, setNewTag] = useState('')

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onUpdate([...tags, newTag.trim()])
      setNewTag('')
      setIsAdding(false)
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdate(tags.filter(tag => tag !== tagToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTag()
    } else if (e.key === 'Escape') {
      setNewTag('')
      setIsAdding(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text">
        {label}
      </label>
      
      <div className="flex flex-wrap gap-2">
        {/* Tags existentes */}
        {tags.map((tag, index) => (
          <span
            key={index}
            className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border ${colorClasses[color]}`}
          >
            {tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              className="hover:bg-current hover:bg-opacity-20 rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Input para adicionar */}
        {isAdding ? (
          <div className="inline-flex items-center gap-1">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={() => {
                if (newTag.trim()) {
                  handleAddTag()
                } else {
                  setIsAdding(false)
                }
              }}
              className="text-xs bg-background border border-gold/30 rounded-full px-3 py-1 w-24 focus:outline-none focus:border-gold/60"
              placeholder={placeholder}
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border border-dashed ${colorClasses[color]} hover:bg-opacity-20 transition-colors`}
          >
            <Plus className="h-3 w-3" />
            Adicionar
          </button>
        )}
      </div>
    </div>
  )
}
