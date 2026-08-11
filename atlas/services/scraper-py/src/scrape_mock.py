"""
Mock scraper for smoke-testing the pipeline without hitting live sources.

Returns 2 deterministic fake opportunities every time it's called. Useful
for verifying the docker-compose plumbing (scraper container → web app →
Postgres) before wiring real live scrapers.
"""

from __future__ import annotations
from datetime import datetime, timedelta
import hashlib

def scrape_mock(page_limit: int = 1) -> list[dict]:
    now = datetime.utcnow()
    # Deterministic hash so re-runs hit the de-dup path
    salt = now.strftime("%Y-%m-%d")
    return [
        {
            "source": "MANUAL",
            "sourceUrl": "https://example.scraper.mock/tender/001",
            "sourceRef": f"SMOKE-{hashlib.sha256(('mock-1-' + salt).encode()).hexdigest()[:8]}",
            "title": "[SMOKE] Mock tender — Atlas AEC scraper sidecar test",
            "invitor": "CTCP Mock Demo",
            "invitorMst": "0300000001",
            "budgetVnd": "5500000000",
            "province": "TP. HCM",
            "closingAt": (now + timedelta(days=21)).isoformat(),
            "bidMethod": "Đấu thầu rộng rãi",
            "category": "Xây lắp",
        },
    ]
