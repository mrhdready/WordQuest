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
import { VocabPicture } from '@/lib/picture'
import { cn } from '@/lib/utils'
import type { AnswerResult, SessionItem, SessionSummary, SessionView } from '@/types'

type Phase = 'loading' | 'question' | 'feedback' | 'finishing' | 'done' | 'empty' | 'error'

// Vertragstext fuer unerwartete Fehler ohne eigenen Text (UI-SPEC Copywriting "Error state").
const GENERIC = 'Das hat nicht geklappt. Versuche es noch einmal.'

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
  // Ref statt nur isPending: das greift erst nach dem naechsten Rendern, ein
  // zweiter Tipp oder ein zweites Enter kaeme vorher noch durch.
  const sending = useRef(false)

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
        setErrorMessage(caught instanceof Error ? caught.message : GENERIC)
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
      setErrorMessage(caught instanceof Error ? caught.message : GENERIC)
      setPhase('error')
    },
    onSettled: () => {
      sending.current = false
    },
  })

  // Gemeinsamer Weg fuer Auswahl, Senden-Button und Enter.
  function send(itemId: string, givenAnswer: string) {
    if (sending.current) return
    sending.current = true
    answer.mutate({ itemId, givenAnswer })
  }

  // Eigene Phase waehrend des Abschlusses: sonst stuende kurz wieder das
  // Antwortfeld der letzten Karte da, und "Weiter" liesse sich doppelt druecken.
  const finish = useCallback(
    async (goHome: boolean) => {
      if (!session) return
      setPhase('finishing')
      try {
        const done = await api<SessionSummary>(`/sessions/${session.sessionId}/complete`, {
          method: 'POST',
        })
        void queryClient.invalidateQueries({ queryKey: ['overview'] })
        if (goHome) {
          navigate('/')
          return
        }
        setSummary(done)
        setPhase('done')
      } catch (caught) {
        setErrorMessage(caught instanceof Error ? caught.message : GENERIC)
        setPhase('error')
      }
    },
    [session, queryClient, navigate],
  )

  // "Schliessen" mit mindestens einer beantworteten Karte schliesst die Runde
  // regulaer ab (Serie, Bonus rechnet der Server); ohne Antwort nur zurueck.
  // Entscheidung Dennis, 2026-10-16.
  function close() {
    if (index > 0 || phase === 'feedback') {
      void finish(true)
      return
    }
    navigate('/')
  }

  function next() {
    if (index + 1 >= queue.length) {
      void finish(false)
      return
    }
    setResult(null)
    setTyped('')
    setIndex(index + 1)
    setPhase('question')
    shownAt.current = Date.now()
  }

  if (phase === 'loading') return <Spinner label="Deine Quest wird vorbereitet …" />
  if (phase === 'finishing') return <Spinner />

  if (phase === 'error') {
    return (
      <main className="mx-auto w-full max-w-lg px-screen-margin pt-screen-top pb-8">
        <ErrorNote message={errorMessage ?? GENERIC} />
        {/* Das Antwortfeld verschwindet mit dem Fehler, der Fokus geht sonst verloren. */}
        <Button autoFocus className="mt-4 w-full" size="lg" onClick={() => navigate('/')}>
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

  const emoji = current.emoji ? (
    <span className="type-emoji" aria-hidden>
      {current.emoji}
    </span>
  ) : null

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-screen-margin pt-screen-top pb-8 safe-top safe-bottom">
      {/* Quiz-Kopf (DESIGN.md "Quiz"): Schliessen neben der Fortschritts-Kapsel. */}
      <div className="mb-6 flex items-center gap-2">
        {/* Waehrend eine Antwort unterwegs ist, wuerde der Abschluss sie ueberholen. */}
        <Button
          variant="round"
          size="icon"
          aria-label="Schließen"
          disabled={answer.isPending}
          onClick={close}
        >
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
        {/* Bild statt Emoji (IMG-01). alt="": Das Bild ist Merkhilfe zum Prompt darunter;
            eine Beschreibung waere in Richtung EN->DE die Loesung (Recherche Muster 7).
            Laedt oder dekodiert es nicht, steht das Emoji im selben Rahmen. */}
        {current.pictureVersion ? (
          <VocabPicture version={current.pictureVersion} variant="large" alt="" fallback={emoji} />
        ) : (
          emoji
        )}
        <p className="w-full break-words type-display">{current.prompt}</p>
        {current.isRetry ? (
          // warn-text nur auf deckender Flaeche (DESIGN.md): auf Glas ueber backdrop-blue 4.45:1.
          <Badge tone="yellow">Noch einmal — du schaffst das!</Badge>
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
              onClick={() => send(current.itemId, choice)}
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
            send(current.itemId, typed)
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
