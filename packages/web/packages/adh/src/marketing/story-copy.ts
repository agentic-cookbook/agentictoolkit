import type { FunnelStage, StoryPillar } from '@agentic-toolkit/adh-registry'

// The message house (docs/planning/brand-story-plan.md §3) — the one promise and
// the three pillar statements every logged-out landing renders. English-only
// constants for now (Locale is 'en'-only today); when a second locale lands this
// copy moves behind the same locale seam as the concept content catalog.

/** The masterbrand promise — the one sentence the whole family answers to. */
export const BRAND_PROMISE = 'Everything your AI agents need to become real software.'

/** The three message-house pillars, keyed by {@link StoryPillar}. */
export const PILLAR_COPY: Record<StoryPillar, { title: string; body: string }> = {
  identity: {
    title: 'Agent identity',
    body: 'Personas, teams, and registries give your agents durable, versioned identities — minds you can build, publish, and trust.',
  },
  backend: {
    title: 'The agentic backend',
    body: 'Storage, auth, customers, billing, and every other platform service agent-built software needs to run for real users.',
  },
  build: {
    title: 'Build with agents',
    body: 'Toolkits, recipes, and agentic dev teams that turn an idea into shipped software — with agents doing the work.',
  },
}

/** Display labels for the visitor-journey stages (the story eyebrow). */
export const STAGE_LABEL: Record<FunnelStage, string> = {
  discover: 'Discover',
  learn: 'Learn',
  build: 'Build',
  ship: 'Ship',
  adopt: 'Adopt',
}
