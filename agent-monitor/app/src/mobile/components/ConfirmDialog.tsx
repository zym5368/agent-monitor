import { useEffect } from 'react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  hideCancel?: boolean
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  loading = false,
  hideCancel = false,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [open, loading, onCancel])

  if (!open) return null

  const isDanger = variant === 'danger'
  return (
    <div className="mobile-modal-mask" role="dialog" aria-modal="true">
      <div className="mobile-modal-card">
        <h3 className="mobile-modal-title">{title}</h3>
        <p className="mobile-modal-message">{message}</p>
        <div className="mobile-modal-actions">
          {!hideCancel && (
            <button
              type="button"
              className="mobile-button mobile-button-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            className={`mobile-button ${isDanger ? 'mobile-button-danger' : 'mobile-button-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '处理中…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
