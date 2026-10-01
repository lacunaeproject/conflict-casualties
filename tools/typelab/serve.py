"""Local type lab for the display numerals.

Serves the site from the repo root and injects the lab panel into every
page, so the real pages can be compared face by face. Nothing here ships.

    python3 tools/typelab/serve.py          # http://localhost:8800
    python3 tools/typelab/serve.py 9000     # another port
"""
import http.server
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8800
INJECT = (b'<script src="/tools/typelab/fonts.js"></script>'
          b'<script src="/tools/typelab/lab.js" defer></script></body>')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/':
            path = '/index.html'
        file = os.path.join(ROOT, path.lstrip('/'))
        if path.endswith('.html') and '/tools/' not in path and os.path.isfile(file):
            with open(file, 'rb') as f:
                body = f.read().replace(b'</body>', INJECT, 1)
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    print(f'Type lab: http://localhost:{PORT}/tools/typelab/specimen.html')
    print(f'Site with panel: http://localhost:{PORT}/')
    http.server.ThreadingHTTPServer(('', PORT), Handler).serve_forever()
