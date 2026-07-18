"""Unit tests for the adh provider-catalog descriptor generator.

Runs entirely against a committed fixture of adh's response — no network.
"""
import copy
import json
import pathlib

import generate_ai_descriptors as g

TOOLS = pathlib.Path(__file__).resolve().parent
AIPLUGINS = TOOLS.parent
FIX = json.loads((TOOLS / "fixtures/adh-provider-templates.json").read_text())
ITEMS = FIX["items"]


def _by(kind, name):
    return next(t for t in ITEMS if t["providerKind"] == kind and t["name"] == name)


def _descriptor(plugin_dir):
    return json.loads((AIPLUGINS / plugin_dir / "descriptor.json").read_text())


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
    assert ollama["models"]  # now non-empty from adh -> Model dropdown un-hidden


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


def test_canonical_json_roundtrips():
    desc = _descriptor("OpenAICompatible")
    assert json.loads(g.canonical_json(desc)) == desc
    assert g.canonical_json(desc).endswith("\n")
