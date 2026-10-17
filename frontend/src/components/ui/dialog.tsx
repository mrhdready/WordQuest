import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Trash2 } from 'lucide-react'
import { useRef, type ReactNode, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorNote } from '@/components/ui/misc'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  role?: 'dialog' | 'alertdialog'
  initialFocusRef?: RefObject<HTMLElement | null>
  returnFocusRef: RefObject<HTMLElement | null>
  children: ReactNode
}

// Sheet von unten (DESIGN.md components.sheet) ueber der Abdunklung (components.sheet-scrim).
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  role = 'dialog',
  initialFocusRef,
  returnFocusRef,
  children,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-scrim" />
        <DialogPrimitive.Content
          role={role}
          className="glass-sheet fixed inset-x-sheet-inset bottom-sheet-inset mx-auto flex max-h-[calc(100dvh_-_2*var(--spacing-sheet-inset))] max-w-md flex-col gap-4 overflow-y-auto rounded-sheet p-6 text-ink"
          onOpenAutoFocus={(event) => {
            if (!initialFocusRef?.current) return
            event.preventDefault()
            initialFocusRef.current.focus()
          }}
          // Ohne Dialog.Trigger gibt Radix den Fokus nicht zurueck, er faellt auf body.
          // Das Ziel bestimmt der Aufrufer, weil nur er weiss, ob der Ausloeser noch existiert.
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocusRef.current?.focus()
          }}
          // Klick auf die Abdunklung schliesst nicht: weder versehentlich loeschen noch Eingaben verwerfen.
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogPrimitive.Title className="type-headline break-words text-ink">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="type-body-md break-words text-ink-soft">
            {description}
          </DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  busy: boolean
  error?: string | null
  onConfirm: () => void
  returnFocusRef: RefObject<HTMLElement | null>
}

// Bestaetigung vor endgueltigem Loeschen. Startfokus auf "Abbrechen": Enter direkt nach dem Oeffnen loescht nichts.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busy,
  error,
  onConfirm,
  returnFocusRef,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Waehrend der Anfrage bleibt der Dialog offen, Esc und "Abbrechen" wirken nicht.
  function change(next: boolean) {
    if (!busy) onOpenChange(next)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={change}
      title={title}
      description={description}
      role="alertdialog"
      initialFocusRef={cancelRef}
      returnFocusRef={returnFocusRef}
    >
      {error ? <ErrorNote message={error} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          ref={cancelRef}
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onClick={() => change(false)}
        >
          Abbrechen
        </Button>
        <Button type="button" variant="danger" className="flex-1" disabled={busy} onClick={onConfirm}>
          <Trash2 className="size-5" aria-hidden />
          {busy ? 'Einen Moment …' : confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
