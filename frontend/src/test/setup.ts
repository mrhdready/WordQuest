import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Ohne globals raeumt Testing Library unter Vitest nicht selbst auf.
afterEach(cleanup)
