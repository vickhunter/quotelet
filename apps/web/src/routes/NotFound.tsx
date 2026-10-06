import { Link } from '@tanstack/react-router'
export function NotFound() {
  return (
    <main className="wrap" style={{ padding: '18vh 0', display: 'grid', gap: 14, justifyItems: 'start' }}>
      <h1 style={{ fontSize: 40 }}>Page not found</h1>
      <Link to="/" className="btn btn-primary">Go home</Link>
    </main>
  )
}
