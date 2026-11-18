#!/usr/bin/env python3
"""Localhost-only device helper for the kiosk (Wi-Fi restart).

Caddy proxies /api/device/* → 127.0.0.1:8788. Bound to loopback on purpose.
"""
from __future__ import annotations

import json
import os
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 8788
TIMEOUT_S = 20
TOOLS = os.path.expanduser("~/hub-kiosk-tools")
RESTART_WIFI = os.path.join(TOOLS, "restart-wifi.sh")


def send(handler: BaseHTTPRequestHandler, status: int, body: dict) -> None:
    raw = json.dumps(body).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(raw)


def restart_wifi() -> dict:
    if not os.path.isfile(RESTART_WIFI):
        return {"ok": False, "error": "restart-wifi.sh is not installed"}
    try:
        proc = subprocess.run(
            ["sudo", "--non-interactive", RESTART_WIFI],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_S,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Wi-Fi restart timed out — try power-cycling the hub"}
    except OSError as err:
        return {"ok": False, "error": str(err)}

    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip() or f"exit {proc.returncode}"
        return {"ok": False, "error": detail}

    return {"ok": True, "detail": (proc.stdout or "").strip() or None}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print(f"[hub-device] {self.address_string()} {fmt % args}")

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path in ("/", "/health"):
            send(self, 200, {"ok": True})
            return
        send(self, 404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        # Drain body if present (we ignore it).
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            self.rfile.read(length)

        if path == "/wifi/restart":
            result = restart_wifi()
            send(self, 200 if result.get("ok") else 500, result)
            return
        send(self, 404, {"ok": False, "error": "Not found"})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[hub-device] http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
