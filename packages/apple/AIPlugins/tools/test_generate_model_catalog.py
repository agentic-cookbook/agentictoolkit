"""Unit tests for the shared model-catalog generator.

Runs entirely offline. The adh rows are built inline rather than read from
`fixtures/adh-provider-templates.json`, because that fixture was captured before
adh carried model descriptions or metadata — and descriptions/metadata are
exactly what this generator folds. The descriptor files ARE read live (for their
template ids), same as the generator does.
"""
import generate_model_catalog as g


def _model(name, description=None, **metadata):
    row = {"id": name, "name": name}
    if description is not None:
        row["description"] = description
    if metadata:
        row["metadata"] = metadata
    return row


def _vendor(name, models, kind="openai"):
    return {"providerKind": kind, "name": name, "baseUrl": "https://example.test/v1",
            "models": models}


# --- canonicalization ------------------------------------------------------


def test_canonical_id_strips_gateway_namespaces():
    """The same weights under three gateways' prefixes are one model."""
    for name in ("meta-llama/Llama-3.3-70B-Instruct",
                 "accounts/fireworks/models/llama-3.3-70b-instruct",
                 "@cf/meta/llama-3.3-70b-instruct"):
        assert g.canonical_model_id(name) == "llama-3.3-70b-instruct"


def test_canonical_id_strips_quantization_and_price_tiers():
    assert g.canonical_model_id("@cf/meta/llama-3.3-70b-instruct-fp8-fast") == \
        "llama-3.3-70b-instruct"
    assert g.canonical_model_id("Qwen/Qwen3-32B-AWQ") == "qwen3-32b"
    assert g.canonical_model_id("deepseek/deepseek-r1:free") == "deepseek-r1"


def test_canonical_id_keeps_suffixes_that_name_a_different_model():
    """`-turbo`/`-latest`/`:thinking` are other models, not other precisions."""
    for name in ("gpt-4-turbo", "grok-2-latest", "qwen3-max-fast", "claude-sonnet-4:thinking"):
        assert g.canonical_model_id(name) == name


# --- description cleanup ---------------------------------------------------


def test_clean_collapses_markdown_into_one_line():
    text = g._clean("Fast   model.\nSee [the docs](https://x.test/docs). #opensource")
    assert text == "Fast model. See the docs."


def test_clean_trims_a_truncated_blurb_back_to_a_whole_sentence():
    """adh truncates long blurbs mid-sentence; the dangling clause reads as a bug."""
    assert g._clean("A reasoning model. It is optimized for...") == "A reasoning model."


def test_clean_keeps_a_blurb_that_is_only_one_truncated_sentence():
    assert g._clean("An open-weight model optimized for...") == "An open-weight model optimized for"


# --- picking one description among gateways --------------------------------


def test_description_naming_the_model_beats_a_longer_generic_one():
    specific = "Llama 3.3 70B is Meta's instruction-tuned model."
    generic = "Legacy model retained for compatibility with older integrations, " \
              "kept available for existing deployments that have not yet migrated."
    assert g.choose_description("llama-3.3-70b-instruct", [generic, specific]) == specific
    # Order must not matter — a regeneration has to be a no-op.
    assert g.choose_description("llama-3.3-70b-instruct", [specific, generic]) == specific


def test_description_is_none_without_candidates():
    assert g.choose_description("m", []) is None


# --- capabilities ----------------------------------------------------------


def test_capabilities_need_a_strict_majority():
    """One gateway calling a text model multimodal must not make it multimodal."""
    reported = [["tools"], ["tools"], ["tools", "vision"]]
    assert g.agreed_capabilities(reported) == ["tools"]


def test_capabilities_tie_drops_the_claim():
    assert g.agreed_capabilities([["vision"], ["tools"]]) == []
    assert g.agreed_capabilities([]) == []


# --- the catalog itself ----------------------------------------------------


def _catalog_of(*vendors):
    return g.build_catalog(list(vendors))


