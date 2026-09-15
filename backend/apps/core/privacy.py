"""Best-effort redaction applied to text before it is sent to an external
(non-org) provider such as an embeddings or LLM API.

This is a coarse heuristic, not a compliance control. It catches common,
easily-pattern-matched shapes (emails, phone numbers, SSN/card-like digit
runs, common secret-token shapes) and replaces them with a labeled
placeholder. It will miss names, addresses, non-US phone formats, and any
secret that doesn't match these shapes. Treat anything sent through this
as "reduced risk," never as "PII-free" -- do not use this as the sole
control for a compliance requirement.
"""
import re

_PATTERNS = [
    ('EMAIL', re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')),
    ('SSN', re.compile(r'\b\d{3}[ -]?\d{2}[ -]?\d{4}\b')),
    ('CARD', re.compile(r'\b(?:\d[ -]?){12,15}\d\b')),
    ('PHONE', re.compile(r'\b(?:\+?\d{1,2}[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b')),
    ('SECRET_TOKEN', re.compile(r'\b(?:sk-[A-Za-z0-9]{10,}|Bearer\s+[A-Za-z0-9._-]{10,}|[A-Za-z0-9_-]*(?:api[_-]?key|secret|password|token)[A-Za-z0-9_-]*\s*[:=]\s*\S+)\b', re.IGNORECASE)),
]

def redact_for_external_call(text):
    """Return (redacted_text, redaction_counts). Never raises on bad input."""
    s = '' if text is None else str(text)
    counts = {}
    for label, pattern in _PATTERNS:
        s, n = pattern.subn(f'[REDACTED_{label}]', s)
        if n:
            counts[label] = n
    return s, counts
