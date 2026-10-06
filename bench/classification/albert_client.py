"""Albert API (Gemma 4 31B) client — unary yes/no questions with logprobs.

The probability is read from the first generated token's top_logprobs:
p = P(Oui-variants) / (P(Oui-variants) + P(Non-variants)).
Client-side throttle keeps us under the 100 requests/min quota.
"""

import json
import math
import os
import threading
import time
import urllib.error
import urllib.request

from common import load_env

BASE_URL = "https://albert.api.etalab.gouv.fr/v1/chat/completions"
MODEL = "gemma-4-31b-it"
MAX_RPM = 92  # under the 100 RPM quota, with margin

_throttle_lock = threading.Lock()
_last_slots = []


def _throttle():
    """Block until a request slot is available (sliding 60s window)."""
    while True:
        with _throttle_lock:
            now = time.monotonic()
            while _last_slots and now - _last_slots[0] > 60:
                _last_slots.pop(0)
            if len(_last_slots) < MAX_RPM:
                _last_slots.append(now)
                return
            wait = 60 - (now - _last_slots[0]) + 0.05
        time.sleep(wait)


class AlbertError(Exception):
    pass


def albert_noul(prompt, max_retries=5, timeout=60):
    """Ask a yes/no question, return (p_oui, latency_s). Prompt must end with
    an instruction to answer only Oui or Non."""
    load_env()
    api_key = os.environ.get("ALBERT_API_KEY")
    if not api_key:
        raise AlbertError("ALBERT_API_KEY missing — see bench/classification/.env")

    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 3,
        "temperature": 0,
        "logprobs": True,
        "top_logprobs": 10,
    }).encode()

    last_error = None
    for attempt in range(max_retries):
        _throttle()
        req = urllib.request.Request(
            BASE_URL, data=body,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        start = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read())
            latency = time.monotonic() - start
            return _extract_p_oui(data), latency
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            if e.code not in (408, 429, 500, 502, 503):
                raise AlbertError(f"HTTP {e.code}: {detail}") from e
            last_error = f"HTTP {e.code}: {detail}"
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_error = repr(e)
        time.sleep(2**attempt)

    raise AlbertError(f"gave up after {max_retries} attempts: {last_error}")


def _extract_p_oui(data):
    content = data["choices"][0]["logprobs"]["content"]
    if not content:
        raise AlbertError("no logprobs in response")
    top = content[0]["top_logprobs"]
    p_oui = sum(math.exp(t["logprob"]) for t in top if t["token"].strip().lower().startswith("oui"))
    p_non = sum(math.exp(t["logprob"]) for t in top if t["token"].strip().lower().startswith("non"))
    if p_oui + p_non == 0:
        # Model answered something else entirely — count as maximum uncertainty.
        return 0.5
    return p_oui / (p_oui + p_non)
