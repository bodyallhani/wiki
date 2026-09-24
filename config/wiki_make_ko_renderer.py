# Source: publication_policy.py
"""Publication policy: pure HTML checks and bounded public-image verification.

No browser execution, no credentials and no network calls during import.
The publishing controller checks every final document before any GitHub mutation.
"""
import base64, copy, hashlib, html, json, re, struct, time
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
POLICY_VERSION = '5.5'
SITE = 'https://wiki.body-all.co.kr/'
ARTICLE_ROOT = SITE + 'encyclopedia/'
CLINIC_ID = SITE + '#clinic'
DOCTOR_ID = SITE + '#doctor-donghae-lee'
SART_ID = SITE + '#sart-protocol'
CHUNA_ID = SITE + '#chuna-manual-therapy'
SART_CANONICAL = SITE + 'SART.html'
PROFILE_URL = 'https://body-all.co.kr/55/?bmode=view&idx=62308022'
FACT_IDS = {'assessment-posture', 'assessment-mobility', 'assessment-rom', 'assessment-gait-symptoms', 'sart-reassessment', 'sart-movement-education', 'clinical-director'}
LANG_SUFFIX = {'ko': '', 'en': '_en', 'zh-Hans': '_cn'}
CLINIC_REGISTRY = {'@type': 'MedicalClinic', '@id': CLINIC_ID, 'name': '바디올한의원', 'url': 'https://body-all.co.kr/', 'telephone': '031-8067-5825', 'hasMap': 'https://naver.me/53lcJrXB', 'address': {'@type': 'PostalAddress', 'streetAddress': '인계동 1114-7, 3층', 'addressLocality': '수원시 팔달구', 'addressRegion': '경기도', 'addressCountry': 'KR'}, 'sameAs': ['https://body-all.co.kr/', 'https://pf.kakao.com/_wdtXK'], 'employee': {'@id': DOCTOR_ID}, 'openingHoursSpecification': [{'@type': 'OpeningHoursSpecification', 'dayOfWeek': ['https://schema.org/' + d for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']], 'opens': a, 'closes': b} for a, b in [('10:00', '13:00'), ('14:00', '20:30')]] + [{'@type': 'OpeningHoursSpecification', 'dayOfWeek': ['https://schema.org/Saturday', 'https://schema.org/Sunday'], 'opens': a, 'closes': b} for a, b in [('10:00', '13:00'), ('14:00', '16:00')]], 'description': '추나·척추교정을 대표 진료영역으로 하는 바디올한의원. 설·추석 연휴 6일은 휴진하며 구체적인 휴진 날짜와 공휴일 진료시간은 병원 안내를 확인한다.'}

class PublicAssetWait(ValueError):
    pass

def jpeg_dimensions(raw):
    if not raw.startswith(b'\xff\xd8'):
        raise ValueError('IMAGE_FORMAT_UNSUPPORTED')
    pos = 2
    while pos + 4 <= len(raw):
        if raw[pos] != 255:
            raise ValueError('IMAGE_JPEG_INVALID')
        while pos < len(raw) and raw[pos] == 255:
            pos += 1
        marker = raw[pos]
        pos += 1
        if marker in (216, 217):
            continue
        size = int.from_bytes(raw[pos:pos + 2], 'big')
        if size < 2 or pos + size > len(raw):
            raise ValueError('IMAGE_JPEG_TRUNCATED')
        if marker in (192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207):
            return (int.from_bytes(raw[pos + 5:pos + 7], 'big'), int.from_bytes(raw[pos + 3:pos + 5], 'big'))
        if marker == 218:
            break
        pos += size
    raise ValueError('IMAGE_JPEG_DIMENSIONS_MISSING')

def assets_from_blobs(base, blobs):
    """Observe committed image bytes before review; never infer format from a suffix."""
    expected_urls(base)
    out = []
    for i, blob in enumerate(blobs, 1):
        if isinstance(blob, str):
            blob = json.loads(blob)
        if not isinstance(blob, dict):
            raise ValueError('IMAGE_BLOB_CONTENT_REQUIRED')
        if blob.get('encoding') == 'base64' and blob.get('content'):
            raw = base64.b64decode(re.sub('\\s+', '', blob['content']), validate=True)
        else:
            import requests
            raw_url = 'https://raw.githubusercontent.com/bodyallhani/wiki/main/encyclopedia/image/' + base + f'-{i}.webp'
            try:
                with requests.get(raw_url, timeout=(2, 3), allow_redirects=False, stream=True) as response:
                    if response.status_code != 200:
                        raise ValueError('IMAGE_RAW_HTTP_' + str(response.status_code))
                    data = bytearray()
                    started = time.monotonic()
                    for chunk in response.iter_content(65536):
                        data.extend(chunk)
                        if len(data) > 8000000 or time.monotonic() - started > 8:
                            raise ValueError('IMAGE_RAW_LIMIT')
                    raw = bytes(data)
            except requests.RequestException as exc:
                raise ValueError('IMAGE_RAW_UNAVAILABLE:' + type(exc).__name__) from exc
        sha = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\x00' + raw).hexdigest()
        if blob.get('sha') != sha:
            raise ValueError('IMAGE_BLOB_IDENTITY_MISMATCH')
        if raw.startswith(b'\x89PNG\r\n\x1a\n') and len(raw) >= 24:
            w, h = struct.unpack('>II', raw[16:24])
            mime = 'image/png'
        elif raw.startswith(b'\xff\xd8'):
            w, h = jpeg_dimensions(raw)
            mime = 'image/jpeg'
        else:
            w, h = webp_dimensions(raw)
            mime = 'image/webp'
        if not 1 <= w <= 20000 or not 1 <= h <= 20000:
            raise ValueError('IMAGE_DIMENSIONS_INVALID')
        out.append({'url': ARTICLE_ROOT + 'image/' + base + f'-{i}.webp', 'width': w, 'height': h, 'sha': sha, 'content_type': mime, 'bytes': len(raw)})
    if len(out) != 2:
        raise ValueError('TWO_IMAGE_BLOBS_REQUIRED')
    return out

def expected_urls(base):
    if not re.fullmatch('[0-9]+\\.[a-z0-9]+(?:-[a-z0-9]+)*', base or ''):
        raise ValueError('INVALID_BASE_NAME')
    return {lang: ARTICLE_ROOT + base + suff + '.html' for lang, suff in LANG_SUFFIX.items()}

def webp_dimensions(raw):
    if len(raw) < 20 or raw[:4] != b'RIFF' or raw[8:12] != b'WEBP':
        raise PublicAssetWait('PUBLIC_IMAGE_NOT_WEBP')
    if int.from_bytes(raw[4:8], 'little') + 8 != len(raw):
        raise PublicAssetWait('PUBLIC_IMAGE_TRUNCATED')
    pos = 12
    while pos + 8 <= len(raw):
        tag = raw[pos:pos + 4]
        n = int.from_bytes(raw[pos + 4:pos + 8], 'little')
        p = raw[pos + 8:pos + 8 + n]
        if len(p) != n:
            raise PublicAssetWait('PUBLIC_IMAGE_TRUNCATED')
        if tag == b'VP8X' and n >= 10:
            return (1 + int.from_bytes(p[4:7], 'little'), 1 + int.from_bytes(p[7:10], 'little'))
        if tag == b'VP8 ' and n >= 10 and (p[3:6] == b'\x9d\x01*'):
            return (int.from_bytes(p[6:8], 'little') & 16383, int.from_bytes(p[8:10], 'little') & 16383)
        if tag == b'VP8L' and n >= 5 and (p[0] == 47):
            bits = int.from_bytes(p[1:5], 'little')
            return ((bits & 16383) + 1, (bits >> 14 & 16383) + 1)
        pos += 8 + n + n % 2
    raise PublicAssetWait('PUBLIC_IMAGE_DIMENSIONS_MISSING')

def probe_public_assets(base):
    """Read exactly two same-origin public WebP files. Retries belong to the queue."""
    import requests
    expected_urls(base)
    out = []
    deadline = time.monotonic() + 12
    for i in (1, 2):
        url = ARTICLE_ROOT + 'image/' + base + f'-{i}.webp'
        try:
            with requests.get(url, timeout=(2, 3), allow_redirects=False, stream=True, headers={'Accept': 'image/webp', 'User-Agent': 'Bodyall-Wiki-Publication-Check/5.5'}) as r:
                if r.status_code != 200:
                    raise PublicAssetWait('PUBLIC_IMAGE_HTTP_' + str(r.status_code))
                headers = {k.lower(): v for k, v in r.headers.items()}
                if headers.get('content-type', '').split(';')[0].strip().lower() != 'image/webp':
                    raise PublicAssetWait('PUBLIC_IMAGE_CONTENT_TYPE')
                if re.search('\\b(noindex|noimageindex|none)\\b', headers.get('x-robots-tag', ''), re.I):
                    raise PublicAssetWait('PUBLIC_IMAGE_ROBOTS_BLOCK')
                raw = bytearray()
                for chunk in r.iter_content(65536):
                    if time.monotonic() > deadline:
                        raise PublicAssetWait('PUBLIC_IMAGE_CHECK_TIME_BUDGET')
                    raw.extend(chunk)
                    if len(raw) > 8000000:
                        raise PublicAssetWait('PUBLIC_IMAGE_TOO_LARGE')
                raw = bytes(raw)
                w, h = webp_dimensions(raw)
                if not 1 <= w <= 20000 or not 1 <= h <= 20000:
                    raise PublicAssetWait('PUBLIC_IMAGE_DIMENSIONS_INVALID')
                git_sha = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\x00' + raw).hexdigest()
                out.append({'url': url, 'width': w, 'height': h, 'sha': git_sha, 'content_type': 'image/webp', 'bytes': len(raw)})
        except requests.RequestException as e:
            raise PublicAssetWait('PUBLIC_IMAGE_UNAVAILABLE:' + type(e).__name__) from e
    return out

class PageFacts(HTMLParser):

    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.images = []
        self.links = []
        self.ids = []
        self.metas = []
        self.headlinks = []
        self.text = []
        self.hidden = 0
        self.fact_ids = []
        self.scripts = []
        self.current_script = None
        self.h1_count = 0
        self.feed(text)

    def handle_starttag(self, t, attrs):
        a = dict(attrs)
        self.tags.append((t, a))
        if t in ('style', 'script'):
            self.hidden += 1
            if t == 'script' and a.get('type', '').lower() == 'application/ld+json':
                self.current_script = []
        if t == 'meta':
            self.metas.append(a)
        if t == 'link':
            self.headlinks.append(a)
        if t == 'a':
            self.links.append(a)
        if t == 'img':
            self.images.append(a)
        if t == 'h1':
            self.h1_count += 1
        if 'id' in a:
            self.ids.append(a['id'])
        if 'data-bodyall-fact' in a:
            self.fact_ids.extend(a['data-bodyall-fact'].split())

    def handle_endtag(self, t):
        if t in ('style', 'script'):
            self.hidden = max(0, self.hidden - 1)
            if t == 'script' and self.current_script is not None:
                self.scripts.append(''.join(self.current_script))
                self.current_script = None

    def handle_data(self, text):
        if self.current_script is not None:
            self.current_script.append(text)
        if not self.hidden:
            self.text.append(text)

    def visible(self):
        return re.sub('\\s+', ' ', ' '.join(self.text)).strip()

def render_tag(tag, attrs):
    return '<' + tag + ''.join((' ' + k if v is None else ' ' + k + "='" + html.escape(str(v), quote=True) + "'" for k, v in attrs.items())) + '>'

def patch_opening_tags(text, tag, transform):

    def one(m):
        p = PageFacts(m.group(0))
        a = p.tags[0][1]
        return render_tag(tag, transform(a))
    return re.sub('<' + tag + '\\b[^>]*>', one, text, flags=re.I)

def normalize_draft(d, assets):
    """Normalize visible technical fields before automatic and human review."""
    d = copy.deepcopy(d)
    lang = d.get('language', 'ko')
    urls = expected_urls(d['base_name'])
    url = urls[lang]
    if d['url'] != url:
        raise ValueError('DRAFT_URL_CONTRACT')
    body = d['body']
    complete = d['html']
    schema = copy.deepcopy(d['schema'])
    if complete.count(body) != 1:
        raise ValueError('BODY_NOT_UNIQUE_IN_TEMPLATE')
    expected_images = [ARTICLE_ROOT + 'image/' + d['base_name'] + f'-{i}.webp' for i in (1, 2)]
    if [a['url'] for a in assets] != expected_images:
        raise ValueError('ASSET_OBSERVATION_URL_MISMATCH')

    def image_attrs(a):
        u = urljoin(url, a.get('src', ''))
        idx = expected_images.index(u) if u in expected_images else -1
        if idx < 0:
            raise ValueError('BODY_IMAGE_PATH_MISMATCH')
        a.update(width=str(assets[idx]['width']), height=str(assets[idx]['height']), loading='eager' if idx == 0 else 'lazy')
        return a
    body = patch_opening_tags(body, 'img', image_attrs)
    names = {'ko': ('홈', '증상백과'), 'en': ('Home', 'Symptom encyclopedia'), 'zh-Hans': ('首页', '症状百科')}[lang]
    label = d['meta_title'].split(' | ')[0]
    crumb = "<div class='breadcrumb'><a href='" + SITE + "'>" + names[0] + "</a> &gt; <a href='" + ARTICLE_ROOT + 'index' + LANG_SUFFIX[lang] + ".html'>" + names[1] + '</a> &gt; ' + html.escape(label) + '</div>'
    body, n = re.subn('<div\\b[^>]*class=[\'\\"]breadcrumb[\'\\"][^>]*>[\\s\\S]*?</div>', lambda m: crumb, body, count=1, flags=re.I)
    if n != 1:
        raise ValueError('BREADCRUMB_REQUIRED')
    facts = PageFacts(body)
    if not set(facts.fact_ids) - {'clinical-director'}:
        raise ValueError('BODYALL_DISTINCTIVE_FACT_REQUIRED')
    if set(facts.fact_ids) - FACT_IDS:
        raise ValueError('UNREGISTERED_BODYALL_FACT')
    if len(facts.fact_ids) != len(set(facts.fact_ids)):
        raise ValueError('REPEATED_BODYALL_FACT_UNIT')
    complete = complete.replace(d['body'], body, 1)

    def safe_link(a):
        if a.get('target') == '_blank':
            a['rel'] = ' '.join(dict.fromkeys((a.get('rel') or '').split() + ['noopener', 'noreferrer']))
        return a
    body = patch_opening_tags(body, 'a', safe_link)
    complete = patch_opening_tags(complete, 'a', safe_link)
    for old, new in ((SITE + '#procedure-sart', SART_ID), (SITE + '#procedure-chuna', CHUNA_ID)):

        def replace_id(x):
            if isinstance(x, dict):
                return {k: replace_id(v) for k, v in x.items()}
            if isinstance(x, list):
                return [replace_id(v) for v in x]
            return new if x == old else x
        schema = replace_id(schema)
    nodes = schema.get('@graph')
    if not isinstance(nodes, list) or not all((isinstance(x, dict) for x in nodes)):
        raise ValueError('SCHEMA_GRAPH_REQUIRED')
    # v6.6.3: Treatment entities use TherapeuticProcedure; procedureType is prohibited.
    for node in nodes:
        raw_types = node.get('@type', [])
        node_types = raw_types if isinstance(raw_types, list) else [raw_types]
        if 'MedicalProcedure' in node_types:
            node_types = ['TherapeuticProcedure' if x == 'MedicalProcedure' else x for x in node_types]
            node['@type'] = node_types if isinstance(raw_types, list) else node_types[0]
        if 'TherapeuticProcedure' in node_types:
            node.pop('procedureType', None)
    page = next((x for x in nodes if x.get('@id') == url + '#webpage'), None)
    if page is None:
        raise ValueError('CANONICAL_WEBPAGE_REQUIRED')
    page.update(url=url, publisher={'@id': CLINIC_ID}, breadcrumb={'@id': url + '#breadcrumb'}, image=[{'@id': url + f'#image-{i}'} for i in (1, 2)], primaryImageOfPage={'@id': url + '#image-1'})
    previous = next((x for x in nodes if x.get('@id') == CLINIC_ID), {})
    clinic = copy.deepcopy(CLINIC_REGISTRY)
    if previous.get('availableService'):
        clinic['availableService'] = previous['availableService']
    if lang != 'ko':
        clinic['name'] = 'Bodyall Korean Medicine Clinic' if lang == 'en' else 'Bodyall韩医院'
    replace = {CLINIC_ID: clinic, DOCTOR_ID: {'@type': 'Person', '@id': DOCTOR_ID, 'name': {'ko': '이동해', 'en': 'DONGHAE LEE', 'zh-Hans': '李东海'}[lang], 'jobTitle': {'ko': '대표원장', 'en': 'Chief Director', 'zh-Hans': '代表院长'}[lang], 'url': PROFILE_URL, 'worksFor': {'@id': CLINIC_ID}}, url + '#breadcrumb': {'@type': 'BreadcrumbList', '@id': url + '#breadcrumb', 'itemListElement': [{'@type': 'ListItem', 'position': i, 'name': name, 'item': u} for i, (name, u) in enumerate([(names[0], SITE), (names[1], ARTICLE_ROOT + 'index' + LANG_SUFFIX[lang] + '.html'), (label, url)], 1)]}}
    if len(facts.images) != 2:
        raise ValueError('TWO_BODY_IMAGES_REQUIRED')
    for i, a in enumerate(assets, 1):
        replace[url + f'#image-{i}'] = {'@type': 'ImageObject', '@id': url + f'#image-{i}', 'contentUrl': a['url'], 'url': a['url'], 'width': a['width'], 'height': a['height'], 'encodingFormat': a['content_type'], 'caption': facts.images[i - 1].get('alt', '')}
    nodes[:] = [x for x in nodes if x.get('@id') not in replace]
    nodes.extend(replace.values())
    sart = next((x for x in nodes if x.get('@id') == SART_ID), None)
    if sart:
        if 'SART' not in facts.visible():
            raise ValueError('SCHEMA_ONLY_SART')
        sart.update(url=SART_CANONICAL, mainEntityOfPage={'@id': SART_CANONICAL + '#webpage'})
        subjects = sart.get('subjectOf', [])
        subjects = subjects if isinstance(subjects, list) else [subjects]
        sart['subjectOf'] = [{'@id': SART_CANONICAL + '#webpage'}, {'@id': url + '#webpage'}]
        mention = page.get('mentions', [])
        mention = mention if isinstance(mention, list) else [mention]
        for entity in (CLINIC_ID, CHUNA_ID, SART_ID):
            if not any((x.get('@id') == entity for x in mention if isinstance(x, dict))):
                mention.append({'@id': entity})
        page['mentions'] = mention
        if not any((x.get('@id') == CHUNA_ID for x in nodes)):
            raise ValueError('SART_REQUIRES_DISTINCT_CHUNA_NODE')
        services = clinic.get('availableService', [])
        services = services if isinstance(services, list) else [services]
        clinic['availableService'] = services + [{'@id': eid} for eid in (CHUNA_ID, SART_ID) if not any((isinstance(x, dict) and x.get('@id') == eid for x in services))]
    viewport = "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
    complete = re.sub('<meta\\b[^>]*\\bname=[\\\'\\"]viewport[\\\'\\"][^>]*>', lambda m: viewport, complete, flags=re.I)
    complete = re.sub('<link\\b[^>]*\\brel=[\\\'\\"](?:canonical|alternate)[\\\'\\"][^>]*>', '', complete, flags=re.I)
    complete = re.sub('<meta\\b[^>]*\\bproperty=[\\\'\\"]og:image(?::[^\\\'\\"]+)?[\\\'\\"][^>]*>', '', complete, flags=re.I)
    head = "<link rel='canonical' href='" + url + "'>" + ''.join(("<link rel='alternate' hreflang='" + l + "' href='" + u + "'>" for l, u in urls.items())) + "<link rel='alternate' hreflang='x-default' href='" + urls['ko'] + "'>"
    head += "<meta property='og:image' content='" + assets[0]['url'] + "'><meta property='og:image:width' content='" + str(assets[0]['width']) + "'><meta property='og:image:height' content='" + str(assets[0]['height']) + "'>"
    complete = complete.replace('</head>', head + '</head>', 1)

    def schema_script(m):
        return "<script type='application/ld+json'>" + json.dumps(schema, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + '</script>'
    complete, n = re.subn('<script\\b[^>]*type=[\\\'\\"]application/ld\\+json[\\\'\\"][^>]*>[\\s\\S]*?</script>', schema_script, complete, flags=re.I)
    if n != 1:
        raise ValueError('ONE_SCHEMA_SCRIPT_REQUIRED')
    footer = {'ko': "<h2>설·추석 연휴 6일을 제외하고 연중 진료</h2><p>바디올한의원 · 경기도 수원시 팔달구 인계동 1114-7, 3층 · 031-8067-5825</p><p>평일 10:00–13:00 / 14:00–20:30, 토·일 10:00–13:00 / 14:00–16:00. 구체적인 명절 휴진 날짜와 공휴일 진료시간은 병원 안내를 확인해 주세요.</p><a class='map-link-btn' href='https://naver.me/53lcJrXB' target='_blank' rel='noopener noreferrer'>진료·예약 안내 확인</a>", 'en': "<h2>Year-round care except six days during Seollal and Chuseok</h2><p>Bodyall Korean Medicine Clinic · 3F, 1114-7 Ingye-dong, Paldal-gu, Suwon-si, Gyeonggi-do, Korea · 031-8067-5825</p><p>Weekdays 10:00–13:00 / 14:00–20:30; Saturday–Sunday 10:00–13:00 / 14:00–16:00. Confirm specific holiday closures and public-holiday hours with the clinic.</p><a class='map-link-btn' href='https://naver.me/53lcJrXB' target='_blank' rel='noopener noreferrer'>Clinic and appointment information</a>", 'zh-Hans': "<h2>除春节与中秋共六天休诊外全年接诊</h2><p>Bodyall韩医院 · 韩国京畿道水原市八达区仁溪洞1114-7，3层 · 031-8067-5825</p><p>工作日10:00–13:00 / 14:00–20:30；周六、周日10:00–13:00 / 14:00–16:00。具体节日休诊日期及法定假日门诊时间请咨询医院。</p><a class='map-link-btn' href='https://naver.me/53lcJrXB' target='_blank' rel='noopener noreferrer'>查看门诊与预约信息</a>"}[lang]
    complete, n = re.subn('<footer\\b[^>]*>[\\s\\S]*?</footer>', lambda m: m.group(0).split('>', 1)[0] + '>' + footer + '</footer>', complete, count=1, flags=re.I)
    if n != 1:
        raise ValueError('ONE_TEMPLATE_FOOTER_REQUIRED')
    d.update(body=body, html=complete, schema=schema, asset_checks=assets, policy_version=POLICY_VERSION)
    return d

def validate_publication(d, final, record, assets):
    if d.get('policy_version') != POLICY_VERSION:
        raise ValueError('PRODUCTION_POLICY_REQUIRED')
    base = d['base_name']
    lang = d['language']
    urls = expected_urls(base)
    url = urls[lang]
    if re.search('(?:^|[.\\-_])(preview|validation|sandbox|demo|test|simulation)(?:$|[.\\-_])', base, re.I):
        raise ValueError('PRODUCTION_PREVIEW_SLUG')
    s = final['html']
    p = PageFacts(s)
    visible = p.visible()
    if re.search('<base\\b', s, re.I):
        raise ValueError('PRODUCTION_PREVIEW_BASE_TAG')
    for a in p.metas:
        if a.get('name', '').lower() in ('robots', 'googlebot', 'bingbot') and re.search('\\b(noindex|nofollow|none)\\b', a.get('content', ''), re.I):
            raise ValueError('PRODUCTION_ROBOTS_BLOCK')
    forbidden = ['비공개 출력 예시', '실제 검수/발행 아님', '승인 가정', '가정한 검토', '발행 전', 'SIMULATION_ONLY', 'not published', '尚未发布', 'PENDING', '검수 대기', '의학적 검수: 대기']
    if any((x.casefold() in visible.casefold() for x in forbidden)):
        raise ValueError('PRODUCTION_PREVIEW_OR_PENDING_TEXT')
    if re.search('__[A-Z][A-Z0-9_]+__|\\{\\{[^}]+\\}\\}', s):
        raise ValueError('PRODUCTION_UNRESOLVED_PLACEHOLDER')
    if p.h1_count != 1 or len(p.images) != 2:
        raise ValueError('PRODUCTION_BODY_STRUCTURE')
    canonical = [a.get('href') for a in p.headlinks if a.get('rel', '').lower() == 'canonical']
    if canonical != [url] or d['url'] != url:
        raise ValueError('PRODUCTION_CANONICAL_MISMATCH')
    alternate = {a.get('hreflang'): a.get('href') for a in p.headlinks if a.get('rel', '').lower() == 'alternate'}
    if any((alternate.get(l) != u for l, u in urls.items())) or alternate.get('x-default') != urls['ko']:
        raise ValueError('PRODUCTION_HREFLANG_MISMATCH')
    if len(p.scripts) != 1:
        raise ValueError('PRODUCTION_ONE_SCHEMA_REQUIRED')
    schema = json.loads(p.scripts[0])
    nodes = schema.get('@graph', [])
    pages = [x for x in nodes if x.get('@id') == url + '#webpage']
    if len(pages) != 1 or pages[0].get('url') != url:
        raise ValueError('PRODUCTION_SCHEMA_URL_MISMATCH')
    page = pages[0]
    if schema != final['schema']:
        raise ValueError('PRODUCTION_SCHEMA_RENDER_MISMATCH')
    for k in ('datePublished', 'dateModified'):
        try:
            stamp = datetime.fromisoformat(page[k].replace('Z', '+00:00'))
        except (KeyError, ValueError, AttributeError):
            raise ValueError('PRODUCTION_DATE_REQUIRED:' + k)
        if stamp.tzinfo is None:
            raise ValueError('PRODUCTION_DATE_TIMEZONE')
        if stamp.astimezone(timezone(timedelta(hours=9))).isoformat(timespec='seconds') not in visible:
            raise ValueError('PRODUCTION_VISIBLE_DATE_MISMATCH')
    if datetime.fromisoformat(page['datePublished'].replace('Z', '+00:00')) > datetime.fromisoformat(page['dateModified'].replace('Z', '+00:00')):
        raise ValueError('PRODUCTION_DATE_ORDER')
    if page.get('author', {}).get('@id') != CLINIC_ID or page.get('publisher', {}).get('@id') != CLINIC_ID:
        raise ValueError('PRODUCTION_AUTHOR_PUBLISHER')
    if lang == 'ko':
        review_date = datetime.fromisoformat(record['approved_at']).astimezone(timezone(timedelta(hours=9))).date().isoformat()
        if page.get('reviewedBy', {}).get('@id') != DOCTOR_ID or page.get('lastReviewed') != review_date or review_date not in visible:
            raise ValueError('PRODUCTION_REVIEW_METADATA')
    else:
        if any(('reviewedBy' in n or 'lastReviewed' in n for n in nodes)):
            raise ValueError('TRANSLATION_FALSE_PHYSICIAN_REVIEW')
        if page.get('translationOfWork', {}).get('@id') != urls['ko'] + '#webpage':
            raise ValueError('TRANSLATION_KR_LINK')
    for i, a in enumerate(p.images):
        observed = assets[i]
        u = urljoin(url, a.get('src', ''))
        if u != observed['url'] or a.get('src', '').startswith('data:'):
            raise ValueError('PRODUCTION_IMAGE_URL')
        if str(a.get('width')) != str(observed['width']) or str(a.get('height')) != str(observed['height']):
            raise ValueError('PRODUCTION_IMAGE_DIMENSIONS')
        if not a.get('alt') or a.get('loading') != ('eager' if i == 0 else 'lazy'):
            raise ValueError('PRODUCTION_IMAGE_ATTRIBUTES')
        image = next((n for n in nodes if n.get('@id') == url + f'#image-{i + 1}'), {})
        if image.get('contentUrl') != u:
            raise ValueError('PRODUCTION_IMAGE_SCHEMA_MISMATCH')
    if [a['sha'] for a in assets] != d['image_shas']:
        raise PublicAssetWait('PUBLIC_IMAGE_VERSION_NOT_DEPLOYED')
    if [a.get('content') for a in p.metas if a.get('property') == 'og:image'] != [assets[0]['url']]:
        raise ValueError('PRODUCTION_OG_IMAGE')
    if 'maximum-scale=' in s or 'user-scalable=no' in s:
        raise ValueError('PRODUCTION_ZOOM_DISABLED')
    if len(p.ids) != len(set(p.ids)):
        raise ValueError('PRODUCTION_DUPLICATE_HTML_ID')
    for a in p.links:
        href = a.get('href', '')
        if href.startswith('#') and href[1:] not in p.ids:
            raise ValueError('PRODUCTION_BROKEN_FRAGMENT')
        if a.get('target') == '_blank' and (not {'noopener', 'noreferrer'} <= set(a.get('rel', '').split())):
            raise ValueError('PRODUCTION_EXTERNAL_LINK_REL')
    if not set(p.fact_ids) - {'clinical-director'} or set(p.fact_ids) - FACT_IDS or len(p.fact_ids) != len(set(p.fact_ids)):
        raise ValueError('PRODUCTION_BODYALL_FACT_REQUIRED')
    if any((a.get('content_type') != 'image/webp' for a in assets)):
        raise ValueError('PRODUCTION_IMAGE_CONVERSION_REQUIRED')
    if not any((n.get('@type') == 'BreadcrumbList' and n.get('@id') == url + '#breadcrumb' for n in nodes)):
        raise ValueError('PRODUCTION_BREADCRUMB_REQUIRED')
    if any(('PublicHolidays' in str(n.get('openingHoursSpecification', '')) for n in nodes)):
        raise ValueError('PRODUCTION_PUBLIC_HOLIDAYS_ENUM')
    return {'ok': True, 'policy': POLICY_VERSION, 'canonical': url, 'fact_units': len(set(p.fact_ids))}

# Source: review_content.py
"""Deterministic content identity and truthful review metadata. No network calls."""
import copy, hashlib, html, json, re
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
KST = timezone(timedelta(hours=9))
CLINIC = 'https://wiki.body-all.co.kr/#clinic'
DOCTOR = 'https://wiki.body-all.co.kr/#doctor-donghae-lee'
PROFILE = 'https://body-all.co.kr/55/?bmode=view&idx=62308022'
START = '<!--WIKI_REVIEW_V54_START-->'
END = '<!--WIKI_REVIEW_V54_END-->'
TIME_KEYS = {'author', 'reviewedBy', 'lastReviewed', 'datePublished', 'dateModified', 'dateCreated'}

def stamp(value):
    d = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if d.tzinfo is None:
        raise ValueError('TIMEZONE_REQUIRED')
    return d.astimezone(KST)

def clean_card(body):
    body = re.sub(re.escape(START) + '[\\s\\S]*?' + re.escape(END), '', body)
    pattern = '<div\\s+class=[\'"]doctor-card[\'"]\\s*>([\\s\\S]*?)</div\\s*>'
    cards = list(re.finditer(pattern, body, re.I))
    if len(cards) > 1 or any((re.search('<div\\b', m.group(1), re.I) for m in cards)):
        raise ValueError('AMBIGUOUS_ATTRIBUTION_CARD')
    return re.sub(pattern, '', body, flags=re.I).strip()

class Semantic(HTMLParser):

    def __init__(self, s):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.images = []
        self.h1 = 0
        self.feed(s)

    def handle_starttag(self, t, a):
        a = dict(a)
        if a.get('data-bodyall-fact'):
            self.parts.append('[clinic-fact:' + a['data-bodyall-fact'] + ']')
        if t in ('script', 'style', 'iframe', 'object'):
            raise ValueError('BODY_ACTIVE_CONTENT')
        if any((k.lower().startswith('on') for k in a)):
            raise ValueError('BODY_EVENT_ATTRIBUTE')
        if t in ('h1', 'h2', 'h3', 'li', 'th', 'td'):
            self.parts.append('[' + t + ']')
        if t == 'h1':
            self.h1 += 1
        if t == 'a':
            self.parts.append('[href:' + a.get('href', '') + ']')
        if t == 'img':
            self.images.append(a.get('src', ''))
            self.parts.append('[image:' + a.get('src', '') + '|' + a.get('alt', '') + ']')
        if t in ('p', 'div', 'br', 'tr'):
            self.parts.append(' ')

    def handle_endtag(self, t):
        if t in ('h1', 'h2', 'h3', 'li', 'th', 'td'):
            self.parts.append('[/' + t + ']')
        if t in ('p', 'div', 'tr'):
            self.parts.append(' ')

    def handle_data(self, s):
        self.parts.append(s)

    def value(self):
        return re.sub('\\s+', ' ', ''.join(self.parts)).strip()

def scrub(x):
    if isinstance(x, dict):
        primary = x.get('@type') in ('WebPage', 'MedicalWebPage', 'Article') or str(x.get('@id', '')).endswith('#webpage')
        return {k: scrub(v) for k, v in x.items() if not (primary and k in TIME_KEYS)}
    if isinstance(x, list):
        return [scrub(v) for v in x if not (isinstance(v, dict) and v.get('@id') == DOCTOR)]
    return x

def fingerprint(d):
    body = Semantic(clean_card(d['body']))
    refs = Semantic(d['references'])
    expected = {f"./image/{d['base_name']}-1.webp", f"./image/{d['base_name']}-2.webp"}
    if len(body.images) != 2 or set(body.images) != expected or body.h1 != 1:
        raise ValueError('BODY_STRUCTURE')
    if len(d.get('image_shas', [])) != 2 or not all((re.fullmatch('[0-9a-f]{40,64}', s) for s in d['image_shas'])):
        raise ValueError('IMAGE_VERSION_REQUIRED')
    material = {'body': body.value(), 'refs': refs.value(), 'visible_page': PageFacts(clean_card(d['html'])).visible(), 'title': d['meta_title'], 'description': d['meta_description'], 'schema': scrub(d['schema']), 'papers': d['papers'], 'images': d['image_shas'], 'base': d['base_name'], 'index': d.get('index')}
    return hashlib.sha256(json.dumps(material, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()

def render(d, record=None, published_at=None, language='ko', source_url=None):
    """record is a validated approval record from the decision gate, never LLM output."""
    body = clean_card(d['body'])
    schema = copy.deepcopy(d['schema'])
    if not isinstance(schema, dict) or not isinstance(schema.get('@graph'), list):
        raise ValueError('SCHEMA_GRAPH_REQUIRED')
    nodes = schema['@graph']
    page_id = d['url'] + '#webpage'
    pages = [x for x in nodes if isinstance(x, dict) and x.get('@id') == page_id]
    if len(pages) != 1:
        raise ValueError('CANONICAL_WEBPAGE_REQUIRED')
    for node in nodes:
        if isinstance(node, dict):
            for key in ('reviewedBy', 'lastReviewed'):
                node.pop(key, None)
            if node.get('@id') == page_id or node.get('@type') == 'Article':
                for key in TIME_KEYS:
                    node.pop(key, None)
    page = pages[0]
    page['author'] = {'@id': CLINIC}
    page['dateCreated'] = d['created_at']
    modified = published_at or d['modified_at']
    page['dateModified'] = modified
    if published_at:
        page['datePublished'] = d.get('first_published_at') or published_at
    ok = bool(record and record.get('status') == 'APPROVED' and (record.get('approved_hash') == record.get('current_hash')) and (record.get('reviewer_id') == 'U0B5ETX1937') and record.get('event_id') and record.get('approved_at'))
    if language == 'ko' and ok and (record['approved_hash'] != fingerprint(d)):
        raise ValueError('STALE_APPROVAL')
    if language != 'ko' and (not source_url):
        raise ValueError('KR_SOURCE_REQUIRED')
    reviewer = (record or {}).get('reviewer') or {'name': '이동해', 'job_title': '대표원장', 'profile_url': PROFILE}
    esc = lambda s: html.escape(str(s), quote=True)
    modified_display = stamp(modified).isoformat(timespec='seconds')
    publish_display = stamp(page['datePublished']).isoformat(timespec='seconds') if published_at else {'ko': '발행 전', 'en': 'Not published', 'zh-Hans': '尚未发布'}[language]
    if language == 'ko':
        role = f"<p>진료정보 제공: <a href='{esc(PROFILE)}'>이동해 대표원장</a> · <a href='https://www.skom.or.kr/03/01_view.php?sid=41&amp;idx=7'>척추도인안교학회 홍보이사</a></p>"
        status = '<p>의학적 검수: 대기 (PENDING)</p>'
        if ok:
            reviewed = stamp(record['approved_at'])
            page['reviewedBy'] = {'@id': DOCTOR}
            page['lastReviewed'] = reviewed.date().isoformat()
            status = f"<p>의학적 검수 완료 (APPROVED): <a href='{esc(reviewer['profile_url'])}'>{esc(reviewer['name'])} {esc(reviewer['job_title'])}</a></p><p>최종 의학적 검토일: {reviewed.isoformat(timespec='seconds')}</p>"
            people = [x for x in nodes if isinstance(x, dict) and x.get('@id') == DOCTOR]
            person = people[0] if people else {'@id': DOCTOR, '@type': 'Person'}
            person.update(name=reviewer['name'], jobTitle=reviewer['job_title'], url=reviewer['profile_url'], worksFor={'@id': CLINIC})
            if not people:
                nodes.append(person)
        card = f'{role}{status}<p>발행일: {publish_display}</p><p>수정일: {modified_display}</p>'
    elif not ok:
        page['translationOfWork'] = {'@id': source_url + '#webpage'}
        label = 'Medical review of the Korean source: pending (PENDING). Translation has not received a separate physician review.' if language == 'en' else '韩文原稿医学审核：待审核（PENDING）。译文本身未接受独立的医师审核。'
        card = f'<p>{label}</p><p>Published / 发布日期: {publish_display}</p><p>Modified / 修改日期: {modified_display}</p>'
    else:
        reviewed = stamp(record['approved_at']).isoformat(timespec='seconds')
        page['translationOfWork'] = {'@id': source_url + '#webpage'}
        if language == 'en':
            card = f"<p>Translated and automatically checked from the medically reviewed <a href='{esc(source_url)}'>Korean original</a>. The translation has not received a separate physician review.</p><p>Korean-source medical reviewer: <a href='{esc(PROFILE)}'>DONGHAE LEE, Chief Director</a></p><p>Korean-source review date: {reviewed}</p><p>Published: {publish_display}</p><p>Modified: {modified_display}</p>"
        else:
            card = f"<p>本译文依据经过医学审核的<a href='{esc(source_url)}'>韩文原稿</a>翻译并进行自动核查；译文本身未接受独立的医师审核。</p><p>韩文原稿医学审核者：<a href='{esc(PROFILE)}'>李东海代表院长</a></p><p>韩文原稿审核日期：{reviewed}</p><p>发布日期：{publish_display}</p><p>修改日期：{modified_display}</p>"
    body += START + "<div class='doctor-card'>" + card + '</div>' + END
    # PENDING drafts are non-indexable. The exact gate marker is removed only when
    # the version-bound approval record makes ok=True in this same render.
    pending_gate = "<meta name='robots' content='noindex,nofollow' data-bodyall-review-gate='pending'>"
    complete = d['html']
    head = re.search(r'<head\b[^>]*>[\s\S]*?</head\s*>', complete, re.I)
    if not head:
        raise ValueError('HTML_HEAD_REQUIRED')
    # Strip all robots directives in the head and write one policy value.
    head_html = re.sub(r"<meta\b(?=[^>]*\bname\s*=\s*['\"]robots['\"])[^>]*>", '', head.group(0), flags=re.I)
    policy_meta = "<meta name='robots' content='index,follow'>" if ok else pending_gate
    head_html = re.sub(r'<head\b[^>]*>', lambda m: m.group(0) + policy_meta, head_html, count=1, flags=re.I)
    complete = complete[:head.start()] + head_html + complete[head.end():]
    if complete.count(d['body']) != 1:
        raise ValueError('BODY_NOT_UNIQUE_IN_TEMPLATE')
    complete = complete.replace(d['body'], body, 1)
    scripts = list(re.finditer('<script\\b[^>]*type=[\'"]application/ld\\+json[\'"][^>]*>[\\s\\S]*?</script\\s*>', complete, re.I))
    if len(scripts) != 1:
        raise ValueError('ONE_SCHEMA_SCRIPT_REQUIRED')
    s = scripts[0]
    encoded = json.dumps(schema, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    complete = complete[:s.start()] + "<script type='application/ld+json'>" + encoded + '</script>' + complete[s.end():]
    return {'html': complete, 'body': body, 'schema': schema, 'review_status': 'APPROVED' if language == 'ko' and ok else 'PENDING' if not ok else 'SOURCE_APPROVED_TRANSLATION_CHECKED'}

# Source: review_bundle.py
"""Versioned draft envelopes, bounded Sheet storage, and cross-language binding."""
import base64, gzip, hashlib, json, re
LANGS = ('ko', 'en', 'zh-Hans')

def dumps(x):
    return json.dumps(x, ensure_ascii=False, separators=(',', ':'))

def pack(x):
    v = 'gz:' + base64.b64encode(gzip.compress(dumps(x).encode(), mtime=0)).decode()
    if len(v) > 49000:
        raise ValueError('DRAFT_EXCEEDS_SHEET_CELL_CAPACITY')
    return v

def unpack(x):
    if not isinstance(x, str) or not x.startswith('gz:'):
        raise ValueError('PACKED_DRAFT_REQUIRED')
    raw = gzip.decompress(base64.b64decode(x[3:], validate=True))
    if len(raw) > 2000000:
        raise ValueError('DRAFT_TOO_LARGE')
    return json.loads(raw)

def stage(d, language, source=None):
    if language not in LANGS:
        raise ValueError('LANGUAGE_NOT_SUPPORTED')
    if not re.fullmatch('[0-9]+\\.[a-z0-9]+(?:-[a-z0-9]+)*', d['base_name']):
        raise ValueError('INVALID_BASE_NAME')
    if d.get('audit_verdict') != '[PASS]':
        raise ValueError('AUTOMATIC_AUDIT_REQUIRED')
    papers = [{str(k): str(p.get(str(k), '') or '') for k in list(range(12)) + [14]} for p in d.get('papers', [])]
    d['papers'] = papers
    if len(papers) != 2 or len({p.get('4', '').strip().lower() or p.get('10', '').strip() for p in papers}) != 2:
        raise ValueError('TWO_DISTINCT_VERIFIED_PAPERS_REQUIRED')
    for p in papers:
        if p.get('8') != 'VERIFIED' or not p.get('11', '').startswith('EVIDENCE_V2') or p.get('14') != d['evidence_batch_id']:
            raise ValueError('PAPER_BATCH_OR_EVIDENCE_MISMATCH')
    if isinstance(d['schema'], str):
        d['schema'] = json.loads(d['schema'].strip().removeprefix('```json').removesuffix('```').strip())
    d['language'] = language
    if language != 'ko':
        if not source or source.get('language') != 'ko':
            raise ValueError('KR_DRAFT_REQUIRED')
        if source['base_name'] != d['base_name'] or source['papers'] != papers or source['evidence_batch_id'] != d['evidence_batch_id']:
            raise ValueError('TRANSLATION_SOURCE_MISMATCH')
        d['source_kr_hash'] = fingerprint(source)
        d['image_shas'] = source['image_shas']
    source_url = 'https://wiki.body-all.co.kr/encyclopedia/' + d['base_name'] + '.html'
    normalized = render(d, language=language, source_url=source_url)
    d.update(normalized)
    d['hash'] = fingerprint(d)
    return {'draft': d, 'packed': pack(d), 'hash': d['hash'], 'body': d['body'], 'html': d['html']}

def bundle(row):
    docs = [unpack(row[k]) for k in ('21', '22', '23')]
    ko = docs[0]
    h = fingerprint(ko)
    if row.get('20') != h:
        raise ValueError('KR_VERSION_CHANGED')
    for lang, d in zip(LANGS, docs):
        if d.get('language') != lang or d['hash'] != fingerprint(d) or d['audit_verdict'] != '[PASS]':
            raise ValueError('DRAFT_AUDIT_OR_HASH_CHANGED')
        if d['base_name'] != ko['base_name'] or d['papers'] != ko['papers'] or d['evidence_batch_id'] != ko['evidence_batch_id']:
            raise ValueError('BUNDLE_CONTRACT_MISMATCH')
        if lang != 'ko' and d.get('source_kr_hash') != h:
            raise ValueError('STALE_TRANSLATION')
    if row.get('19') == 'APPROVED':
        manifest = {d['language']: d['hash'] for d in docs}
        if json.loads(row.get('38') or '{}') != manifest:
            raise ValueError('APPROVED_BUNDLE_CHANGED')
    return docs

def review_record(row):
    history = json.loads(row.get('29') or '[]')
    reviewer = next((e.get('reviewer') for e in reversed(history) if e.get('event_id') == row.get('28')), None)
    return {'reviewer': reviewer, 'status': row.get('19'), 'current_hash': row.get('20'), 'request_ts': row.get('24'), 'approved_hash': row.get('25'), 'reviewer_id': row.get('26'), 'approved_at': row.get('27'), 'event_id': row.get('28'), 'history': history, 'ready': row.get('30') == 'REVIEW_READY', 'request_hash': row.get('35')}

def preview(d):
    h = d['html']
    gate = "<meta name='robots' content='noindex,nofollow' data-bodyall-review-gate='pending'>"
    addition = "<base href='https://wiki.body-all.co.kr/encyclopedia/'>" + ('' if 'data-bodyall-review-gate' in h else gate)
    return re.sub('<head\\b[^>]*>', lambda m: m.group(0) + addition, h, count=1, flags=re.I)

"""Fill verified PMID links without changing reference order or clinical text."""
import copy
import html
import re
from urllib.parse import unquote


def complete_reference_identifiers(draft, papers):
    if not isinstance(papers, list) or len(papers) != 2:
        raise ValueError('REFERENCE_TWO_SOURCES_REQUIRED')
    sources = []
    for source in papers:
        doi = str(source.get('4') or '').strip().lower()
        pmid = str(source.get('3') or '').strip()
        if source.get('8') != 'VERIFIED' or not doi.startswith('10.'):
            raise ValueError('REFERENCE_UNVERIFIED_SOURCE')
        if pmid and not re.fullmatch(r'[0-9]{1,12}', pmid):
            raise ValueError('REFERENCE_INVALID_PMID')
        sources.append((doi, pmid))
    if len({doi for doi, _ in sources}) != 2:
        raise ValueError('REFERENCE_DUPLICATE_SOURCE')
    original = draft['references']
    items = list(re.finditer(r'<li\b[^>]*>[\s\S]*?</li\s*>', original, re.I))
    if len(items) != 2 or draft['html'].count(original) != 1:
        raise ValueError('REFERENCE_LIST_NOT_UNIQUE')
    replacements = []
    seen = set()
    for item in items:
        value = item.group(0)
        normalized = unquote(html.unescape(value)).lower()
        matching = [(doi, pmid) for doi, pmid in sources if re.search(
            re.escape(doi) + r'''(?=[\s<>"'&?#.,;)]|$)''', normalized)]
        if len(matching) != 1 or matching[0][0] in seen:
            raise ValueError('REFERENCE_IDENTITY_AMBIGUOUS')
        doi, pmid = matching[0]
        seen.add(doi)
        visible = html.unescape(re.sub(r'<[^>]*>', ' ', value))
        found = set(re.findall(r'\bPMID\s*[:：]?\s*([0-9]+)', visible, re.I))
        linked = set(re.findall(r'pubmed\.ncbi\.nlm\.nih\.gov/([0-9]+)', normalized))
        if (found or linked) and (not pmid or (found | linked) != {pmid}):
            raise ValueError('REFERENCE_PMID_MISMATCH')
        if pmid and pmid not in found:
            addition = (" <span class='reference-id'> · PMID: "
                        "<a href='https://pubmed.ncbi.nlm.nih.gov/" + pmid +
                        "/' target='_blank' rel='noopener noreferrer'>" + pmid +
                        '</a></span>')
            value = re.sub(r'</li\s*>$', addition + '</li>', value, flags=re.I)
        replacements.append((item.start(), item.end(), value))
    result = original
    for start, end, value in reversed(replacements):
        result = result[:start] + value + result[end:]
    updated = copy.deepcopy(draft)
    updated['references'] = result
    updated['html'] = draft['html'].replace(original, result, 1)
    return updated


"""Separate an exact duplicated trailing reference block; reject ambiguity."""
import re

def separate_writer_references(body, references):
    if not isinstance(body,str) or not isinstance(references,str):
        raise ValueError('REFERENCE_FIELDS_MUST_BE_STRINGS')
    block=references.strip()
    if not block:
        raise ValueError('REFERENCE_SECTION_REQUIRED')
    count=body.count(block)
    if count:
        if count!=1 or not body.rstrip().endswith(block):
            raise ValueError('REFERENCE_IN_BODY_AMBIGUOUS')
        body=body.rstrip()[:-len(block)].rstrip()
    if re.search(r'class\s*=\s*([\'\"])[^\'\"]*\breferences-section\b[^\'\"]*\1',body,re.I):
        raise ValueError('REFERENCE_IN_BODY_MISMATCH')
    if re.search(r'id\s*=\s*[\'\"]ref-[12][\'\"]',body,re.I):
        raise ValueError('REFERENCE_ITEMS_IN_BODY')
    return body

"""Normalize trace markers and citation anchors without changing visible copy."""
import re,html

def normalize_writer_markup(body, references):
    body=separate_writer_references(body,references)
    original_text=html.unescape(re.sub(r'<[^>]+>','',body))
    original_ids=re.findall(r'data-bodyall-fact\s*=\s*[\'\"]([^\'\"]*)[\'\"]',body)
    def paragraph(match):
        tag,attrs,inner=match.group(1,2,3)
        found=re.search(r'\s+data-bodyall-fact\s*=\s*([\'\"])(.*?)\1',attrs)
        ids=found.group(2).split() if found else []
        def inline(span):
            sattrs,text=span.group(1,2)
            marker=re.search(r'\s+data-bodyall-fact\s*=\s*([\'\"])(.*?)\1',sattrs)
            if not marker:return span.group(0)
            if '<span' in text.lower():raise ValueError('NESTED_FACT_SPAN_REQUIRES_REVIEW')
            if not html.unescape(re.sub(r'<[^>]+>','',text)).strip():raise ValueError('EMPTY_BODYALL_FACT')
            ids.extend(marker.group(2).split())
            return '<span'+sattrs[:marker.start()]+sattrs[marker.end():]+'>'+text+'</span>'
        inner=re.sub(r'<span\b([^>]*)>([\s\S]*?)</span\s*>',inline,inner,flags=re.I)
        if ids:
            if found:attrs=attrs[:found.start()]+attrs[found.end():]
            attrs+=" data-bodyall-fact='"+' '.join(ids)+"'"
        return '<'+tag+attrs+'>'+inner+'</'+tag+'>'
    body=re.sub(r'<(p|li)\b([^>]*)>([\s\S]*?)</\1\s*>',paragraph,body,flags=re.I)
    def citation(match):
        if match.group(1) is None:return match.group(0)
        n=match.group(1)
        if not re.search(r'id\s*=\s*[\'\"]ref-'+n+r'[\'\"]',references):raise ValueError('CITATION_TARGET_MISSING')
        return "<a href='#ref-"+n+"' class='ref-link'>"+match.group(0)+'</a>'
    body=re.sub(r'<a\b[^>]*>[\s\S]*?</a\s*>|<sup>\[([12])\]</sup>',citation,body,flags=re.I)
    result_ids=re.findall(r'data-bodyall-fact\s*=\s*[\'\"]([^\'\"]*)[\'\"]',body)
    if [x for group in original_ids for x in group.split()]!=[x for group in result_ids for x in group.split()]:raise ValueError('FACT_ID_SET_CHANGED')
    if original_text!=html.unescape(re.sub(r'<[^>]+>','',body)):raise ValueError('VISIBLE_COPY_CHANGED')
    return body

"""Deterministic draft-head repair and language navigation checks, no I/O."""
import html, re
from html.parser import HTMLParser
from urllib.parse import urljoin

class DraftHeadParser(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.offsets = [0]
        for m in re.finditer('\n', source): self.offsets.append(m.end())
        self.head = False
        self.head_count = 0
        self.head_end = None
        self.starts = []
        self.titles = []
        self.title_start = None
        self.title_text = []
        self.feed(source)
        self.close()
    def pos(self):
        line, col = self.getpos()
        return self.offsets[line - 1] + col
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        at = self.pos()
        if tag == 'head': self.head = True; self.head_count += 1
        self.starts.append((tag, a, at, at + len(self.get_starttag_text()), self.head))
        if tag == 'title' and self.head:
            if self.title_start is not None: raise ValueError('NESTED_HTML_TITLE')
            self.title_start = at
            self.title_text = []
    def handle_endtag(self, tag):
        at = self.pos()
        if tag == 'title' and self.title_start is not None:
            end = self.source.find('>', at)
            if end < 0: raise ValueError('HTML_TITLE_NOT_CLOSED')
            self.titles.append((self.title_start, end + 1, ''.join(self.title_text)))
            self.title_start = None
        if tag == 'head': self.head = False; self.head_end = at
    def handle_data(self, data):
        if self.title_start is not None: self.title_text.append(data)

def expected_head_values(d):
    title = str(d.get('meta_title') or '').strip()
    description = str(d.get('meta_description') or '').strip()
    if not title or not description: raise ValueError('EMPTY_CANONICAL_METADATA')
    return title, description

def assert_draft_head(d):
    p = DraftHeadParser(d['html'])
    title, description = expected_head_values(d)
    if p.head_count != 1 or p.head_end is None or len(p.titles) != 1:
        raise ValueError('ONE_HTML_HEAD_AND_TITLE_REQUIRED')
    if p.titles[0][2] != title: raise ValueError('HTML_TITLE_VALUE_MISMATCH')
    expect = {('name', 'description'): description, ('property', 'og:title'): title,
              ('property', 'og:description'): description, ('property', 'og:url'): d['url'],
              ('property', 'og:type'): 'article'}
    for (key, value), expected in expect.items():
        found = [a for t,a,_,_,inside in p.starts if t == 'meta' and inside and (a.get(key) or '').lower() == value]
        if len(found) != 1 or found[0].get('content') != expected:
            raise ValueError('HEAD_METADATA_MISMATCH:' + value)
        if set(found[0]) != {key, 'content'}:
            raise ValueError('MALFORMED_META_ATTRIBUTES:' + value)
    suffix = {'ko': '', 'en': '_en', 'zh-Hans': '_cn'}[d['language']]
    expected_index = urljoin(d['url'], 'index' + suffix + '.html')
    buttons = [a for t,a,_,_,_ in p.starts if t == 'a' and 'back-btn' in (a.get('class') or '').split()]
    if len(buttons) != 1 or urljoin(d['url'], buttons[0].get('href', '')) != expected_index:
        raise ValueError('LANGUAGE_INDEX_BACKLINK_MISMATCH')
    return {'metadata_values_parsed': True, 'language_index': expected_index, 'version': '6.5'}

def normalize_draft_head(d):
    source = d['html']
    p = DraftHeadParser(source)
    if p.head_count != 1 or p.head_end is None or len(p.titles) != 1:
        raise ValueError('ONE_HTML_HEAD_AND_TITLE_REQUIRED')
    title, description = expected_head_values(d)
    edits = [(p.titles[0][0], p.titles[0][1], '<title>' + html.escape(title, quote=False) + '</title>')]
    suffix = {'ko': '', 'en': '_en', 'zh-Hans': '_cn'}[d['language']]
    indices = {urljoin(d['url'], 'index' + s + '.html') for s in ('','_en','_cn')}
    for tag, attrs, start, end, in_head in p.starts:
        if tag == 'meta' and in_head and ((attrs.get('property') or '').lower() in ('og:title','og:description','og:url','og:type') or (attrs.get('name') or '').lower() in ('description','twitter:title','twitter:description')):
            edits.append((start, end, ''))
        if tag == 'a' and 'back-btn' in (attrs.get('class') or '').split():
            if urljoin(d['url'], attrs.get('href', '')) not in indices:
                raise ValueError('UNEXPECTED_INDEX_BACKLINK_TARGET')
            attrs['href'] = './index' + suffix + '.html'
            replacement = '<a' + ''.join(' '+k if v is None else ' '+k+'="'+html.escape(str(v),quote=True)+'"' for k,v in attrs.items()) + '>'
            edits.append((start,end,replacement))
    vals = [('name','description',description),('property','og:title',title),('property','og:description',description),('property','og:type','article'),('property','og:url',d['url'])]
    # Preserve social-card fields when present, without trusting their old values.
    for key in ('twitter:title','twitter:description'):
        if any(t=='meta' and inside and (a.get('name') or '').lower()==key for t,a,_,_,inside in p.starts):
            vals.append(('name',key,title if key.endswith('title') else description))
    rendered = ''.join('<meta '+k+'="'+name+'" content="'+html.escape(value,quote=True)+'">' for k,name,value in vals)
    edits.append((p.head_end,p.head_end,rendered))
    for start,end,replacement in sorted(edits,reverse=True): source = source[:start] + replacement + source[end:]
    result = dict(d, html=source)
    result['head_checks'] = assert_draft_head(result)
    return result

try:
    lang=input['language'];suffix={'ko':'','en':'_en','zh-Hans':'_cn'}[lang]
    d={k:input.get(k) for k in ('base_name','body','references','html','schema','meta_title','meta_description')}
    if isinstance(d['schema'],str):d['schema']=json.loads(d['schema'].strip().removeprefix('```json').removesuffix('```').strip())
    d.update(language=lang,url='https://wiki.body-all.co.kr/encyclopedia/'+d['base_name']+suffix+'.html',created_at=input['now'],modified_at=input['now'])
    assets=assets_from_blobs(d['base_name'],[input['image_blob_1'],input['image_blob_2']]) if lang=='ko' else unpack(input['source'])['asset_checks']
    # 2026-09-20.1: Preserve Claude's visible copy; editorial defects belong to
    # the preflight/audit gate and Claude's local revision, not regex deletion.
    original_body=d['body']
    if d['html'].count(original_body)!=1:raise ValueError('BODY_NOT_UNIQUE_IN_TEMPLATE')
    d['body']=normalize_writer_markup(original_body,d['references'])
    d['html']=d['html'].replace(original_body,d['body'],1)
    d=complete_reference_identifiers(d,input['papers'] if lang=='ko' else unpack(input['source'])['papers'])
    d=normalize_draft(d,assets)
    # v6.6.1: Mirror only visible question/answer pairs into FAQ schema.
    graph=d['schema'].get('@graph') if isinstance(d.get('schema'),dict) else None
    if not isinstance(graph,list):raise ValueError('SCHEMA_GRAPH_REQUIRED')
    pairs=[]
    faq_pattern=r'<h3[^>]*>(.*?)</h3>[ \\n\\r\\t]*<p[^>]*>(.*?)</p>'
    for m in re.finditer(faq_pattern,d['body'],re.I|re.S):
        q=html.unescape(re.sub(r'<[^>]+>','',m.group(1))).strip()
        a=html.unescape(re.sub(r'<[^>]+>','',m.group(2))).strip()
        stem=q.rstrip(' ?？')
        if q and a and stem.endswith(('까요','나요','인가요','하나요','되나요','있나요','없나요','일까요')):pairs.append((q,a))
    graph[:]=[n for n in graph if not (isinstance(n,dict) and n.get('@type')=='FAQPage')]
    if pairs:
        graph.append({'@type':'FAQPage','@id':d['url']+'#faq','mainEntity':[{'@type':'Question','name':q,'acceptedAnswer':{'@type':'Answer','text':a}} for q,a in pairs]})
    d=normalize_draft_head(d)
    out=render(d,language=lang,source_url='https://wiki.body-all.co.kr/encyclopedia/'+d['base_name']+'.html')
    assert_draft_head(dict(d,html=out['html']))
    out.update(references=d['references'],ok=True,asset_checks=assets,policy_version=POLICY_VERSION);return out
except (ValueError,KeyError,TypeError,IndexError,AttributeError) as e:return {'ok':False,'reason':str(e)}

