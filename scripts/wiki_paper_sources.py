"""Bounded primary-source retrieval for private Make evidence-stage tests.

Metadata identity is checked independently of the model's relevance judgement.
No writes or messages; missing source text never becomes verified evidence.
"""
import concurrent.futures
import html
import json
import re
import urllib.parse
import urllib.request


def plain(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'</?[A-Za-z][^>]*>', ' ', s or ''))).strip()


def title_key(s):
    return re.sub(r'[^a-z0-9]', '', plain(s).lower())


def quote_options(source):
    """Return contiguous source excerpts; the model selects an index, not new words."""
    result = []
    for sentence in re.split(r'(?<=[.!?])\s+', plain(source)):
        parts = [sentence] if len(sentence.split()) <= 25 else re.split(r'(?<=[,;])\s+', sentence)
        for part in parts:
            if 6 <= len(part.split()) <= 25 and part not in result:
                result.append(part)
    return result[:32]


def get_json(url):
    if not url.startswith(('https://www.ebi.ac.uk/europepmc/webservices/rest/', 'https://api.crossref.org/works/')):
        raise ValueError('SOURCE_HOST_NOT_ALLOWED')
    req = urllib.request.Request(url, headers={'User-Agent': 'BodyallEvidenceAudit/1.0', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=6) as r:
        raw = r.read(3_000_001)
    if len(raw) > 3_000_000:
        raise ValueError('SOURCE_RESPONSE_TOO_LARGE')
    return json.loads(raw)


def queries(plan):
    query = plan['paper_search_query'].strip()
    if not query:
        raise ValueError('EMPTY_PAPER_QUERY')
    context = (plan.get('slug', '') + ' ' + plan.get('angle_instruction', '')).lower()
    population = ' AND TITLE_ABS:(postpartum OR postnatal OR "post-partum")' if 'postpartum' in context else ''
    condition = query.split(' AND ', 1)[0]
    return list(dict.fromkeys([
        'TITLE_ABS:(' + query + ')' + population,
        'TITLE_ABS:(' + condition + ')' + population + ' AND TITLE_ABS:(guideline OR "systematic review" OR "meta-analysis")',
        'TITLE_ABS:(' + condition + ')' + population + ' AND TITLE_ABS:(manipulat* OR mobiliz* OR mobilis* OR osteopath* OR chiropract* OR chuna OR tuina) sort_cited:y',
    ]))


def canonical(epmc):
    doi = str(epmc.get('doi') or '').lower().strip()
    abstract = plain(epmc.get('abstractText'))
    if not doi or len(abstract) < 150 or epmc.get('isRetracted') == 'Y':
        return None
    cr = get_json('https://api.crossref.org/works/' + urllib.parse.quote(doi, safe=''))['message']
    title = (cr.get('title') or [''])[0]
    if cr.get('DOI', '').lower() != doi or title_key(title) != title_key(epmc.get('title')):
        return None
    if cr.get('type') not in ('journal-article', 'report'):
        return None
    for relation in cr.get('update-to', []):
        if 'retract' in str(relation.get('type', '')).lower():
            return None
    year = str(cr.get('issued', {}).get('date-parts', [['']])[0][0])
    authors = cr.get('author') or []
    author = authors[0].get('family', authors[0].get('name', '')) if authors else ''
    if not author or not year:
        return None
    return {'title': plain(title), 'doi': doi, 'pmid': str(epmc.get('id', '')) if epmc.get('source') == 'MED' else '',
            'journal': plain((cr.get('container-title') or [''])[0]),
            'authors_year': author + (', et al.' if len(authors) > 1 else '') + ' (' + year + ')',
            'url': 'https://doi.org/' + doi, 'source_name': 'Europe PMC abstract',
            'source_record': abstract, 'identity_check': 'Crossref DOI and normalized title equal Europe PMC',
            'source_types': epmc.get('pubTypeList', {}).get('pubType', [])}


def retrieve_sources(plan, corpus=None):
    found, batches = {}, []
    search_queries = queries(plan)
    for q in search_queries:
        params = urllib.parse.urlencode({'query': '(' + q + ') AND SRC:MED', 'format': 'json', 'resultType': 'core', 'pageSize': 20})
        result = get_json('https://www.ebi.ac.uk/europepmc/webservices/rest/search?' + params)
        batches.append(result.get('resultList', {}).get('result', []))
    # Round-robin query groups so newer broad records do not crowd out direct studies.
    for offset in range(20):
        for batch in batches:
            if offset >= len(batch):
                continue
            item = batch[offset]
            if item.get('doi') and item.get('abstractText'):
                found.setdefault(item['doi'].lower(), item)
    # Verify the most directly relevant returned candidates from both query types.
    pool, failures = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(canonical, e): doi for doi, e in list(found.items())[:16]}
        for future in concurrent.futures.as_completed(futures):
            try:
                item = future.result()
                if item:
                    identifiers = {item['doi']}
                    if item['pmid']:
                        identifiers.add('pmid:' + item['pmid'])
                    item['used_by'] = [d['path'] for d in (corpus or {}).get('documents', []) if identifiers.intersection(r.lower() for r in d.get('references', []))]
                    pool.append(item)
            except Exception as exc:
                failures.append({'doi': futures[future], 'reason': type(exc).__name__+':'+str(getattr(exc,'code',''))})
    pool.sort(key=lambda p: (not any('review' in t.lower() or 'guideline' in t.lower() for t in p['source_types']), p['doi']))
    return {'queries': search_queries, 'candidates': pool[:8], 'identity_failures': failures,
            'search_exhaustive': False, 'ok': len(pool) >= 2}


