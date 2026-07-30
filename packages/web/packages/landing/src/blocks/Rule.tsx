import { Fragment } from 'react'
import type { ReactElement, ReactNode } from 'react'

/** One clause of a `Rule`: a label (`term`) and the clause itself (`detail`). */
export interface RuleStep {
  term: ReactNode
  detail: ReactNode
}

/**
 * A rule, written out — not a screenshot and not pretending to be one: it is
 * the shape of an oversight rule set in the package's own typeface, which is
 * the honest way to show a feature whose UI has not been captured yet.
 */
export function Rule({ steps }: { steps: RuleStep[] }): ReactElement {
  return (
    <dl className="lp-rule">
      {steps.map((step, i) => (
        <Fragment key={i}>
          <dt>{step.term}</dt>
          <dd>{step.detail}</dd>
        </Fragment>
      ))}
    </dl>
  )
}
