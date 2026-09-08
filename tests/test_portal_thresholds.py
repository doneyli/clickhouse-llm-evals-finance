"""
Certification Portal threshold resolution — unit tests (offline, no network).

The portal shows a "Threshold" for every row, and the two runners record their
gate differently:

  * run_certification.py       -> metadata.threshold       (one scalar bar)
  * run_usecase_certification.py -> metadata.gate_thresholds (one bar per
                                    dimension, all of which must clear)

These tests pin the resolution rules so an agent row can never again fall back
to a hardcoded 85% that the gate never enforced.

They run without Langfuse credentials or any LLM calls.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.advisory_draft import GATE_ADVISORY_DRAFT
from portal.langfuse_client import replay_gate, resolve_run_thresholds


# The metadata run_usecase_certification.py writes for the advisory agent
# (Langfuse round-trips it as JSON, so 1.00 comes back as int 1).
ADVISORY_META = {
    "model": "usecase:advisory-draft",
    "use_case": "advisory-draft",
    "gate_thresholds": {
        "completeness": 0.7,
        "groundedness": 0.8,
        "regulatory_compliance": 1,
        "tool_use_correctness": 1,
    },
}

MODEL_META = {"model": "claude-sonnet-4-6", "threshold": 0.85}


class TestModelRuns:
    def test_scalar_threshold_is_used(self):
        assert resolve_run_thresholds(MODEL_META, "avg_numerical_accuracy") == (
            0.85, None,
        )

    def test_no_gate_dict_for_model_runs(self):
        _, gate = resolve_run_thresholds(MODEL_META)
        assert gate is None

    def test_missing_threshold_is_not_invented(self):
        # A run that recorded no bar must report none — the portal shows "—"
        # rather than a plausible-looking number nothing was judged against.
        assert resolve_run_thresholds({"model": "legacy-ci-run"}) == (None, None)
        assert resolve_run_thresholds(None) == (None, None)


class TestAgentRuns:
    def test_gate_dict_is_returned_whole(self):
        _, gate = resolve_run_thresholds(ADVISORY_META)
        assert gate == {
            "completeness": 0.7,
            "groundedness": 0.8,
            "regulatory_compliance": 1.0,
            "tool_use_correctness": 1.0,
        }

    def test_primary_score_gets_its_own_dimension_bar(self):
        # advisory-draft's primary score is avg_groundedness, whose real bar is
        # 0.80 — not the 0.85 default the portal used to fall back to.
        threshold, gate = resolve_run_thresholds(
            ADVISORY_META, "avg_groundedness"
        )
        assert threshold == 0.80
        assert gate["regulatory_compliance"] == 1.0

    def test_bars_match_the_registered_gate(self):
        # What the portal displays must be what the gate enforced.
        _, gate = resolve_run_thresholds(ADVISORY_META)
        assert gate == {k: float(v) for k, v in GATE_ADVISORY_DRAFT.items()}

    def test_dimension_outside_the_gate_has_no_bar(self):
        threshold, gate = resolve_run_thresholds(
            ADVISORY_META, "avg_exact_match"
        )
        assert threshold is None
        assert gate is not None

    def test_no_primary_score_yields_no_scalar(self):
        # The breakdown page shows every dimension, so it asks for no primary.
        assert resolve_run_thresholds(ADVISORY_META)[0] is None

    def test_empty_or_malformed_gate_falls_back_to_scalar(self):
        assert resolve_run_thresholds({"gate_thresholds": {}, "threshold": 0.9},
                                      "avg_groundedness") == (0.9, None)
        assert resolve_run_thresholds({"gate_thresholds": "0.8"}) == (None, None)
        assert resolve_run_thresholds(
            {"gate_thresholds": {"groundedness": None}}
        ) == (None, None)


class TestReplayGate:
    """Fallback verdict for agent runs with no persisted certification_result."""

    GATE = {"groundedness": 0.8, "regulatory_compliance": 1.0}

    def test_passes_when_every_dimension_clears(self):
        aggs = {"groundedness": {"mean": 0.88},
                "regulatory_compliance": {"mean": 1.0}}
        assert replay_gate(self.GATE, aggs) == "PASSED"

    def test_hard_dimension_below_its_own_bar_fails(self):
        # 88% groundedness clears 0.80 but one compliance violation fails the
        # run — the case a single 85% bar reported backwards.
        aggs = {"groundedness": {"mean": 0.88},
                "regulatory_compliance": {"mean": 0.9}}
        assert replay_gate(self.GATE, aggs) == "FAILED"

    def test_score_between_the_old_default_and_the_real_bar_passes(self):
        aggs = {"groundedness": {"mean": 0.82},
                "regulatory_compliance": {"mean": 1.0}}
        assert replay_gate(self.GATE, aggs) == "PASSED"

    def test_missing_dimension_cannot_certify(self):
        assert replay_gate(self.GATE, {"groundedness": {"mean": 0.9}}) == "FAILED"
