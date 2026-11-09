import re
import html
from typing import Optional


def clean_cricket_text(raw: Optional[str]) -> str:
    """
    Sanitizes live cricket commentary and scoreboard text.
    Strips mojibake artifacts, pseudo-HTML tags, and decodes HTML entities.
    """
    if not raw or not isinstance(raw, str):
        return ""
    
    s = raw

    # 1. Fix UTF-8 / Windows-1252 mojibake artifacts
    replacements = {
        "â€¢": "•",
        "â€“": "–",
        "â€”": "—",
        "â€™": "'",
        "â€˜": "'",
        "â€œ": '"',
        "â€ ": '"',
        "â€": '"',
        "Ã©": "é",
        "Ã¡": "á",
        "Â·": "·",
        "Â": "",
    }
    for old, new in replacements.items():
        s = s.replace(old, new)

    # 2. Strip pseudo-HTML tags like &l;b&g;, &l;/b&g;, &l;span&g;
    s = re.sub(r"&l;[\s\S]*?&g;", "", s, flags=re.IGNORECASE)

    # 3. Strip standard HTML tags
    s = re.sub(r"</?[a-z0-9_-]+[^>]*>", "", s, flags=re.IGNORECASE)

    # 4. Decode common HTML and cricket shorthand entities
    custom_entities = {
        "&s;": "'",
        "&bull;": "•",
        "&mdash;": "—",
        "&ndash;": "–",
    }
    for old, new in custom_entities.items():
        s = s.replace(old, new)
    
    # Standard HTML unescape (&quot;, &#39;, &amp;, etc.)
    s = html.unescape(s)

    # 5. Clean lingering &l; or &g; or dangling entity remnants
    s = re.sub(r"&[lg];", "", s, flags=re.IGNORECASE)
    s = re.sub(r"&[a-z0-9#]+;", "", s, flags=re.IGNORECASE)

    return s.strip()
