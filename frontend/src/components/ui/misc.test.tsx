import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Progress } from '@/components/ui/misc'

function progressValue(value: number) {
  const { container } = render(<Progress value={value} />)
  const element = container.querySelector('progress')
  expect(element).not.toBeNull()
  expect(element?.max).toBe(100)
  return element?.value
}

describe('Progress', () => {
  // Vertrag: Aufrufer uebergeben Anteile von 0 bis 1 (z. B. index / total).
  it('0 ergibt 0 %', () => {
    expect(progressValue(0)).toBe(0)
  })

  it('0,5 ergibt 50 %', () => {
    expect(progressValue(0.5)).toBe(50)
  })

  it('1 ergibt 100 %', () => {
    expect(progressValue(1)).toBe(100)
  })

  it('klemmt Werte ueber 1 auf 100 %', () => {
    expect(progressValue(1.4)).toBe(100)
  })

  it('ist ueber die Beschriftung als progressbar auffindbar', () => {
    render(<Progress value={0.5} label="Fortschritt" />)
    expect(screen.getByRole('progressbar', { name: 'Fortschritt' })).toBeTruthy()
  })
})
