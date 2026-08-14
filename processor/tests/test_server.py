from paperclean_processor.server import estimate_max_charge_cents, page_events, safe_filename


def test_estimate_includes_job_fee_and_conservative_page_ceiling() -> None:
    assert estimate_max_charge_cents(1) == 630
    assert estimate_max_charge_cents(100) == 60_030


def test_page_events_never_allocates_cost_to_fallback() -> None:
    events = page_events(
        {
            "cost_usd": 1.0,
            "pages": [
                {"page": 1, "status": "model_generated_clean", "attempts": [{}]},
                {"page": 2, "status": "original_fallback", "attempts": [{}, {}]},
            ],
        }
    )
    assert events[0]["providerCostMicros"] == 500_000
    assert events[1]["providerCostMicros"] == 0


def test_safe_filename_strips_paths() -> None:
    assert safe_filename("..%2F..%2Finvoice.pdf") == "invoice.pdf"
