"""
Scrape Thông báo mời thầu (TBMT) listings from muasamcong.mpi.gov.vn.

Surface URL: https://muasamcong.mpi.gov.vn/web/guest/thong-bao-moi-thau
The site is JS-rendered + occasionally captcha-protected, so we use Playwright
in headless Chromium rather than raw requests.

We harvest the LIST page (paginated, default 20 per page) and extract just
enough for the Atlas TenderOpportunity model. Full TBMT detail is hydrated
later by a worker that follows `sourceUrl` per item.

Returns: list[ScrapedOpportunity-shaped dicts] matching the API contract:

    {
      "source": "MUASAMCONG",
      "sourceUrl": "...",
      "sourceRef": "TBMT-2026-XXXX",
      "title": "...",
      "invitor": "...",
      "budgetVnd": "<string-encoded-int>" | None,
      "province": "...",
      "publishedAt": "<iso>" | None,
      "closingAt": "<iso>" | None,
      "bidMethod": "...",
      "category": "...",
    }
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from playwright.sync_api import sync_playwright
from dateutil import parser as date_parser

LIST_URL = "https://muasamcong.mpi.gov.vn/web/guest/thong-bao-moi-thau"


def _parse_vnd(s: str | None) -> str | None:
    """Take a VND-formatted string ('420.000.000.000 đ' or '420.000.000.000') → string-encoded int."""
    if not s:
        return None
    digits = re.sub(r"[^\d]", "", s)
    if not digits:
        return None
    try:
        return str(int(digits))
    except ValueError:
        return None


def _parse_date(s: str | None) -> str | None:
    if not s:
        return None
    s = s.strip()
    try:
        # Common formats: 12/06/2026, 12/06/2026 09:00
        dt = date_parser.parse(s, dayfirst=True)
        return dt.isoformat()
    except Exception:
        return None


def scrape_muasamcong(page_limit: int = 3) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (compatible; AtlasAEC-Scraper/0.1; +https://atlas-aec.vn/bot)",
            viewport={"width": 1280, "height": 1024},
            locale="vi-VN",
        )
        page = ctx.new_page()

        for page_num in range(1, page_limit + 1):
            url = LIST_URL if page_num == 1 else f"{LIST_URL}?currentPage={page_num}"
            try:
                page.goto(url, wait_until="networkidle", timeout=30_000)
            except Exception:
                # If the list page never settles, keep going — partial is better than none
                pass

            # The list renders into a table.tbct-results > tbody > tr (defensive: fall back to any table)
            rows = page.query_selector_all("table.tbct-results tbody tr")
            if not rows:
                rows = page.query_selector_all("table tbody tr")

            for row in rows:
                cells = [c.inner_text().strip() for c in row.query_selector_all("td")]
                if len(cells) < 4:
                    continue

                # The exact column order changes occasionally — match by content heuristics
                ref = next((c for c in cells if re.match(r"^TBMT\b|^IB\b", c)), None)
                title_anchor = row.query_selector("a")
                title = (title_anchor.inner_text().strip() if title_anchor else cells[1] if len(cells) > 1 else None)
                href = title_anchor.get_attribute("href") if title_anchor else None
                full_url = href if (href or "").startswith("http") else (f"https://muasamcong.mpi.gov.vn{href}" if href else None)

                invitor = next((c for c in cells if "CTCP" in c or "TNHH" in c or "UBND" in c or "Bộ" in c), None)
                budget = _parse_vnd(next((c for c in cells if "đ" in c or re.search(r"\d\.\d{3}\.\d{3}", c)), None))
                province = next((c for c in cells if any(p in c for p in ("Hà Nội", "TP. HCM", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ", "Bình Phước", "Quảng Ngãi", "Hưng Yên", "Sơn La"))), None)
                closing = _parse_date(next((c for c in cells if re.match(r"\d{2}/\d{2}/\d{4}", c)), None))

                if not title:
                    continue

                items.append({
                    "source": "MUASAMCONG",
                    "sourceUrl": full_url,
                    "sourceRef": ref,
                    "title": title,
                    "invitor": invitor,
                    "budgetVnd": budget,
                    "province": province,
                    "closingAt": closing,
                    # Best-effort defaults — the worker can hydrate from the detail page later
                    "bidMethod": "Đấu thầu rộng rãi",
                    "category": "Xây lắp",
                })

        browser.close()
    return items


if __name__ == "__main__":
    # Local smoke-test:  python services/scraper-py/src/scrape_muasamcong.py
    import json
    print(json.dumps(scrape_muasamcong(page_limit=1), ensure_ascii=False, indent=2))
