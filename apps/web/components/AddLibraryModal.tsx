'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { librariesApi, foldersApi, filterOptionsApi } from '@/lib/api'
import { SimpleSelect } from './SimpleSelect'

interface AddLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddLibraryModal({ isOpen, onClose, onSuccess }: AddLibraryModalProps) {
  const [loading, setLoading] = useState(false)
  const [folders, setFolders] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    nota: '',
    sourceType: 'URL',
    sourceValue: '',
    country: '',
    language: '',
    notes: '',
    folderId: '',
    pages: [''],
    nichos: '',
    estrategias: '',
    produtos: '',
    tipos: '',
    idiomas: '',
    paises: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadFolders()
    }
  }, [isOpen])

  const loadFolders = async () => {
    try {
      const data = await foldersApi.getAll()
      setFolders(data)
    } catch (error) {
      console.error('Erro ao carregar pastas:', error)
    }
  }

  const handleOptionsChange = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.sourceValue.trim()) return

    setLoading(true)
    try {
      const payload = {
        ...formData,
        folderId: formData.folderId || null,
        pages: formData.pages.filter(page => page.trim())
      }

      await librariesApi.create(payload)
      onSuccess()
      onClose()
      
      // Reset form
      setFormData({
        name: '',
        nota: '',
        sourceType: 'URL',
        sourceValue: '',
        country: '',
        language: '',
        notes: '',
        folderId: '',
        pages: [''],
        nichos: '',
        estrategias: '',
        produtos: '',
        tipos: '',
        idiomas: '',
        paises: ''
      })
    } catch (error: any) {
      console.error('Erro ao criar biblioteca:', error)
      console.log('Erro completo:', error)
      console.log('Response data:', error?.response?.data)
      
      // Verificar se é erro de duplicação
      const errorMessage = error?.response?.data?.error || error?.message || ''
      if (errorMessage.includes('já existente')) {
        alert('Erro: Biblioteca já existente')
      } else {
        alert(`Erro ao criar biblioteca: ${errorMessage || 'Tente novamente.'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const addPage = () => {
    setFormData(prev => ({
      ...prev,
      pages: [...prev.pages, '']
    }))
  }

  const removePage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      pages: prev.pages.filter((_, i) => i !== index)
    }))
  }

  const updatePage = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      pages: prev.pages.map((page, i) => i === index ? value : page)
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-text">Adicionar Biblioteca</h2>
            <button
              onClick={onClose}
              className="p-2 text-muted hover:text-gold transition-colors rounded-lg hover:bg-gold/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Nome da Biblioteca *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                placeholder="Ex: Nike Dropshipping Brasil"
                required
              />
            </div>

            {/* Nota */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Nota
              </label>
              <input
                type="text"
                value={formData.nota}
                onChange={(e) => setFormData(prev => ({ ...prev, nota: e.target.value }))}
                className="input"
                placeholder="Ex: Biblioteca focada em produtos fitness"
              />
            </div>

            {/* Tipo de Fonte */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Tipo de Fonte *
              </label>
              <select
                value={formData.sourceType}
                onChange={(e) => setFormData(prev => ({ ...prev, sourceType: e.target.value }))}
                className="input"
              >
                <option value="URL">URL da Ads Library</option>
                <option value="KEYWORD">Palavra-chave</option>
              </select>
            </div>

            {/* Valor da Fonte */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                {formData.sourceType === 'URL' ? 'URL *' : 'Palavra-chave *'}
              </label>
              <input
                type="text"
                value={formData.sourceValue}
                onChange={(e) => setFormData(prev => ({ ...prev, sourceValue: e.target.value }))}
                className="input"
                placeholder={
                  formData.sourceType === 'URL' 
                    ? 'https://www.facebook.com/ads/library/...'
                    : 'nike, dropshipping, tênis'
                }
                required
              />
            </div>

            {/* País e Idioma */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  País
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  className="input"
                  placeholder="Brasil"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Idioma
                </label>
                <input
                  type="text"
                  value={formData.language}
                  onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                  className="input"
                  placeholder="Português"
                />
              </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text mb-2">Nicho</label>
                <SimpleSelect
                  key={`nichos-${refreshKey}`}
                  label="Nichos"
                  emoji="❤️"
                  type="nichos"
                  value={formData.nichos}
                  onChange={(value) => setFormData(prev => ({ ...prev, nichos: value }))}
                  allowAdd={true}
                  onOptionsChange={handleOptionsChange}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text mb-2">Estratégia</label>
                <SimpleSelect
                  key={`estrategias-${refreshKey}`}
                  label="Estratégias"
                  emoji="📈"
                  type="estrategias"
                  value={formData.estrategias}
                  onChange={(value) => setFormData(prev => ({ ...prev, estrategias: value }))}
                  allowAdd={true}
                  onOptionsChange={handleOptionsChange}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text mb-2">Produto</label>
                <SimpleSelect
                  key={`produtos-${refreshKey}`}
                  label="Produtos"
                  emoji="📦"
                  type="produtos"
                  value={formData.produtos}
                  onChange={(value) => setFormData(prev => ({ ...prev, produtos: value }))}
                  allowAdd={true}
                  onOptionsChange={handleOptionsChange}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text mb-2">Idioma</label>
                <SimpleSelect
                  key={`idiomas-${refreshKey}`}
                  label="Idiomas"
                  emoji="🌐"
                  type="idiomas"
                  value={formData.idiomas}
                  onChange={(value) => setFormData(prev => ({ ...prev, idiomas: value }))}
                  allowAdd={true}
                  onOptionsChange={handleOptionsChange}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text mb-2">País</label>
                <SimpleSelect
                  key={`paises-${refreshKey}`}
                  label="Países"
                  emoji="🌍"
                  type="paises"
                  value={formData.paises}
                  onChange={(value) => setFormData(prev => ({ ...prev, paises: value }))}
                  allowAdd={true}
                  onOptionsChange={handleOptionsChange}
                />
              </div>
            </div>

            {/* Pasta */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Pasta
              </label>
              <select
                value={formData.folderId}
                onChange={(e) => setFormData(prev => ({ ...prev, folderId: e.target.value }))}
                className="input"
              >
                <option value="">Sem pasta</option>
                {folders.map((folder: any) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Páginas de Vendas */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Páginas de Vendas
              </label>
              <div className="space-y-2">
                {formData.pages.map((page, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="url"
                      value={page}
                      onChange={(e) => updatePage(index, e.target.value)}
                      className="input flex-1"
                      placeholder="https://exemplo.com/produto"
                    />
                    {formData.pages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePage(index)}
                        className="p-2 text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPage}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Página
                </button>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Observações
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="input"
                rows={3}
                placeholder="Anotações sobre a biblioteca..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-6 border-t border-gold/10 mt-6 sticky bottom-0 bg-card">
              <button
                type="submit"
                disabled={loading || !formData.name.trim() || !formData.sourceValue.trim()}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Criando...' : 'Criar Biblioteca'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