def fixture_from_selection(plan, pool, selection, number='0028'):
    selected = selection.get('verified_papers', [])
    if len(selected) != 2 or any(p.get('verification_status') != 'VERIFIED' for p in selected):
        return {'ok': False, 'reason': 'EVIDENCE_GAP', 'selection': selection}
    by_doi = {p['doi']: p for p in pool['candidates']}
    papers, used, roles = [], set(), set()
    for p in selected:
        doi = p['doi'].lower().strip()
        if doi in used or doi not in by_doi:
            raise ValueError('UNVERIFIED_OR_DUPLICATE_DOI')
        src = by_doi[doi]
        if title_key(p['title']) != title_key(src['title']) or str(p.get('pmid') or '') != src['pmid']:
            raise ValueError('MODEL_BIBLIOGRAPHY_MISMATCH')
        reason = p['reason']
        if 'source_quote_index' in p:
            options = src.get('quote_options') or quote_options(src['source_record'])
            index = p['source_quote_index']
            if type(index) is not int or not 0 <= index < len(options):
                raise ValueError('SOURCE_QUOTE_INDEX_INVALID')
            reason = re.sub(r'\s*;?\s*SOURCE_QUOTE\s*=.*', '', reason, flags=re.S)
            reason += '; SOURCE_QUOTE=' + options[index]
        match = re.search(r'SOURCE_QUOTE\s*=\s*([^\n]+)', reason)
        quote = match.group(1).strip().rstrip(';').strip().strip('"') if match else ''
        if not quote or plain(quote) not in plain(src['source_record']) or len(quote.split()) > 25:
            raise ValueError('SOURCE_QUOTE_NOT_VERIFIABLE')
        if 'EVIDENCE_V2' not in reason:
            raise ValueError('EVIDENCE_CONTRACT_REQUIRED')
        role = re.search(r'\bROLE\s*=\s*(TREATMENT|BACKGROUND)\b', reason)
        if not role:
            raise ValueError('EVIDENCE_ROLE_REQUIRED')
        roles.add(role.group(1))
        used.add(doi)
        paper = {'0':src['title'], '1':src['authors_year'], '2':src['journal'], '3':src['pmid'], '4':doi,
                 '5':p['bridge_ko'], '6':p['bridge_en'], '7':p['bridge_zh'], '8':'VERIFIED', '9':plan['slug'],
                 '10':src['url'], '11':reason+'\nSOURCE: '+src['source_name']+'\nSOURCE_DOI: '+doi+'\nSOURCE_RECORD:\n'+src['source_record'],
                 '14':number+'.'+plan['slug']+'-private-quality-20260924'}
        papers.append(paper)
    if 'TREATMENT' not in roles:
        raise ValueError('TWO_BACKGROUND_SOURCES_NOT_ALLOWED')
    return {'ok':True,'fixture':{'filename':number+'.'+plan['slug'],'keyword':plan['slug'],'treatment':plan['treatment_name'],
            'topic':plan['sub_topic'],'angle':plan['angle_instruction'],'papers':papers}, 'selection':selection}
