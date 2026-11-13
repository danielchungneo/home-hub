#!/usr/bin/env python3
"""If Chromium boots to a blank http://127.0.0.1/ tab, force a reload via CDP.

Important: the static index.html always sets <title>Chung Family Hub</title>, so a
title check alone cannot detect the white-screen case where /assets/* fall back to
HTML because of bad directory modes. We check #root content length instead.
"""
from __future__ import annotations

import asyncio
import json
import time
import urllib.request

import websockets

CDP = "http://127.0.0.1:9222"
TARGET = "http://127.0.0.1/"
# Empty React root is tiny; a painted hub shell is tens of KB of HTML.
MIN_ROOT_LEN = 500


def wait_for_cdp(timeout_s: float = 60) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"{CDP}/json/version", timeout=2).read()
            return
        except Exception:
            time.sleep(1)
    raise SystemExit("CDP never came up")


async def root_len(ws) -> int:
    async def call(method: str, params: dict | None = None, id: int = 1):
        await ws.send(json.dumps({"id": id, "method": method, "params": params or {}}))
        while True:
            raw = json.loads(await ws.recv())
            if raw.get("id") == id:
                return raw

    expr = (
        "((document.getElementById('root') && document.getElementById('root').innerHTML) || '').length"
    )
    result = await call(
        "Runtime.evaluate",
        {"expression": expr, "returnByValue": True},
        id=10,
    )
    value = (result.get("result") or {}).get("value")
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


async def ensure_page() -> None:
    pages = json.load(urllib.request.urlopen(f"{CDP}/json/list"))
    page = next((p for p in pages if p.get("type") == "page"), None)
    if not page:
        raise SystemExit("no page target")

    uri = page["webSocketDebuggerUrl"]
    async with websockets.connect(uri, max_size=8_000_000) as ws:

        async def call(method: str, params: dict | None = None, id: int = 1):
            await ws.send(json.dumps({"id": id, "method": method, "params": params or {}}))
            while True:
                raw = json.loads(await ws.recv())
                if raw.get("id") == id:
                    return raw

        await call("Page.enable", id=1)
        length = await root_len(ws)
        if length >= MIN_ROOT_LEN:
            print(f"ok rootLen={length}")
            return

        print(f"blank tab rootLen={length} — navigating")
        await call("Page.navigate", {"url": TARGET}, id=2)
        await asyncio.sleep(5)
        length = await root_len(ws)
        if length < MIN_ROOT_LEN:
            print(f"still blank rootLen={length} — hard reload")
            await call("Page.reload", {"ignoreCache": True}, id=3)
            await asyncio.sleep(5)
            length = await root_len(ws)
        print(f"after rootLen={length}")


def main() -> None:
    # Give Chromium a moment after cage starts.
    time.sleep(8)
    wait_for_cdp()
    # One retry window in case the first paint is still racing.
    for attempt in range(3):
        try:
            asyncio.run(ensure_page())
            return
        except Exception as err:
            print(f"attempt {attempt + 1} failed: {err}")
            time.sleep(4)


if __name__ == "__main__":
    main()
