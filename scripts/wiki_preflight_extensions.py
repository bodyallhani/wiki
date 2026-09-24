"""Deterministic checks that must not depend on a model's PASS label."""
import json
import re
from html.parser import HTMLParser


class Images(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        if tag == 'img':
            self.sources.append(dict(attrs).get('src', ''))


def check(draft, filename, papers):
    errors = []
    try:
        draft = json.loads(draft) if isinstance(draft, str) else draft
        body = str(draft['CORE_BODY_KO'])
    except (ValueError, TypeError, KeyError):
        return ['WRITER_JSON_INCOMPLETE_OR_INVALID']
    if not re.fullmatch(r'[0-9]+\.[a-z0-9]+(?:-[a-z0-9]+)*', filename or ''):
        errors.append('VALID_FILENAME_REQUIRED')
    scanner = Images()
    scanner.feed(body)
    if scanner.sources != ['./image/' + filename + '-1.webp', './image/' + filename + '-2.webp']:
        errors.append('EXACT_IMAGE_FILENAMES_REQUIRED')
    if 'non-radicular' in json.dumps(papers, ensure_ascii=False).lower() and '비방사통성' in body:
        errors.append('NON_RADICULAR_TERMINOLOGY')
    return errors
