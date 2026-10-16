import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUp, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, ErrorNote, Progress, Spinner } from '@/components/ui/misc'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import type { AnswerResult, SessionItem, SessionSummary, SessionView } from '@/types'

type Phase = 'loading' | 'question' | 'feedback' | 'done' | 'empty' | 'error'

export function SessionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const setId = searchParams.get('set')

  const [phase, setPhase] = useState<Phase>('loading')
  const [session, setSession] = useState<SessionView | null>(null)
  const [queue, setQueue] = useState<SessionItem[]>([])
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 0 heisst "noch nicht angezeigt"; gesetzt wird der Zeitstempel erst im
  // Effekt, damit das Rendern frei von Seiteneffekten bleibt.
  const shownAt = useRef<number>(0)
  const started = useRef(false)

  const current = queue[index]
  const total = Math.max(queue.length, session?.totalItems ?? 0)

  useEffect(() => {
    // React 18+ ruft Effekte im Entwicklungsmodus doppelt auf. Ohne diesen
    // Riegel wuerden zwei Sessions angelegt und die eine bliebe verwaist.
    if (started.current || !user) return
    started.current = true

    api<SessionView>('/sessions', {
      method: 'POST',
      body: { learnerId: user.id, setId, gameKey: 'classic', size: null },
    })
      .then((view) => {
        setSession(view)
        setQueue(view.items)
        setPhase(view.items.length === 0 ? 'empty' : 'question')
        shownAt.current = Date.now()
      })
      .catch((caught: unknown) => {
        setErrorMessage(caught instanceof Error ? caught.message : 'Unbekannter Fehler')
        setPhase('error')
      })
  }, [user, setId])

  const answer = useMutation({
    mutationFn: (payload: { itemId: string; givenAnswer: string }) =>
      api<AnswerResult>(`/sessions/${session!.sessionId}/answers`, {
        method: 'POST',
        body: {
          itemId: payload.itemId,
          givenAnswer: payload.givenAnswer,
          answerMs: Date.now() - shownAt.current,
          // Die Item-ID ist pro Aufgabe eindeutig und stabil: Wiederholtes
          // Senden wird nicht doppelt gewertet, und crypto.randomUUID fehlt
          // ueber reines Heimnetz-HTTP.
          clientAnswerId: payload.itemId,
          hintUsed: false,
        },
      }),
    onSuccess: (data) => {
      setResult(data)
      setPhase('feedback')
      if (data.retryItem) setQueue((previous) => [...previous, data.retryItem!])
    },
    onError: (caught: unknown) => {
      setErrorMessage(caught instanceof Error ? caught.message : 'Antwort kam nicht an')
      setPhase('error')
    },
  })

  const finish = useCallback(async () => {
    if (!session) return
    try {
      const done = await api<SessionSummary>(`/sessions/${session.sessionId}/complete`, {
        method: 'POST',
      })
      setSummary(done)
      setPhase('done')
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : 'Abschluss fehlgeschlagen')
      setPhase('error')
    }
  }, [session, queryClient])

  function next() {
    setResult(null)
    setTyped('')
    if (index + 1 >= queue.length) {
      void finish()
      return
    }
    setIndex(index + 1)
    setPhase('question')
    shownAt.current = Date.now()
  }

  if (phase === 'loading') return <Spinner label="Deine Quest wird vorbereitet …" />

  if (phase === 'error') {
    return (
      <main className="mx-auto w-full max-w-lg px-screen-margin pt-screen-top pb-8">
        <ErrorNote message={errorMessage ?? 'Etwas ist schiefgegangen.'} />
        <Button className="mt-4 w-full" size="lg" onClick={() => navigate('/')}>
          Zurück
        </Button>
      </main>
    )
  }

  if (phase === 'empty') {
    return (
      <main className="mx-auto w-full max-w-lg px-screen-margin pt-screen-top pb-8 text-center">
        <p className="mb-6 type-headline">Für heute ist alles erledigt. 🎉</p>
        <Button size="lg" className="w-full" onClick={() => navigate('/')}>
          Zurück
        </Button>
      </main>
    )
  }

  if (phase === 'done' && summary) {
    return <SummaryView summary={summary} onClose={() => navigate('/')} />
  }

  if (!current) return <Spinner />

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-screen-margin pt-screen-top pb-8 safe-top safe-bottom">
      {/* Quiz-Kopf (DESIGN.md "Quiz"): Schliessen neben der Fortschritts-Kapsel. */}
      <div className="mb-6 flex items-center gap-2">
        <Button variant="round" size="icon" aria-label="Schließen" onClick={() => navigate('/')}>
          <X className="size-6" />
        </Button>
        <div className="glass flex min-w-0 flex-1 items-center gap-4 rounded-full px-4 py-2">
          <Progress
            value={total === 0 ? 0 : index / total}
            label="Fortschritt in dieser Runde"
            className="flex-1"
          />
          <p className="shrink-0 type-body-sm text-ink">
            {index + 1} von {total}
          </p>
        </div>
      </div>

      {/* card-quiz */}
      <div className="animate-pop glass mb-6 flex min-h-44 flex-col items-center justify-center gap-4 rounded-xl p-12 text-center">
        {current.emoji ? (
          <span className="type-emoji" aria-hidden>
            {current.emoji}
          </span>
        ) : null}
        <p className="w-full break-words type-display">{current.prompt}</p>
        {current.isRetry ? (
          <p className="type-body-md-strong text-warn-text">Noch einmal — du schaffst das!</p>
        ) : null}
      </div>

      {phase === 'feedback' && result ? (
        <FeedbackPanel result={result} onNext={next} />
      ) : current.expectedAnswerType === 'choice' && current.choices ? (
        <div className="mt-auto grid gap-4">
          {current.choices.map((choice) => (
            <Button
              key={choice}
              variant="outline"
              size="xl"
              disabled={answer.isPending}
              onClick={() => answer.mutate({ itemId: current.itemId, givenAnswer: choice })}
            >
              {choice}
            </Button>
          ))}
        </div>
      ) : (
        <form
          className="mt-auto flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!answer.isPending) {
              answer.mutate({ itemId: current.itemId, givenAnswer: typed })
            }
          }}
        >
          <Input
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            aria-label="Deine Antwort"
            placeholder="Deine Antwort"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            variant="roundPrimary"
            size="icon"
            className="size-13 shrink-0"
            aria-label="Antwort senden"
            disabled={answer.isPending || typed.trim().length === 0}
          >
            <ArrowUp className="size-6" />
          </Button>
        </form>
      )}
    </main>
  )
}

