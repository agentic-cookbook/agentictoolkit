import type { ReactElement } from 'react'
import { getSite, siteHeaderTitle, siteProdUrl, type SiteId } from '@agentic-toolkit/adh-registry'
import { getSiteStory, type StoryPillar } from '@agentic-toolkit/adh-registry'
// Package path, not relative — see the matching comment in MarketingLanding.tsx.
import { siteConcept } from '@agentic-toolkit/adh/concepts'
import { BRAND_PROMISE, PILLAR_COPY, STAGE_LABEL } from './story-copy'

// Insertion order of PILLAR_COPY = display order of the masterbrand's three cards.
const ALL_PILLARS = Object.keys(PILLAR_COPY) as StoryPillar[]

export type StorySectionsProps = {
  /** The site whose story the sections tell. */
  siteId: SiteId
}

/**
 * The shared story sections under every marketing landing — the "thorough" half
 * of the logged-out story (the graph is the "consistent" half). Three sections,
 * all derived from data (the concept catalog, the story layer, the registry),
 * zero per-site code:
 *  • "What you can do here" — the site node's `keyPoints` (omitted until the
 *    copy pass fills them in),
 *  • the message-house pillar — the promise plus this site's pillar statement,
 *  • the next step — the story-layer `nextStep` cross-link (absolute production
 *    URL, same crawlable-interlink rationale as the footer's SEO row).
 * A server component rendering static markup: the story is crawlable in every
 * environment, including production's pre-launch state.
 */
export function StorySections({ siteId }: StorySectionsProps): ReactElement {
  const story = getSiteStory(siteId)
  const node = siteConcept(siteId)
  const pillar = PILLAR_COPY[story.pillar]
  const next = getSite(story.nextStep)
  return (
    <section className="adh-story" aria-label="The Agentic Developer story">
      {node?.keyPoints?.length ? (
        <div className="adh-story__section">
          <h2 className="adh-story__heading">What you can do here</h2>
          <ul className="adh-story__points">
            {node.keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="adh-story__section">
        <p className="adh-story__eyebrow">
          {STAGE_LABEL[story.funnelStage]} · The Agentic Developer story
        </p>
        <p className="adh-story__promise">{BRAND_PROMISE}</p>
        {story.tier === 'masterbrand' ? (
          // The masterbrand carries the whole promise: all three pillars.
          <div className="adh-story__pillars">
            {ALL_PILLARS.map((key) => (
              <div key={key} className="adh-story__pillar-card">
                <h2 className="adh-story__heading">{PILLAR_COPY[key].title}</h2>
                <p className="adh-story__body">{PILLAR_COPY[key].body}</p>
              </div>
            ))}
          </div>
        ) : (
          <>
            <h2 className="adh-story__heading">{pillar.title}</h2>
            <p className="adh-story__body">{pillar.body}</p>
          </>
        )}
        {story.tier === 'satellite' ? (
          // Endorsed satellites: own identity, visible provenance (From/Of rule).
          <p className="adh-story__provenance">From the Agentic Developer Hub</p>
        ) : null}
      </div>
      {next ? (
        <div className="adh-story__section">
          <p className="adh-story__eyebrow">Next in the story</p>
          <a className="adh-story__next" href={siteProdUrl(next.id, '/')}>
            <span className="adh-story__next-name">{siteHeaderTitle(next)}</span>
            {next.description ? (
              <span className="adh-story__next-desc">{next.description}</span>
            ) : null}
            <span className="adh-story__next-arrow" aria-hidden="true">
              →
            </span>
          </a>
        </div>
      ) : null}
    </section>
  )
}
