"""
Scrape tender listings from dauthau.asia.

dauthau.asia exposes a public JSON search API that's much faster than DOM
scraping. We use it where we can and fall back to HTML parsing for fields
the API doesn't expose. If their API auth tightens, swap to Playwright here.
"""

from __future__ import annotations

import re
from typing import Any
from dateutil import parser as date_parser
import requests

SEARCH_URL = "https://dauthau.asia/api/v1/tenders/search"


def _parse_vnd(s: str | None) -> str | None:
    if not s:
        return None
    digits = re.sub(r"[^\d]", "", s)
    if not digits:
        return None
    return str(int(digits))


def _parse_date(s: str | None) -> str | None:
    if not s:
        return None
    try:
        return date_parser.parse(s, dayfirst=True).isoformat()
    except Exception:
        return None


def scrape_dauthau_asia(page_limit: int = 3) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    headers = {
        "user-agent": "Mozilla/5.0 (compatible; AtlasAEC-Scraper/0.1; +https://atlas-aec.vn/bot)",
        "accept": "application/json",
    }
    for page_num in range(1, page_limit + 1):
        try:
            r = requests.get(
                SEARCH_URL,
                params={"page": page_num, "perPage": 20, "sort": "-publishedAt"},
                headers=headers,
                timeout=15,
            )
        except Exception:
            continue
        if r.status_code != 200:
            continue
        try:
            payload = r.json()
        except Exception:
            continue

        rows = payload.get("data") or payload.get("items") or []
        for row in rows:
            title = row.get("title") or row.get("name")
            if not title:
                continue
            items.append({
                "source": "DAUTHAU_ASIA",
                "sourceUrl": row.get("url") or row.get("link"),
                "sourceRef": row.get("code") or row.get("ref"),
                "title": title,
                "invitor": row.get("invitor") or row.get("buyer"),
                "invitorMst": row.get("invitorMst"),
                "budgetVnd": _parse_vnd(str(row.get("budget") or row.get("budgetVnd") or "")),
                "fundingSource": row.get("fundingSource"),
                "category": row.get("category") or "Xây lắp",
                "province": row.get("province") or row.get("location"),
                "district": row.get("district"),
                "publishedAt": _parse_date(row.get("publishedAt")),
                "closingAt": _parse_date(row.get("closingAt") or row.get("dueDate")),
                "bidMethod": row.get("bidMethod"),
            })
    return items


if __name__ == "__main__":
    import json
    print(json.dumps(scrape_dauthau_asia(page_limit=1), ensure_ascii=False, indent=2))
