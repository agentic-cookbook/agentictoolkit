#!/usr/bin/env python3
"""Generate AIPlugins provider descriptors from adh's public catalog.

Fetches ``GET /persona/provider-templates`` from agenticdeveloperhub and merges
``{baseUrl, models}`` into the four toolkit ``.aiplugin`` descriptors. adh is the
source of truth for which providers exist, their base URLs, and their model
lists; template ids, curated copy, and the Ollama keyless/baseURL override are
preserved. Local execution (the compiled executors) is unchanged.

Run manually; review the ``git diff``; commit the descriptors to the toolkit.

    python3 generate_ai_descriptors.py --dry-run          # inspect the diff
    python3 generate_ai_descriptors.py                    # write the descriptors
    python3 generate_ai_descriptors.py --normalize-only   # re-emit canonical format
    python3 generate_ai_descriptors.py --base-url http://localhost:3000
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_BASE_URL = "https://api.agenticdeveloperhub.com"
CATALOG_PATH = "/persona/provider-templates?pageSize=100"

# adh vendor name -> OpenAICompatible descriptor template id. Stable ids matter:
# saved AIProviderConfigurations reference templateId, so a rename would orphan a
# user's configured provider. adh's "OpenAI" is deliberately absent — it routes
# to the dedicated OpenAI plugin, not to an OpenAICompatible entry.
NAME_TO_ID = {
    "Cerebras": "cerebras",
    "DeepSeek": "deepseek",
    "Fireworks": "fireworks",
    "Groq": "groq",
    "Mistral": "mistral",
    "Moonshot Kimi": "kimi",
    "Ollama (local)": "ollama",
    "OpenRouter": "openrouter",
    "Together": "together",
    "xAI": "xai",
}

# providerKind -> single-vendor descriptor dir (exactly one provider per file).
SINGLE_VENDOR_KIND = {
    "anthropic": "ClaudeAPI",
    "gemini": "Google",
}
# The dedicated OpenAI plugin owns the "OpenAI" openai-kind vendor.
OPENAI_VENDOR_NAME = "OpenAI"
OPENAI_VENDOR_DIR = "OpenAI"
OPENAI_COMPATIBLE_DIR = "OpenAICompatible"

# A response missing any of these has almost certainly gone wrong; refuse to
# write rather than wipe a provider family from the descriptors.
REQUIRED_KINDS = {"anthropic", "gemini", "openai"}

# tools/ -> parent is the AIPlugins dir holding the descriptor bundles.
AIPLUGINS_DIR = Path(__file__).resolve().parent.parent


def descriptor_path(plugin_dir: str) -> Path:
    return AIPLUGINS_DIR / plugin_dir / "descriptor.json"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def fetch_catalog(base_url: str) -> list[dict]:
    """GET the provider-templates catalog and return the ``items`` list.

    Raises ``RuntimeError`` on HTTP failure, an empty catalog, or a catalog
    missing an expected providerKind.
    """
    url = base_url.rstrip("/") + CATALOG_PATH
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            status = getattr(resp, "status", resp.getcode())
            if status != 200:
                raise RuntimeError(f"GET {url} -> HTTP {status}")
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(f"GET {url} failed: {exc}") from exc

    items = payload.get("items")
    if not items:
        raise RuntimeError(f"GET {url} returned an empty catalog; refusing to write")
    kinds = {t.get("providerKind") for t in items}
    missing = REQUIRED_KINDS - kinds
    if missing:
        raise RuntimeError(
            f"catalog missing expected providerKind(s): {sorted(missing)}; refusing to write"
        )
    return items


def model_names(adh_template: dict) -> list[str]:
    """Flatten adh ``models: [{id, name}]`` to the ``[name]`` the descriptor wants."""
    return [m["name"] for m in adh_template.get("models", [])]


def _reset_default(obj: dict, models: list[str]) -> None:
    """Keep an existing defaultModel if it survives the new list; else first / None."""
    if obj.get("defaultModel") not in models:
        obj["defaultModel"] = models[0] if models else None


def merge_single_vendor(descriptor: dict, models: list[str]) -> dict:
    """Replace every model list in a single-vendor descriptor with ``models``.

    Touches the top-level ``models`` and each template's ``models`` (e.g. both the
    API-key and subscription-token Claude templates); preserves everything else.
    Rewrites a ``defaultModel`` only when the old one vanished from the new list.
    """
    if "models" in descriptor:
        descriptor["models"] = list(models)
        _reset_default(descriptor, models)
    for tmpl in descriptor.get("templates", []):
        if "models" in tmpl:
            tmpl["models"] = list(models)
            _reset_default(tmpl, models)
    return descriptor


def merge_openai_compatible(descriptor: dict, adh_openai: list[dict]) -> dict:
    """Merge adh openai-kind vendors into the OpenAICompatible templates by id.

    Matched entries get ``baseURL`` + ``models`` refreshed and keep their curated
    copy (blurbs, columns, fields, secretRequired); unmatched ``NAME_TO_ID``
    vendors are inserted as minimal entries; local-only templates (e.g. the
    ``custom`` catch-all) are left untouched.
    """
    templates = descriptor.setdefault("templates", [])
    by_id = {t["id"]: t for t in templates}
    # New vendors go before a trailing catch-all "custom" so it stays last.
    insert_at = next(
        (i for i, t in enumerate(templates) if t.get("id") == "custom"), len(templates)
    )

    for item in adh_openai:
        name = item["name"]
        tid = NAME_TO_ID.get(name)
        if tid is None:
            tid = slugify(name)
            print(
                f"warning: adh vendor {name!r} has no NAME_TO_ID entry; "
                f"using id {tid!r} with no curated copy — add a mapping + copy",
                file=sys.stderr,
            )
        models = model_names(item)
        base_url = item["baseUrl"]
        existing = by_id.get(tid)
        if existing is not None:
            existing.setdefault("defaultValues", {})["baseURL"] = base_url
            existing["models"] = models
            _reset_default(existing, models)
        else:
            new_tmpl = {
                "id": tid,
                "displayName": name,
                "defaultValues": {"baseURL": base_url},
                "models": models,
                "defaultModel": models[0] if models else None,
                "secretRequired": True,
            }
            templates.insert(insert_at, new_tmpl)
            insert_at += 1
            by_id[tid] = new_tmpl
    return descriptor


def route(items: list[dict]) -> dict:
    """Group adh templates by their descriptor target."""
    result: dict = {"anthropic": None, "gemini": None, "openai": None, "openai_compatible": []}
    for t in items:
        kind, name = t.get("providerKind"), t.get("name")
        if kind == "anthropic":
            result["anthropic"] = t
        elif kind == "gemini":
            result["gemini"] = t
        elif kind == "openai" and name == OPENAI_VENDOR_NAME:
            result["openai"] = t
        elif kind == "openai":
            result["openai_compatible"].append(t)
        else:
            print(
                f"warning: unroutable adh template kind={kind!r} name={name!r}; skipping",
                file=sys.stderr,
            )
    return result


def canonical_json(descriptor: dict) -> str:
    return json.dumps(descriptor, indent=2, ensure_ascii=False) + "\n"


def build_updates(items: list[dict]) -> dict[Path, str]:
    """Compute ``{descriptor_path: new_json}`` for every descriptor adh drives."""
    routed = route(items)
    updates: dict[Path, str] = {}

    for kind, plugin_dir in SINGLE_VENDOR_KIND.items():
        adh_t = routed[kind]
        if adh_t is None:
            continue
        path = descriptor_path(plugin_dir)
        desc = json.loads(path.read_text())
        merge_single_vendor(desc, model_names(adh_t))
        updates[path] = canonical_json(desc)

    if routed["openai"] is not None:
        path = descriptor_path(OPENAI_VENDOR_DIR)
        desc = json.loads(path.read_text())
        merge_single_vendor(desc, model_names(routed["openai"]))
        updates[path] = canonical_json(desc)

    path = descriptor_path(OPENAI_COMPATIBLE_DIR)
    desc = json.loads(path.read_text())
    merge_openai_compatible(desc, routed["openai_compatible"])
    updates[path] = canonical_json(desc)

    return updates


def normalize_updates() -> dict[Path, str]:
    """Re-emit each descriptor in canonical format with no content change."""
    dirs = (*SINGLE_VENDOR_KIND.values(), OPENAI_VENDOR_DIR, OPENAI_COMPATIBLE_DIR)
    return {descriptor_path(d): canonical_json(json.loads(descriptor_path(d).read_text())) for d in dirs}


def apply_or_diff(updates: dict[Path, str], dry_run: bool) -> None:
    for path, new_text in updates.items():
        old_text = path.read_text() if path.exists() else ""
        if old_text == new_text:
            continue
        if dry_run:
            diff = difflib.unified_diff(
                old_text.splitlines(keepends=True),
                new_text.splitlines(keepends=True),
                fromfile=str(path),
                tofile=str(path) + " (generated)",
            )
            sys.stdout.writelines(diff)
        else:
            json.loads(new_text)  # validate before writing
            path.write_text(new_text)
            print(f"wrote {path}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Generate AIPlugins descriptors from adh's catalog.")
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL, help=f"adh API base URL (default: {DEFAULT_BASE_URL})")
    ap.add_argument("--dry-run", action="store_true", help="print the unified diff and write nothing")
    ap.add_argument("--normalize-only", action="store_true", help="re-emit descriptors in canonical format without fetching adh")
    args = ap.parse_args(argv)

    try:
        updates = normalize_updates() if args.normalize_only else build_updates(fetch_catalog(args.base_url))
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    apply_or_diff(updates, args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
