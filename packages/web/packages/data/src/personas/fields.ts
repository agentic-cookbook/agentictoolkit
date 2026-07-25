import type { PersonaBody, PersonaDraft } from "./personas";

export type PersonaFieldKind = "text" | "longText" | "select" | "canned";

/** How a field is serialized onto the wire body. */
export type PersonaFieldWire = "trimRequired" | "trimOptional" | "raw" | "omit";

export interface PersonaFieldDescriptor {
  key: keyof PersonaDraft;
  label: string;
  hint?: string;
  kind: PersonaFieldKind;
  /** Which editor facet renders it. */
  facet: string;
  blank: PersonaDraft[keyof PersonaDraft];
  wire: PersonaFieldWire;
}

/**
 * The single description of the persona's editable surface. `personaBlank` and
 * `personaToBody` derive from it, and the editor renders scalar facets from it — so a new
 * field is one entry here, not four hand-maintained lists.
 *
 * Bespoke panes (knowledge, memory, abilities, permissions, llm) are NOT fields and keep
 * their own explicit entries in the editor's `topics[]`.
 *
 * `as const satisfies` — NOT a `: PersonaFieldDescriptor[]` annotation. An annotation widens every
 * element's `key` back to `keyof PersonaDraft`, which makes the exhaustiveness check below
 * `Exclude<keyof PersonaDraft, keyof PersonaDraft>` — vacuously `never`, passing no matter what the
 * list contains. `satisfies` keeps the literal key union while still type-checking each entry.
 */
export const PERSONA_FIELDS = [
  { key: "id", label: "Id", kind: "text", facet: "identity", blank: "__draft__", wire: "omit" },
  { key: "slug", label: "Slug", kind: "text", facet: "identity", blank: "", wire: "trimRequired" },
  { key: "name", label: "Name", kind: "text", facet: "identity", blank: "", wire: "trimRequired" },
  { key: "description", label: "Description", hint: "One line about this persona.", kind: "longText", facet: "description", blank: null, wire: "trimOptional" },
  { key: "modelPrompt", label: "Purpose", hint: "The persona's system prompt.", kind: "longText", facet: "purpose", blank: "", wire: "raw" },
  { key: "character", label: "Character", hint: "Personality, quirks, values.", kind: "longText", facet: "personality", blank: null, wire: "trimOptional" },
  { key: "voice", label: "Voice", hint: "How the persona speaks.", kind: "longText", facet: "personality", blank: null, wire: "trimOptional" },
  { key: "examples", label: "Examples", hint: "Example exchanges (few-shot) that demonstrate its character and voice.", kind: "longText", facet: "personality", blank: null, wire: "trimOptional" },
  { key: "avatarAttachmentId", label: "Avatar", kind: "text", facet: "identity", blank: null, wire: "raw" },
  { key: "serviceId", label: "Service", kind: "select", facet: "llm", blank: null, wire: "raw" },
  { key: "serviceName", label: "Service name", kind: "text", facet: "llm", blank: null, wire: "omit" },
  { key: "model", label: "Model", kind: "select", facet: "llm", blank: null, wire: "raw" },
  { key: "visibility", label: "Visibility", kind: "select", facet: "identity", blank: "private", wire: "raw" },
  { key: "cannedChat", label: "Demo chat", hint: "A scripted conversation visitors can hold without an LLM service.", kind: "canned", facet: "demo", blank: null, wire: "raw" },
] as const satisfies readonly PersonaFieldDescriptor[];

/** Compile-time exhaustiveness: every PersonaDraft key must be described above. */
type DescribedKey = (typeof PERSONA_FIELDS)[number]["key"];
type Undescribed = Exclude<keyof PersonaDraft, DescribedKey>;
const _exhaustive: Undescribed extends never ? true : ["undescribed persona fields", Undescribed] = true;
void _exhaustive;

export function personaBlank(): PersonaDraft {
  const out = {} as Record<string, unknown>;
  for (const f of PERSONA_FIELDS) out[f.key] = f.blank;
  return out as PersonaDraft;
}

export function personaToBody(d: PersonaDraft): PersonaBody {
  const out = {} as Record<string, unknown>;
  for (const f of PERSONA_FIELDS) {
    const v = d[f.key];
    if (f.wire === "omit") continue;
    if (f.wire === "raw") { out[f.key] = v; continue; }
    const trimmed = typeof v === "string" ? v.trim() : v;
    if (f.wire === "trimRequired") { out[f.key] = trimmed ?? ""; continue; }
    if (trimmed) out[f.key] = trimmed; // trimOptional: blanks become undefined
  }
  return out as PersonaBody;
}
