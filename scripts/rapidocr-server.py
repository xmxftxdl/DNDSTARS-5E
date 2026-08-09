"""Loopback-only RapidOCR adapter for scanned PDF pages.

Install once:
  python -m pip install rapidocr-onnxruntime pillow numpy

Run with:
  npm run local-ocr
  $env:ASTRALTRACE_OCR_API_URL = "http://127.0.0.1:47432/v1"
  npm run local-ai-bridge
"""

from __future__ import annotations

import base64
import binascii
import io
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR


HOST = "127.0.0.1"
PORT = int(os.environ.get("ASTRALTRACE_OCR_PORT", "47432"))
API_KEY = os.environ.get("ASTRALTRACE_OCR_API_KEY", "").strip()
MAX_BODY_BYTES = 36 * 1024 * 1024
MAX_IMAGE_PIXELS = 64_000_000
ENGINE = RapidOCR()


def response(handler: BaseHTTPRequestHandler, status: int, body: dict[str, Any]) -> None:
    payload = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(payload)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(payload)


def authorized(handler: BaseHTTPRequestHandler) -> bool:
    if not API_KEY:
        return True
    return handler.headers.get("Authorization", "") == f"Bearer {API_KEY}"


def decode_image(data_url: str) -> Image.Image:
    prefix, separator, encoded = data_url.partition(",")
    if separator != "," or prefix not in {
        "data:image/png;base64",
        "data:image/jpeg;base64",
        "data:image/webp;base64",
    }:
        raise ValueError("invalid-image-data-url")
    raw = base64.b64decode(encoded, validate=True)
    image = Image.open(io.BytesIO(raw))
    image.load()
    if image.width < 1 or image.height < 1 or image.width * image.height > MAX_IMAGE_PIXELS:
        raise ValueError("invalid-image-dimensions")
    return image.convert("RGB")


def bounding_box(points: Any) -> list[float]:
    coordinates = np.asarray(points, dtype=float).reshape(-1, 2)
    return [
        float(coordinates[:, 0].min()),
        float(coordinates[:, 1].min()),
        float(coordinates[:, 0].max()),
        float(coordinates[:, 1].max()),
    ]


class Handler(BaseHTTPRequestHandler):
    server_version = "AstralTraceRapidOCR/1"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[RapidOCR] {self.address_string()} {fmt % args}")

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/v1/healthz":
            response(self, 200, {"schemaVersion": 1, "status": "ok", "engineId": "rapidocr"})
            return
        response(self, 404, {"error": "not-found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/v1/ocr":
            response(self, 404, {"error": "not-found"})
            return
        if not authorized(self):
            response(self, 401, {"error": "unauthorized"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 2 or length > MAX_BODY_BYTES:
                raise ValueError("request-too-large")
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            if body.get("schemaVersion") != 1 or not isinstance(body.get("imageDataUrl"), str):
                raise ValueError("invalid-request")
            image = decode_image(body["imageDataUrl"])
            result, _elapsed = ENGINE(np.asarray(image))
            blocks: list[dict[str, Any]] = []
            for line in result or []:
                if not isinstance(line, (list, tuple)) or len(line) < 3:
                    continue
                text = str(line[1]).strip()
                confidence = float(line[2])
                if not text or confidence < 0 or confidence > 1:
                    continue
                blocks.append({
                    "text": text,
                    "bbox": bounding_box(line[0]),
                    "confidence": confidence,
                })
            confidence = sum(block["confidence"] for block in blocks) / len(blocks) if blocks else 0.0
            response(self, 200, {
                "schemaVersion": 1,
                "engineId": "rapidocr",
                "text": "\n".join(block["text"] for block in blocks),
                "confidence": confidence,
                "blocks": blocks,
            })
        except (ValueError, json.JSONDecodeError, binascii.Error) as error:
            response(self, 400, {"error": str(error)[:160]})
        except Exception as error:  # Keep engine details local; Bridge returns only a bounded code.
            print(f"[RapidOCR] failure: {error!r}")
            response(self, 500, {"error": "ocr-engine-failed"})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Astral Trace RapidOCR 已启动：http://{HOST}:{PORT}/v1")
    print("该服务仅监听本机回环地址，请勿映射到公网。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
