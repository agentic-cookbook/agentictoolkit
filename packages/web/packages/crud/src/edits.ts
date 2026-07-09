// Pure, React-free helpers for the split table editor's staged-edits buffer
// (CrudDataView). The view stores per-row edits as `Record<rowKey, CrudDraft>`
// where each entry carries only the CHANGED columns layered over a baseline
// (server values for an existing row, blank defaults for a create draft). These
// two functions answer "is this row dirty?" and "what full draft do I hand
// buildPayload?" — unit-testable without mounting any component.

import type { CrudDraft } from './CrudRecordForm'

/**
 * Whether a row's staged edits differ from its baseline. An edit that types a
 * value back to the baseline leaves nothing to save, so it isn't dirty. Edits
 * carry only changed columns, so iterating them (not the whole baseline) is the
 * complete comparison.
 */
export function isRowDirty(baseline: CrudDraft, edits: CrudDraft | undefined): boolean {
  if (!edits) return false
  for (const [name, value] of Object.entries(edits)) {
    if (value !== baseline[name]) return true
  }
  return false
}

/**
 * The full draft to hand {@link buildPayload}: the baseline overlaid with the
 * staged edits (which carry only the changed columns). A fresh object — neither
 * input is mutated.
 */
export function mergeDraft(baseline: CrudDraft, edits: CrudDraft | undefined): CrudDraft {
  return edits ? { ...baseline, ...edits } : { ...baseline }
}
