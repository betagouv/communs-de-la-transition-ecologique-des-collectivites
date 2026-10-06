"""Minimal client for TypeSafe Jev decisions, gateway-agnostic.

The three gateways share the same request/response shape:
  POST {url}  {"model": ..., "state": ..., "questions": {...}}
  -> {"answers": {id: {...}}, "usage": {"input_tokens": n, ...}}

Gateway is selected via JEV_GATEWAY (openrouter | typesafe | vercel).
Retries with exponential backoff + jitter on 408/429/5xx/timeouts — the
OpenRouter decisions endpoint is alpha and known to time out (~15%).
"""

import json
import os
import random
import time
import urllib.error
import urllib.request

from common import load_env

GATEWAYS = {
    "openrouter": {
        "url": "https://openrouter.ai/api/alpha/decisions",
        "model": "typesafe/jev-1.13",
        "key_env": "OPENROUTER_API_KEY",
    },
    "typesafe": {
        "url": "https://api.typesafe.ai/v1/systemone",
        "model": "jev-latest",
        "key_env": "TYPESAFE_API_KEY",
    },
    "vercel": {
        "url": "https://ai-gateway.vercel.sh/typesafe/v1/systemone",
        "model": "typesafe-ai/jev",
        "key_env": "AI_GATEWAY_API_KEY",
    },
}

RETRYABLE_STATUSES = {408, 429, 500, 502, 503, 520, 521, 522, 523, 524, 529}


class JevError(Exception):
    pass


def jev_decide(state, questions, gateway=None, max_retries=5, timeout=45):
    """One decisions call. Returns (response_dict, latency_seconds_of_last_attempt)."""
    load_env()
    gateway = gateway or os.environ.get("JEV_GATEWAY", "openrouter")
    cfg = GATEWAYS[gateway]
    api_key = os.environ.get(cfg["key_env"])
    if not api_key:
        raise JevError(f"{cfg['key_env']} missing — see bench/classification/.env")

    body = json.dumps({"model": cfg["model"], "state": state, "questions": questions}).encode()
    req = urllib.request.Request(
        cfg["url"],
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )

    last_error = None
    for attempt in range(max_retries):
        start = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read()), time.monotonic() - start
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:500]
            if e.code not in RETRYABLE_STATUSES:
                raise JevError(f"HTTP {e.code}: {detail}") from e
            last_error = f"HTTP {e.code}: {detail}"
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_error = repr(e)
        # Exponential backoff with jitter: 1, 2, 4, 8s (+/- 25%)
        delay = (2**attempt) * random.uniform(0.75, 1.25)
        time.sleep(delay)

    raise JevError(f"gave up after {max_retries} attempts: {last_error}")
