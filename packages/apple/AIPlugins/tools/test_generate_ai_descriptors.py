"""Unit tests for the adh provider-catalog descriptor generator.

Runs entirely against committed fixtures — no network. Two fixtures are used:
`fixtures/adh-provider-templates.json` (a captured adh response) and
`fixtures/descriptors/*.json` (the *pre-merge* descriptors). The descriptor
inputs are pinned pristine snapshots, NOT the live (already-regenerated) files —
otherwise `…adds_kimi`/`ollama_override` would be tautological, passing even if
the merge did nothing.
"""
import copy
import json
import pathlib

import generate_ai_descriptors as g

TOOLS = pathlib.Path(__file__).resolve().parent
FIX = json.loads((TOOLS / "fixtures/adh-provider-templates.json").read_text(encoding="utf-8"))
ITEMS = FIX["items"]


def _by(kind, name):
    return next(t for t in ITEMS if t["providerKind"] == kind and t["name"] == name)


def _descriptor(plugin_dir):
    """The pristine pre-merge descriptor snapshot (not the live regenerated file)."""
    path = TOOLS / "fixtures/descriptors" / f"{plugin_dir}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _adh_openai_compat():
    return [t for t in ITEMS if t["providerKind"] == "openai" and t["name"] != "OpenAI"]


def test_model_names_flatten():
    groq = _by("openai", "Groq")
    assert g.model_names(groq) == [m["name"] for m in groq["models"]]
    assert all(isinstance(n, str) for n in g.model_names(groq))


def test_route_separates_openai_vendor_from_compatible():
    routed = g.route(ITEMS)
    assert routed["anthropic"]["name"] == "Anthropic"
    assert routed["gemini"]["name"] == "Gemini"
    assert routed["openai"]["name"] == "OpenAI"  # dedicated plugin
    names = {t["name"] for t in routed["openai_compatible"]}
    assert "OpenAI" not in names
    assert {"Groq", "xAI", "Ollama (local)", "Moonshot Kimi"} <= names


def test_vendors_without_a_first_party_api_are_skipped():
    """adh lists some vendors for completeness with `availableVia` and a docs-page
    `baseUrl`; a descriptor entry for one could never connect, so route() drops it."""
    listed_only = {
        "providerKind": "openai", "name": "Thinky", "baseUrl": "https://thinky.ai",
        "models": [],
        "availableVia": {"note": "no public first-party API", "templates": []},
    }
    via_others = dict(listed_only, name="Xiaomi MiMo",
                      availableVia={"note": "served elsewhere", "templates": ["OpenRouter"]})
    assert g.has_no_first_party_api(listed_only)
    assert g.has_no_first_party_api(via_others)
    assert not g.has_no_first_party_api(_by("openai", "Groq"))

    routed = g.route(ITEMS + [listed_only, via_others])
    names = {t["name"] for t in routed["openai_compatible"]}
    assert {"Thinky", "Xiaomi MiMo"}.isdisjoint(names)
    assert "Groq" in names  # everything else still routes


def test_every_adh_vendor_name_maps_to_a_stable_id():
    """Ids are persisted in saved configurations, so each vendor adh serves needs an
    explicit NAME_TO_ID pin — a slugified fallback would move if adh renamed it."""
    unmapped = [t["name"] for t in _adh_openai_compat()
                if not g.has_no_first_party_api(t) and t["name"] not in g.NAME_TO_ID]
    assert unmapped == []


def test_openai_compat_preserves_ids_and_adds_kimi():
    out = g.merge_openai_compatible(_descriptor("OpenAICompatible"), _adh_openai_compat())
    ids = [t["id"] for t in out["templates"]]
    assert {"groq", "mistral", "ollama", "xai", "cerebras", "custom"} <= set(ids)
    assert "kimi" in ids
    assert ids[-1] == "custom"  # catch-all stays last


def test_ollama_override_retained():
    out = g.merge_openai_compatible(_descriptor("OpenAICompatible"), _adh_openai_compat())
    ollama = next(t for t in out["templates"] if t["id"] == "ollama")
    assert ollama["secretRequired"] is False
    assert any(f["key"] == "baseURL" for f in ollama["fields"])


