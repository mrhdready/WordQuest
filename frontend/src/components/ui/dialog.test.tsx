import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '@/components/ui/dialog'

const title = 'Mia löschen?'
const description = 'Alle Lernfortschritte, XP und die Serie von Mia werden gelöscht. Das lässt sich nicht rückgängig machen.'

// Testhuelle ohne Dialog.Trigger: ein eigener Button oeffnet ueber open, wie auf den Seiten.
function Harness({
  busy = false,
  error,
  onConfirm = () => {},
  onOpenChange = () => {},
  returnTo = 'opener',
}: {
  busy?: boolean
  error?: string
  onConfirm?: () => void
  onOpenChange?: (open: boolean) => void
  returnTo?: 'opener' | 'other'
}) {
  const [open, setOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)
  const otherRef = useRef<HTMLAnchorElement>(null)
  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setOpen(true)}>
        Öffnen
      </button>
      <a ref={otherRef} href="#ziel">
        Ersatzziel
      </a>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next)
          setOpen(next)
        }}
        title={title}
        description={description}
        confirmLabel="Endgültig löschen"
        busy={busy}
        error={error}
        onConfirm={onConfirm}
        returnFocusRef={returnTo === 'other' ? otherRef : openerRef}
      />
    </>
  )
}

async function openDialog(props: Parameters<typeof Harness>[0] = {}) {
  render(<Harness {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'Öffnen' }))
  return screen.getByRole('alertdialog')
}

describe('ConfirmDialog', () => {
  it('geöffnet: Fokus auf "Abbrechen", alertdialog mit Titel als Name und Beschreibung', async () => {
    const dialog = await openDialog()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.getByRole('alertdialog', { name: title })).toBe(dialog)
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(title)
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(description)
  })

  it('Enter direkt nach dem Öffnen schließt ohne Bestätigen, Fokus zurück auf den Auslöser', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    await openDialog({ onConfirm, onOpenChange })
    await userEvent.keyboard('{Enter}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Öffnen' })))
  })

  // Fokusrueckgabe ohne Trigger: Radix allein liesse den Fokus auf body fallen.
  it('Esc schließt ohne Bestätigen, Fokus auf dem returnFocusRef-Auslöser', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    await openDialog({ onConfirm, onOpenChange })
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Öffnen' })))
  })

  it('Ersatzziel als returnFocusRef: "Abbrechen" gibt den Fokus dorthin', async () => {
    await openDialog({ returnTo: 'other' })
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Ersatzziel' })))
  })

  it('Klick auf die Abdunklung lässt den Dialog offen', async () => {
    const onOpenChange = vi.fn()
    await openDialog({ onOpenChange })
    const scrim = document.querySelector('.bg-scrim')
    expect(scrim).not.toBeNull()
    await userEvent.click(scrim as Element)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('Tab bleibt im Dialog: Abbrechen → Endgültig löschen → Abbrechen', async () => {
    await openDialog()
    const cancel = screen.getByRole('button', { name: 'Abbrechen' })
    const confirm = screen.getByRole('button', { name: 'Endgültig löschen' })
    expect(document.activeElement).toBe(cancel)
    await userEvent.tab()
    expect(document.activeElement).toBe(confirm)
    await userEvent.tab()
    expect(document.activeElement).toBe(cancel)
  })

  it('busy: beide Buttons gesperrt, "Einen Moment …", Esc schließt nicht', async () => {
    const onOpenChange = vi.fn()
    const dialog = await openDialog({ busy: true, onOpenChange })
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(['Abbrechen', 'Einen Moment …'])
    expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('Fehler: ErrorNote mit genau dem Text über den Buttons, Dialog bleibt offen', async () => {
    await openDialog({ error: 'Dieses Kind gibt es nicht (mehr).' })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Dieses Kind gibt es nicht (mehr).')
    const cancel = screen.getByRole('button', { name: 'Abbrechen' })
    expect(alert.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  // WR-03: der fokussierte Button wird waehrend busy gesperrt und verliert den Fokus.
  it('Fehler nach busy: Fokus auf "Abbrechen"', async () => {
    const { rerender } = render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Öffnen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    rerender(<Harness busy />)
    rerender(<Harness error="Das hat nicht geklappt. Versuche es noch einmal." />)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abbrechen' })))
  })

  it('"Endgültig löschen" ruft onConfirm', async () => {
    const onConfirm = vi.fn()
    await openDialog({ onConfirm })
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
