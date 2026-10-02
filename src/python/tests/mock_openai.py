"""Minimal OpenAI-compatible server for tests (chat completions, streaming or not)."""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class MockOpenAI:
    def __init__(self):
        self.answer = {"creative_theme_ideas": ["mock theme"], "confidence_score": 0.9}
        self.fail = False
        self.requests = []
        mock = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                mock.requests.append(body)
                if mock.fail:
                    self._send(500, {"error": {"message": "mock failure"}})
                    return
                content = json.dumps(mock.answer)
                if body.get("stream"):
                    self._stream(content)
                else:
                    self._send(200, {
                        "id": "mock", "object": "chat.completion", "created": int(time.time()), "model": body["model"],
                        "choices": [{"index": 0, "finish_reason": "stop",
                                     "message": {"role": "assistant", "content": content}}],
                        "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
                    })

            def _send(self, status, payload):
                out = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(out)))
                self.end_headers()
                self.wfile.write(out)

            def _stream(self, content):
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.end_headers()
                base = {"id": "mock", "object": "chat.completion.chunk", "created": int(time.time()), "model": "mock"}
                for i in range(0, len(content), 10):
                    chunk = {**base, "choices": [{"index": 0, "finish_reason": None,
                                                  "delta": {"content": content[i:i + 10]}}]}
                    self.wfile.write(f"data: {json.dumps(chunk)}\n\n".encode())
                done = {**base, "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}
                self.wfile.write(f"data: {json.dumps(done)}\n\ndata: [DONE]\n\n".encode())

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}/v1"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def stop(self):
        self.server.shutdown()