function FeedbackPanel({ result, onNext }: { result: AnswerResult; onNext: () => void }) {
  // Autofokus auf "Weiter": nach einer Antwort soll ein Tippen genuegen.
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => buttonRef.current?.focus(), [])

  // Rueckmeldung als Sheet von unten; "Fast!" ruhig in warn, nie als Fehler.
  // "Weiter" bekommt den Fokus und verweist per aria-describedby auf die
  // Rueckmeldung, damit Screenreader sie mit ansagen (WCAG 4.1.3, ohne role="alert").
  return (
    <div
      className={cn(
        'glass-sheet mt-auto flex flex-col gap-4 rounded-sheet p-6',
        result.correct ? '' : 'animate-nudge',
      )}
    >
      <div
        id="rueckmeldung"
        className={cn(
          'rounded-lg p-4 text-center',
          result.correct ? 'bg-surface-success' : 'bg-surface-warn',
        )}
      >
        <p
          className={cn(
            'type-headline',
            result.correct ? 'text-success-text' : 'text-warn-text',
          )}
        >
          {result.correct ? 'Richtig!' : 'Fast!'}
        </p>

        {!result.correct || result.hadTypo ? (
          <p className="mt-1 type-body-lg text-ink">
            {result.hadTypo ? result.message : `Es heißt: ${result.correctAnswer}`}
          </p>
        ) : null}

        {result.xpAwarded > 0 ? (
          <p className="mt-2 type-body-md-strong text-ink">+{result.xpAwarded} XP</p>
        ) : null}
      </div>

      <Button
        ref={buttonRef}
        size="lg"
        className="w-full"
        aria-describedby="rueckmeldung"
        onClick={onNext}
      >
        Weiter
      </Button>
    </div>
  )
}

function SummaryView({ summary, onClose }: { summary: SessionSummary; onClose: () => void }) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-screen-margin pt-screen-top pb-8 safe-top safe-bottom">
      <Card className="animate-pop flex flex-col items-center gap-4 text-center">
        <span className="type-emoji" aria-hidden>
          {summary.leveledUp ? '🎉' : '⭐'}
        </span>

        <h1 className="type-large-title">
          {summary.leveledUp ? `Level ${summary.level} erreicht!` : 'Geschafft!'}
        </h1>

        <p className="type-body-lg text-ink-soft">
          {summary.correct} von {summary.answered} richtig
        </p>

        <div className="w-full">
          <Progress value={summary.levelProgress} label="Fortschritt bis zum nächsten Level" />
          <p className="mt-2 type-body-sm text-ink-soft">
            Level {summary.level} · noch {summary.xpToNextLevel} XP
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <span className="type-headline text-ink">+{summary.xpAwarded} XP</span>
          {/* coin-label: deckende Flaeche, coin auf Glas haelt 4,5:1 nicht ueberall. */}
          <span className="rounded-full bg-glass-opaque px-2 py-1 type-body-sm text-coin">
            {`+${summary.coinsAwarded} 🪙`}
          </span>
        </div>

        {summary.streakSaverUsed ? (
          <p className="type-body-sm text-ink-soft">
            Gestern war nichts — deine Serie läuft trotzdem weiter. 🔥 {summary.streak}
          </p>
        ) : (
          <Badge tone="yellow">{`🔥 ${summary.streak} Tage in Folge`}</Badge>
        )}
      </Card>

      <Button size="lg" className="mt-6 w-full" onClick={onClose}>
        Fertig
      </Button>
    </main>
  )
}
