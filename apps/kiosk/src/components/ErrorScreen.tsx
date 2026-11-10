import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'
import s from './ErrorScreen.module.css'

/** Full-screen message with one big action. Used instead of a blank white page. */
export function ErrorScreen({ title, message, detail, actionLabel, onAction }: {
  title: string
  message?: string
  detail?: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div role="alert" className={s.screen}>
      <h1 className={s.title}>{title}</h1>
      {message && <p className={s.message}>{message}</p>}
      {detail && <pre className={s.detail}>{detail}</pre>}
      <Button size="xl" className={s.action} onClick={onAction}>{actionLabel}</Button>
    </div>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[hub] render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <ErrorScreen
        title="Something went wrong"
        detail={this.state.error.message}
        actionLabel="Reload"
        onAction={() => window.location.reload()}
      />
    )
  }
}