def test_local_providers_never_get_a_static_model_list():
    """A local server only serves what the user pulled or configured, so adh's list
    for one is fiction — it must be dropped, leaving the editor's live fetch."""
    adh = _adh_openai_compat()
    assert g.model_names(_by("openai", "Ollama (local)"))  # adh does claim models
    out = g.merge_openai_compatible(_descriptor("OpenAICompatible"), adh)
    for tid in g.LIVE_MODELS_ONLY_IDS:
        tmpl = next((t for t in out["templates"] if t["id"] == tid), None)
        if tmpl is None:
            continue  # not in this fixture's catalog
        assert tmpl["models"] == []
        assert tmpl["defaultModel"] is None


def test_curated_copy_retained_and_baseurl_refreshed():
    out = g.merge_openai_compatible(_descriptor("OpenAICompatible"), _adh_openai_compat())
    groq = next(t for t in out["templates"] if t["id"] == "groq")
    assert groq["providerDescription"]  # curated blurb kept
    assert groq["defaultValues"]["baseURL"] == _by("openai", "Groq")["baseUrl"]
    assert groq["models"] == g.model_names(_by("openai", "Groq"))


def test_new_kimi_entry_is_minimal_and_well_formed():
    out = g.merge_openai_compatible(_descriptor("OpenAICompatible"), _adh_openai_compat())
    kimi = next(t for t in out["templates"] if t["id"] == "kimi")
    adh = _by("openai", "Moonshot Kimi")
    assert kimi["displayName"] == "Moonshot Kimi"
    assert kimi["defaultValues"]["baseURL"] == adh["baseUrl"]
    assert kimi["models"] == g.model_names(adh)
    assert kimi["defaultModel"] == g.model_names(adh)[0]
    assert kimi["secretRequired"] is True


def test_default_model_recomputed_when_stale():
    desc = {"models": ["old"], "defaultModel": "old", "templates": []}
    g.merge_single_vendor(desc, ["new-a", "new-b"])
    assert desc["defaultModel"] == "new-a"  # "old" gone -> first of new list


def test_default_model_kept_when_still_present():
    desc = {"models": ["keep", "x"], "defaultModel": "keep", "templates": []}
    g.merge_single_vendor(desc, ["keep", "y"])
    assert desc["defaultModel"] == "keep"


def test_single_vendor_refreshes_all_model_lists():
    desc = _descriptor("ClaudeAPI")
    models = g.model_names(_by("anthropic", "Anthropic"))
    out = g.merge_single_vendor(desc, models)
    assert out["models"] == models
    assert len(out["templates"]) >= 2  # anthropic-api + claude-max-token
    for t in out["templates"]:
        assert t["models"] == models


def test_slugify_unknown_vendor():
    assert g.slugify("Moonshot Kimi") == "moonshot-kimi"
    assert g.slugify("Fancy AI, Inc.") == "fancy-ai-inc"


def test_shipped_openai_compatible_templates_are_all_curated():
    """Unlike the rest of the suite this reads the *live* descriptor: a generation run
    inserts new vendors bare, and shipping one leaves the picker with a blank LLM
    column and no blurb. Curate the entry (or drop the vendor) before committing."""
    shipped = json.loads(g.descriptor_path(g.OPENAI_COMPATIBLE_DIR).read_text(encoding="utf-8"))
    bare = [t["id"] for t in shipped["templates"]
            if not (t.get("provider") and t.get("configType") and t.get("providerDescription"))]
    assert bare == []


def test_shipped_default_models_are_offered():
    """A defaultModel the provider no longer lists preselects a model that 404s. The
    generator resets one it drops; this catches a hand-curated default that drifted."""
    for plugin_dir in (*g.SINGLE_VENDOR_KIND.values(), g.OPENAI_VENDOR_DIR, g.OPENAI_COMPATIBLE_DIR):
        shipped = json.loads(g.descriptor_path(plugin_dir).read_text(encoding="utf-8"))
        scopes = [shipped, *shipped.get("templates", [])]
        orphaned = [(plugin_dir, s.get("id"), s["defaultModel"]) for s in scopes
                    if s.get("defaultModel") and s["defaultModel"] not in (s.get("models") or [])]
        assert orphaned == []


def test_canonical_json_roundtrips():
    desc = _descriptor("OpenAICompatible")
    assert json.loads(g.canonical_json(desc)) == desc
    assert g.canonical_json(desc).endswith("\n")
