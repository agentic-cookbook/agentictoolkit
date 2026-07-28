#!/usr/bin/env python3
"""Generate the shared AI model catalog from adh's public catalog.

The same model is served by many gateways — ``gpt-oss-120b`` alone appears at
eleven of them — so describing it inside every provider's ``descriptor.json``
would copy one blurb dozens of times and let the copies drift. Instead this tool
emits ONE table of models (``AIPluginKit/model-catalog.json``), keyed by a
canonical id with every gateway's spelling recorded as an alias, and every
provider resolves its models against that one table.

What belongs where:

* **Shared, per model** — description, capabilities. Facts about the model
  itself; identical whoever serves it.
* **Per offering (gateway + model)** — context window, max output, token
  prices. These genuinely differ between gateways (DeepSeek-V4-Pro is 262K at
  one and 1M at another, $0.435/M at one and $1.75/M at another), so they are
  keyed by ``templateId`` and never averaged into a single number that would be
  wrong everywhere.

Run manually; review the ``git diff``; commit the catalog to the toolkit.

    python3 generate_model_catalog.py --dry-run   # print a summary, write nothing
    python3 generate_model_catalog.py             # write the catalog
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import generate_ai_descriptors as descriptors

SCHEMA_VERSION = 1

# packages/apple/AIPlugins/tools -> packages/apple/AgenticToolkit/AIPluginKit.
# The catalog ships as a resource of AIPluginKit, the one framework both the host
# app and every .aiplugin bundle link, so a single copy serves all of them.
CATALOG_PATH = (
    descriptors.AIPLUGINS_DIR.parent / "AgenticToolkit" / "AIPluginKit" / "model-catalog.json"
)

# Quantization/precision suffixes: the same weights served at lower precision, so
# they fold onto the base model. Deliberately NOT stripped: `-turbo`, `-fast`,
# `-latest`, `-thinking` — those name genuinely different models or aliases.
QUANT_SUFFIX_RE = re.compile(r"-(fp8-fast|fp8|fp4|bf16|awq|int8|int4)$")

# Tokens too generic for the specificity tie-break below to learn anything from.
_STOP_TOKENS = {"ai", "chat", "instruct", "it", "latest", "model", "preview", "v1", "v2", "v3"}


def canonical_model_id(name: str) -> str:
    """The shared-table key for a gateway's spelling of a model.

    Gateways prefix the same model with their own namespace and suffix it with a
    precision or pricing tier — ``meta-llama/Llama-3.3-70B-Instruct``,
    ``@cf/meta/llama-3.3-70b-instruct-fp8-fast`` and
    ``accounts/fireworks/models/llama-3.3-70b-instruct`` are one model. Folding
    those to a single id is what lets one description serve every gateway.

    NOTE: `AIModelCatalog.canonicalID` in Swift mirrors these rules for ids the
    catalog has never seen (a live-fetched local model). Change both together.
    """
    ident = name.strip().lower().rsplit("/", 1)[-1]
    if ident.endswith(":free"):  # an OpenRouter price tier, not a different model
        ident = ident[: -len(":free")]
    return QUANT_SUFFIX_RE.sub("", ident)


def _specificity(model_id: str, description: str) -> int:
    """How many of the model id's own words the description uses.

    Gateways disagree about 79 models, and the disagreement is almost always a
    real description versus filler ("Legacy model retained for compatibility with
    older integrations"). A description that names the model it describes is the
    one worth keeping.
    """
    haystack = description.lower()
    tokens = {t for t in re.split(r"[-_.\s/]+", model_id) if len(t) > 2 and t not in _STOP_TOKENS}
    return sum(1 for token in tokens if token in haystack)


def choose_description(model_id: str, candidates: list[str]) -> str | None:
    """Pick one description for a model served by several gateways.

    Most specific wins; then the longer (more informative) one; then
    alphabetically, so a regeneration against an unchanged catalog is a no-op.
    """
    if not candidates:
        return None
    return max(candidates, key=lambda text: (_specificity(model_id, text), len(text), text))


def _clean(text: str | None) -> str | None:
    """Collapse adh's multi-line markdown blurbs into one display line.

    adh truncates the long ones mid-sentence ("…is optimized..."), which reads as
    a rendering bug in the picker, so a truncated blurb is cut back to its last
    complete sentence.
    """
    if not text:
        return None
    collapsed = " ".join(text.split())
    collapsed = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", collapsed)  # markdown links -> their text
    # Trailing #hashtags only — anchored at the end, or the same pattern eats a "#2"
    # or a "#1-ranked" out of the middle of a sentence.
    collapsed = re.sub(r"(?:\s*#[a-z0-9-]+)+(?=\s*(?:\.\.\.|…)?$)", "", collapsed)
    collapsed = collapsed.strip()
    if collapsed.endswith(("...", "…")):
        collapsed = collapsed.rstrip(".… ")
        # Keep whole sentences only — but never trim away everything, so a blurb
        # that is one truncated sentence survives as that sentence.
        if (end := max(collapsed.rfind(". "), collapsed.rfind("! "), collapsed.rfind("? "))) > 0:
            collapsed = collapsed[: end + 1]
    return collapsed or None


def agreed_capabilities(reported: list[list[str]]) -> list[str]:
    """The capabilities a majority of the gateways serving a model report.

    Gateways disagree about 32 models, usually because one of them advertises a
    capability the model doesn't have (eleven serve ``gpt-oss-120b`` and one calls
    it multimodal). A union would inherit every such mistake and an intersection
    would drop a real capability the moment one gateway forgot it, so a strict
    majority wins; a tie drops the capability.
    """
    if not reported:
        return []
    counts: dict[str, int] = {}
    for caps in reported:
        for cap in set(caps):
            counts[cap] = counts.get(cap, 0) + 1
    return sorted(cap for cap, n in counts.items() if n * 2 > len(reported))


def template_ids_for(plugin_dir: str) -> list[str]:
    """The descriptor template ids of a single-vendor plugin (e.g. ClaudeAPI's two).

    Read from the descriptor rather than hardcoded so adding a template there
    (another auth mode, say) automatically gets that vendor's offerings.
    """
    desc = json.loads(descriptors.descriptor_path(plugin_dir).read_text(encoding="utf-8"))
    return [t["id"] for t in desc.get("templates", [])]


def vendor_template_ids(items: list[dict]) -> list[tuple[dict, list[str]]]:
    """Pair each adh vendor with the descriptor template id(s) it drives.

    Vendors adh can't route (no first-party API, or a non-LLM kind) contribute
    nothing, exactly as in the descriptor generator.
    """
    routed = descriptors.route(items)
    pairs: list[tuple[dict, list[str]]] = []
    for kind, plugin_dir in descriptors.SINGLE_VENDOR_KIND.items():
        if routed[kind] is not None:
            pairs.append((routed[kind], template_ids_for(plugin_dir)))
    if routed["openai"] is not None:
        pairs.append((routed["openai"], template_ids_for(descriptors.OPENAI_VENDOR_DIR)))
    for item in routed["openai_compatible"]:
        tid = descriptors.NAME_TO_ID.get(item["name"]) or descriptors.slugify(item["name"])
        pairs.append((item, [tid]))
    return pairs


def build_catalog(items: list[dict], base_url: str = descriptors.DEFAULT_BASE_URL) -> dict:
    """Fold adh's per-vendor model rows into one shared table plus per-gateway offerings."""
    aliases: dict[str, set[str]] = {}
    described: dict[str, list[str]] = {}
    capabilities: dict[str, list[list[str]]] = {}
    offerings: dict[str, dict[str, dict]] = {}

    for item, template_ids in vendor_template_ids(items):
        for model in item.get("models") or []:
            name = model["name"]
            key = canonical_model_id(name)
            aliases.setdefault(key, set()).add(name)
            if text := _clean(model.get("description")):
                described.setdefault(key, []).append(text)
            meta = model.get("metadata") or {}
            if (caps := meta.get("capabilities")) is not None:
                capabilities.setdefault(key, []).append(caps)

            # A local server's limits and prices are the user's machine's, not
            # adh's, so those templates get no offerings (same rule that keeps
            # their model lists empty in the descriptors).
            #
            # A limit of 0 means "this gateway doesn't publish one", not "this model
            # holds no tokens", so it is dropped rather than shipped — the picker
            # would otherwise read out "0 context · 0 max output". A *price* of 0 is
            # kept: free is a real, useful price.
            offering = {
                field: meta[field]
                for field in ("contextWindow", "maxOutput")
                if (meta.get(field) or 0) > 0
            }
            offering.update({
                field: meta[field]
                for field in ("inputCostPerM", "outputCostPerM")
                if meta.get(field) is not None
            })
            if not offering:
                continue
            for tid in template_ids:
                if tid in descriptors.LIVE_MODELS_ONLY_IDS:
                    continue
                offerings.setdefault(tid, {})[name] = offering

    models = []
    for key in sorted(aliases):
        entry: dict = {"id": key, "aliases": sorted(aliases[key])}
        if description := choose_description(key, described.get(key, [])):
            entry["description"] = description
        if caps := agreed_capabilities(capabilities.get(key, [])):
            entry["capabilities"] = caps
        models.append(entry)

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        # The URL the rows actually came from — a catalog generated against a staging
        # adh must not claim production as its source.
        "source": base_url + descriptors.CATALOG_PATH,
        "models": models,
        "offerings": {tid: dict(sorted(v.items())) for tid, v in sorted(offerings.items())},
    }


def summarize(catalog: dict) -> str:
    models = catalog["models"]
    shared = sum(1 for m in models if len(m["aliases"]) > 1)
    described = sum(1 for m in models if m.get("description"))
    rows = sum(len(v) for v in catalog["offerings"].values())
    return (
        f"{len(models)} models ({described} described, {shared} served under more than one name), "
        f"{rows} offerings across {len(catalog['offerings'])} templates"
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Generate the shared AI model catalog from adh.")
    ap.add_argument("--base-url", default=descriptors.DEFAULT_BASE_URL,
                    help=f"adh API base URL (default: {descriptors.DEFAULT_BASE_URL})")
    ap.add_argument("--dry-run", action="store_true", help="print a summary and write nothing")
    args = ap.parse_args(argv)

    try:
        catalog = build_catalog(descriptors.fetch_catalog(args.base_url), base_url=args.base_url)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(summarize(catalog))
    if args.dry_run:
        return 0

    text = descriptors.canonical_json(catalog)
    json.loads(text)  # validate before writing
    CATALOG_PATH.write_text(text, encoding="utf-8")
    print(f"wrote {CATALOG_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
