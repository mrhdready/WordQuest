import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

describe('Field', () => {
  it('verdrahtet Label, Hilfe- und Fehlertext mit der Eingabe', () => {
    render(
      <Field id="titel" label="Titel" hint="Kurz und klar." error="Ein Set braucht einen Titel.">
        {(control) => <Input {...control} />}
      </Field>,
    )
    const input = screen.getByLabelText('Titel')
    expect(input.id).toBe('titel')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('titel-hilfe titel-fehler')
    expect(document.getElementById('titel-hilfe')?.textContent).toBe('Kurz und klar.')
    expect(document.getElementById('titel-fehler')?.textContent).toBe('Ein Set braucht einen Titel.')
  })

  it('ohne Fehler kein aria-invalid und nur der Hilfetext', () => {
    render(
      <Field id="titel" label="Titel" hint="Kurz und klar.">
        {(control) => <Input {...control} />}
      </Field>,
    )
    const input = screen.getByLabelText('Titel')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.getAttribute('aria-describedby')).toBe('titel-hilfe')
    expect(document.getElementById('titel-fehler')).toBeNull()
  })

  it('ohne Hilfe und Fehler kein aria-describedby', () => {
    render(<Field id="titel" label="Titel">{(control) => <Input {...control} />}</Field>)
    expect(screen.getByLabelText('Titel').hasAttribute('aria-describedby')).toBe(false)
  })
})