def test_one_description_serves_every_gateway_that_hosts_the_model():
    catalog = _catalog_of(
        _vendor("Groq", [_model("openai/gpt-oss-120b", "An open-weight MoE model.")]),
        _vendor("Fireworks", [_model("accounts/fireworks/models/gpt-oss-120b")]),
        _vendor("Cloudflare Workers AI", [_model("@cf/openai/gpt-oss-120b-fp8")]),
    )
    entry = next(m for m in catalog["models"] if m["id"] == "gpt-oss-120b")
    assert entry["description"] == "An open-weight MoE model."
    assert entry["aliases"] == ["@cf/openai/gpt-oss-120b-fp8",
                                "accounts/fireworks/models/gpt-oss-120b",
                                "openai/gpt-oss-120b"]


def test_offerings_stay_per_gateway_and_keep_that_gateway_s_spelling():
    """Context windows and prices differ by who serves the model, so they are
    never merged into the shared entry."""
    catalog = _catalog_of(
        _vendor("Groq", [_model("openai/gpt-oss-120b", contextWindow=131072,
                                inputCostPerM=0.15, outputCostPerM=0.6)]),
        _vendor("Fireworks", [_model("accounts/fireworks/models/gpt-oss-120b",
                                     contextWindow=1000000, inputCostPerM=1.75)]),
    )
    assert catalog["offerings"]["groq"] == {
        "openai/gpt-oss-120b": {"contextWindow": 131072,
                                "inputCostPerM": 0.15, "outputCostPerM": 0.6}}
    assert catalog["offerings"]["fireworks"] == {
        "accounts/fireworks/models/gpt-oss-120b": {"contextWindow": 1000000,
                                                   "inputCostPerM": 1.75}}
    entry = next(m for m in catalog["models"] if m["id"] == "gpt-oss-120b")
    assert "contextWindow" not in entry and "inputCostPerM" not in entry


def test_a_model_with_no_metadata_produces_no_offering():
    catalog = _catalog_of(_vendor("Groq", [_model("llama-3.1-8b-instant", "Fast.")]))
    assert catalog["offerings"] == {}


def test_local_only_providers_get_no_offerings():
    """A local server's limits and prices are the user's machine's, not adh's —
    the same rule that keeps `ollama`'s model list empty in the descriptors."""
    catalog = _catalog_of(
        _vendor("Ollama (local)", [_model("llama3.2", "Small.", contextWindow=131072)]))
    assert "ollama" not in catalog["offerings"]
    # The model itself is still described — the blurb is the model's, not the host's.
    assert next(m for m in catalog["models"] if m["id"] == "llama3.2")["description"] == "Small."


def test_a_single_vendor_plugin_feeds_every_template_it_declares():
    """ClaudeAPI ships two templates (API key and Max-token auth) for one vendor;
    both serve the same models, so both get the offerings."""
    catalog = _catalog_of(
        {"providerKind": "anthropic", "name": "Anthropic", "baseUrl": "https://api.anthropic.com",
         "models": [_model("claude-sonnet-4-6", "Balanced.", contextWindow=200000)]})
    assert set(catalog["offerings"]) == {"anthropic-api", "claude-max-token"}
    for tid in catalog["offerings"]:
        assert catalog["offerings"][tid]["claude-sonnet-4-6"]["contextWindow"] == 200000


def test_catalog_carries_its_schema_version_and_provenance():
    catalog = _catalog_of(_vendor("Groq", [_model("m", "A model.")]))
    assert catalog["schemaVersion"] == g.SCHEMA_VERSION
    assert catalog["generatedAt"].endswith("Z")
    assert catalog["source"].startswith("https://")


def test_models_and_offerings_are_sorted_for_a_stable_diff():
    catalog = _catalog_of(
        _vendor("Groq", [_model("zeta", contextWindow=1), _model("alpha", contextWindow=2)]))
    assert [m["id"] for m in catalog["models"]] == ["alpha", "zeta"]
    assert list(catalog["offerings"]["groq"]) == ["alpha", "zeta"]
