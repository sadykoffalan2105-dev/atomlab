from __future__ import annotations

import re

_TOPIC_PATTERNS = (
    re.compile(r"§\s*(\d+)"),
    re.compile(r"параграф\s*(\d+)"),
    re.compile(r"(?:^|\s)(\d+)\s*[-–]?\s*(?:я\s+)?тем[аеуыи](?:\s|$|[,.])"),
    re.compile(r"(?:об|про|о)\s+(\d+)\s*[-–]?\s*(?:я\s+)?тем[аеуыи]"),
    re.compile(r"тем[аеуыи]\s*(?:№\s*)?(\d+)"),
    re.compile(r"topic\s*(\d+)", re.I),
)


def parse_requested_topic_number(query: str) -> int | None:
    q = re.sub(r"\s+", " ", query.lower()).strip()
    for pat in _TOPIC_PATTERNS:
        m = pat.search(q)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 99:
                return n
    return None
