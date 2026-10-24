import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNavigate, useParams } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'

function ParamProbe() {
  const { learnerId } = useParams()
  return <p>{learnerId}</p>
}

function NavigateProbe() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/verwalten/kinder')}>Weiter</button>
}

describe('renderWithProviders', () => {
  it('liefert useParams aus der Route mit Pfadmuster', () => {
    renderWithProviders(<ParamProbe />, {
      route: '/verwalten/kinder/abc-123',
      path: '/verwalten/kinder/:learnerId',
    })
    expect(screen.getByText('abc-123')).toBeTruthy()
  })

  it('zeigt das Ziel von navigate in der Fangroute', async () => {
    renderWithProviders(<NavigateProbe />, {
      route: '/verwalten/kinder/neu',
      path: '/verwalten/kinder/neu',
    })
    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.getByText('/verwalten/kinder')).toBeTruthy()
  })
})
