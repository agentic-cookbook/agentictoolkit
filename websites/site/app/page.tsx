import { examples } from '../src/manifest'

export default function HomePage() {
  const first = examples[0]
  if (!first) {
    return <div style={{ padding: '2rem' }}>No examples registered.</div>
  }
  const Component = first.Component
  return <Component />
}
