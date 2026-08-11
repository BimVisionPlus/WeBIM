"""
Atlas AEC — tender scraper sidecar (Python).

Runs the configured scrapers on a fixed interval and POSTs every fresh
TenderOpportunity to the Atlas web app's /api/winwork/tenders endpoint
(de-duped server-side by content hash).

Why Python (vs. Node):
  - Playwright in Python is a tighter footprint than puppeteer-extra in Node
  - DOM parsing with BeautifulSoup is fast + boring
  - Easier to add captcha / proxy plumbing later

Wire it in docker-compose.prod.yml as a sibling service to web + worker.
"""

from __future__ import annotations

import os
import sys
import time
import json
import traceback
from datetime import datetime, timedelta
from typing import Any

import requests

from scrape_muasamcong import scrape_muasamcong
from scrape_dauthau_asia import scrape_dauthau_asia

BASE = os.environ.get("ATLAS_BASE_URL", "http://localhost:3000").rstrip("/")
SECRET = os.environ.get("WINWORK_SCRAPE_SECRET", "")
INTERVAL_H = float(os.environ.get("SCRAPE_INTERVAL_HOURS", "24"))
PAGE_LIMIT = int(os.environ.get("SCRAPE_PAGE_LIMIT", "3"))


def log(level: str, msg: str, **kw: Any) -> None:
    payload = {"ts": datetime.utcnow().isoformat() + "Z", "level": level, "msg": msg, **kw}
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def post_tender(item: dict[str, Any]) -> dict[str, Any] | None:
    """POST one normalized opportunity to the Atlas web app."""
    headers = {"content-type": "application/json"}
    if SECRET:
        headers["x-scrape-secret"] = SECRET
    try:
        r = requests.post(f"{BASE}/api/winwork/tenders", json=item, headers=headers, timeout=20)
    except Exception as e:
        log("error", "post_failed", err=str(e), title=item.get("title"))
        return None
    if r.status_code >= 400:
        log("error", "post_http_error", status=r.status_code, body=r.text[:300], title=item.get("title"))
        return None
    return r.json()


def run_once() -> dict[str, int]:
    stats = {"scraped": 0, "posted": 0, "duplicate": 0, "errors": 0}
    sources = [
        ("MUASAMCONG", lambda: scrape_muasamcong(page_limit=PAGE_LIMIT)),
        ("DAUTHAU_ASIA", lambda: scrape_dauthau_asia(page_limit=PAGE_LIMIT)),
    ]
    for name, fn in sources:
        log("info", "source_start", source=name)
        try:
            items = fn()
        except Exception as e:
            log("error", "source_failed", source=name, err=str(e), tb=traceback.format_exc())
            stats["errors"] += 1
            continue
        log("info", "source_fetched", source=name, count=len(items))
        stats["scraped"] += len(items)

        for it in items:
            res = post_tender(it)
            if res is None:
                stats["errors"] += 1
            elif res.get("duplicate"):
                stats["duplicate"] += 1
            else:
                stats["posted"] += 1

    log("info", "run_complete", **stats)
    return stats


def main() -> int:
    log("info", "scraper_boot", base=BASE, interval_h=INTERVAL_H, has_secret=bool(SECRET))
    if not SECRET:
        log("warn", "no_scrape_secret_set")
    # Best-effort run on boot, then loop on interval.
    try:
        run_once()
    except Exception:
        log("error", "boot_run_failed", tb=traceback.format_exc())

    sleep_s = INTERVAL_H * 3600
    while True:
        time.sleep(sleep_s)
        try:
            run_once()
        except Exception:
            log("error", "scheduled_run_failed", tb=traceback.format_exc())


if __name__ == "__main__":
    sys.exit(main() or 0)
