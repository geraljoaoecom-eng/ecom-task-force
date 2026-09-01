export const LIBRARY_DUPLICATE_MESSAGE = 'Essa biblioteca já existe em sistema'

export function isLibraryDuplicateError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
  const message = apiError || (err instanceof Error ? err.message : String(err))
  return (
    status === 400 &&
    (message === LIBRARY_DUPLICATE_MESSAGE ||
      message.toLowerCase().includes('já existe') ||
      message.toLowerCase().includes('duplicate'))
  )
}

export function getApiErrorMessage(err: unknown, fallback = 'Erro desconhecido'): string {
  const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
  if (apiError) return apiError
  if (err instanceof Error && err.message && !err.message.startsWith('API error:')) {
    return err.message
  }
  if (err instanceof Error && err.message.startsWith('API error:')) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 400) return fallback
    return err.message
  }
  return fallback
}
