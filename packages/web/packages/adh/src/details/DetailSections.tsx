import type { DetailSection } from '@agentic-toolkit/adh/concepts'

/** Render a details page body from the structured, typed `DetailSection[]`.
 *  Server component — all output is plain, crawlable markup. */
export function DetailSections({ sections }: { sections: DetailSection[] }) {
  return (
    <>
      {sections.map((section, i) => {
        const key = `${section.kind}-${i}`
        if (section.kind === 'prose') {
          return (
            <section className="adh-details__block" key={key}>
              {section.heading && <h2 className="adh-details__h2">{section.heading}</h2>}
              <p className="adh-details__prose">{section.body}</p>
            </section>
          )
        }
        if (section.kind === 'points') {
          return (
            <section className="adh-details__block" key={key}>
              {section.heading && <h2 className="adh-details__h2">{section.heading}</h2>}
              <ul className="adh-details__points">
                {section.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </section>
          )
        }
        return (
          <section className="adh-details__block" key={key}>
            {section.heading && <h2 className="adh-details__h2">{section.heading}</h2>}
            <pre className="adh-details__diagram">{section.ascii}</pre>
          </section>
        )
      })}
    </>
  )
}
