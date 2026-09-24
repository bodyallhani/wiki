"""Require public HTML to match the checked-out revision before IndexNow.

Read-only network probes. A timeout or mismatch stops the notification job.
"""
import concurrent.futures
import hashlib
from pathlib import Path
import time
import urllib.parse
import urllib.request

ORIGIN = 'https://wiki.body-all.co.kr'


def expected_file(root, url):
    u = urllib.parse.urlsplit(url)
    if u.scheme != 'https' or u.netloc != 'wiki.body-all.co.kr' or u.query or u.fragment:
        raise ValueError('UNEXPECTED_PUBLIC_URL')
    name = urllib.parse.unquote(u.path).lstrip('/')
    if not name or name.endswith('/'):
        name += 'index.html'
    root = Path(root).resolve()
    target = (root / name).resolve()
    if not target.is_relative_to(root) or target.suffix != '.html':
        raise ValueError('UNEXPECTED_PUBLIC_PATH')
    return target


def fetch(url, revision):
    request = urllib.request.Request(url + '?bodyall_revision=' + revision,
        headers={'User-Agent': 'Bodyall-Deployment-Check/1.0', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=8) as response:
        if response.status != 200 or urllib.parse.urlsplit(response.url).netloc != 'wiki.body-all.co.kr':
            raise ValueError('PUBLIC_RESPONSE_NOT_READY')
        if response.headers.get_content_type() != 'text/html':
            raise ValueError('PUBLIC_RESPONSE_NOT_HTML')
        if any(word in response.headers.get('X-Robots-Tag', '').lower() for word in ('noindex', 'none')):
            raise ValueError('PUBLIC_RESPONSE_BLOCKED')
        body = response.read(2_000_001)
        if len(body) > 2_000_000:
            raise ValueError('PUBLIC_RESPONSE_TOO_LARGE')
        return body


def verify(root, urls, revision, deadline_seconds=180, reader=fetch):
    expected = {url: hashlib.sha256(expected_file(root, url).read_bytes()).hexdigest() for url in urls}
    pending, reasons = set(expected), {}
    deadline = time.monotonic() + deadline_seconds
    while pending:
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            futures = {pool.submit(reader, url, revision): url for url in pending}
            for future in concurrent.futures.as_completed(futures):
                url = futures[future]
                try:
                    actual = hashlib.sha256(future.result()).hexdigest()
                    if actual == expected[url]:
                        pending.remove(url)
                        reasons.pop(url, None)
                    else:
                        reasons[url] = 'PUBLIC_BYTES_DIFFER_FROM_REVISION'
                except Exception as exc:
                    reasons[url] = type(exc).__name__
        if not pending:
            return {'verified': len(expected), 'revision': revision}
        if time.monotonic() >= deadline:
            raise RuntimeError('PUBLIC_DEPLOYMENT_PENDING: ' + str(reasons))
        time.sleep(min(10, max(0, deadline-time.monotonic())))


if __name__ == '__main__':
    import os
    urls = Path(os.environ['URL_FILE']).read_text().splitlines()
    print(verify(Path.cwd(), [u for u in urls if u], os.environ['HEAD_SHA']))
