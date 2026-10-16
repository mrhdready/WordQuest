import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChildrenPage } from '@/features/manage/ChildrenPage'
import { renderWithProviders } from '@/test/render'
import type { Learner } from '@/types'

function learner(index: number): Learner {
  return {
    id: `kind-${index}`,
    displayName: `Kind ${index}`,
    avatarKey: 'owl',
    dailyNewLimit: index + 3,
    speed: 'Relaxed',
    soundEnabled: true,
    hasPin: true,
  }
}

function stubLearners(learners: Learner[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(learners)),
  )
}

function render(state?: unknown) {
  renderWithProviders(<ChildrenPage />, { route: '/verwalten/kinder', path: '/verwalten/kinder', state })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Kinderliste', () => {
  it('leer: EmptyState mit Hinweis', async () => {
    stubLearners([])
    render()
    expect(await screen.findByText('Noch kein Kinderprofil')).toBeTruthy()
    expect(screen.getByText('Lege das erste Kind an, damit es lernen kann.')).toBeTruthy()
  })

  it('ein Kind: eine Zeile mit Tageslimit, Avatar verborgen', async () => {
    stubLearners([learner(1)])
    render()
    const name = await screen.findByText('Kind 1')
    const row = name.closest('a.min-h-15')
    expect(row?.textContent).toContain('Neue Karten pro Tag: 4')
    expect(row?.querySelector('[aria-hidden]')?.textContent).toBe('🦉')
    expect(document.querySelectorAll('a.min-h-15')).toHaveLength(1)
    expect(screen.queryByText('Noch kein Kinderprofil')).toBeNull()
  })

  it('drei Kinder: drei Zeilen in einer Liste', async () => {
    stubLearners([learner(1), learner(2), learner(3)])
    render()
    await screen.findByText('Kind 3')
    const rows = document.querySelectorAll('a.min-h-15')
    expect(rows).toHaveLength(3)
    expect([...rows].map((row) => row.textContent)).toEqual([
      '🦉Kind 1Neue Karten pro Tag: 4',
      '🦉Kind 2Neue Karten pro Tag: 5',
      '🦉Kind 3Neue Karten pro Tag: 6',
    ])
    expect(new Set([...rows].map((row) => row.parentElement))).toHaveProperty('size', 1)
  })

  it('Erfolgsmeldung aus dem Router-State mit role="status"', async () => {
    stubLearners([learner(1)])
    render({ message: 'Das Kind ist angelegt. Es kann sich jetzt mit seiner PIN anmelden.' })
    await screen.findByText('Kind 1')
    expect(screen.getByRole('status').textContent).toBe(
      'Das Kind ist angelegt. Es kann sich jetzt mit seiner PIN anmelden.',
    )
  })
})
