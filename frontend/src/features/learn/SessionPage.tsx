import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorNote, Progress, Spinner } from '@/components/ui/misc'
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
          clientAnswerId: crypto.randomUUID(),
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
      <div className="mx-auto w-full max-w-lg px-5 py-8">
        <ErrorNote message={errorMessage ?? 'Etwas ist schiefgegangen.'} />
        <Button className="mt-4 w-full" size="lg" onClick={() => navigate('/')}>
          Zurück
        </Button>
      </div>
    )
  }

  if (phase === 'empty') {
    return (
      <div className="mx-auto w-full max-w-lg px-5 py-8 text-center">
        <p className="mb-6 text-lg font-semibold">Für heute ist alles erledigt. 🎉</p>
        <Button size="lg" className="w-full" onClick={() => navigate('/')}>
          Zurück
        </Button>
      </div>
    )
  }

  if (phase === 'done' && summary) {
    return <SummaryView summary={summary} onClose={() => navigate('/')} />
  }

  if (!current) return <Spinner />

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-5 py-6 safe-top safe-bottom">
      <div className="mb-6">
        <Progress value={total === 0 ? 0 : index / total} />
        <p className="mt-2 text-center text-sm text-ink-soft">
          {index + 1} von {total}
        </p>
      </div>

      <Card className="animate-pop mb-6">
        <CardContent className="flex min-h-44 flex-col items-center justify-center gap-3 py-10 text-center">
          {current.emoji ? (
            <span className="text-6xl" aria-hidden>
              {current.emoji}
            </span>
          ) : null}
          <p className="text-3xl font-black">{current.prompt}</p>
          {current.isRetry ? (
            <p className="text-sm font-semibold text-warn">Noch einmal — du schaffst das!</p>
          ) : null}
        </CardContent>
      </Card>

      {phase === 'feedback' && result ? (
        <FeedbackPanel result={result} onNext={next} />
      ) : current.expectedAnswerType === 'choice' && current.choices ? (
        <div className="mt-auto grid gap-3">
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
          className="mt-auto flex flex-col gap-3"
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
            placeholder="Deine Antwort"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
          />
          <Button type="submit" size="xl" disabled={answer.isPending || typed.trim().length === 0}>
            Antworten
          </Button>
        </form>
      )}
    </div>
  )
}

function FeedbackPanel({ result, onNext }: { result: AnswerResult; onNext: () => void }) {
  // Autofokus auf "Weiter": nach einer Antwort soll ein Tippen genuegen.
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => buttonRef.current?.focus(), [])

  return (
    <div className={cn('mt-auto flex flex-col gap-4', result.correct ? '' : 'animate-nudge')}>
      <div
        className={cn(
          'rounded-[var(--radius-card)] p-5 text-center',
          result.correct ? 'bg-success-soft' : 'bg-warn-soft',
        )}
      >
        <p className={cn('text-lg font-bold', result.correct ? 'text-success' : 'text-warn')}>
          {result.correct ? 'Richtig!' : 'Fast!'}
        </p>

        {!result.correct || result.hadTypo ? (
          <p className="mt-1 text-base text-ink">
            {result.hadTypo ? result.message : `Es heißt: ${result.correctAnswer}`}
          </p>
        ) : null}

        {result.xpAwarded > 0 ? (
          <p className="mt-2 text-sm font-bold text-brand-strong">+{result.xpAwarded} XP</p>
        ) : null}
      </div>

      <Button ref={buttonRef} size="xl" onClick={onNext}>
        Weiter
      </Button>
    </div>
  )
}

function SummaryView({ summary, onClose }: { summary: SessionSummary; onClose: () => void }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-5 py-8 safe-top safe-bottom">
      <Card className="animate-pop">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="text-6xl" aria-hidden>
            {summary.leveledUp ? '🎉' : '⭐'}
          </span>

          <h1 className="text-2xl font-black">
            {summary.leveledUp ? `Level ${summary.level} erreicht!` : 'Geschafft!'}
          </h1>

          <p className="text-ink-soft">
            {summary.correct} von {summary.answered} richtig
          </p>

          <div className="w-full">
            <Progress value={summary.levelProgress} />
            <p className="mt-2 text-sm text-ink-soft">
              Level {summary.level} · noch {summary.xpToNextLevel} XP
            </p>
          </div>

          <div className="flex gap-6 text-lg font-bold">
            <span className="text-brand-strong">+{summary.xpAwarded} XP</span>
            <span className="text-coin">+{summary.coinsAwarded} 🪙</span>
          </div>

          {summary.streakSaverUsed ? (
            <p className="text-sm text-ink-soft">
              Gestern war nichts — deine Serie läuft trotzdem weiter. 🔥 {summary.streak}
            </p>
          ) : (
            <p className="text-sm font-semibold text-warn">🔥 {summary.streak} Tage in Folge</p>
          )}
        </CardContent>
      </Card>

      <Button size="xl" className="mt-6 w-full" onClick={onClose}>
        Fertig
      </Button>
    </div>
  )
}
