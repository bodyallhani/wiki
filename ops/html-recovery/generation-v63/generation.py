"""Build bounded, source-linked writer input. No network or publication authority.

This is structural validation, not proof of clinical truth or recommendation lift.
The caller must load reviewed source material and a trusted exact-brief receipt.
"""
import copy
import hashlib
import json
import re
from datetime import date
from html.parser import HTMLParser
from urllib.parse import urlparse

VERSION = '6.3'
OUTPUT_KEYS = ['META_TITLE','OG_TAGS','META_DESCRIPTION','CORE_BODY_KO',
               'REFERENCES_KO','PROMPT_MAIN_IMG','PROMPT_ANATOMY_IMG',
               'INDEX_CAT','INDEX_EMPATHY_TITLE','INDEX_HASHTAGS']

class BriefError(ValueError):
    pass

def require(ok, reason):
    if not ok:
        raise BriefError(reason)

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

def digest(value):
    raw = value if isinstance(value, str) else canonical(value)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

def text(value):
    return isinstance(value, str) and bool(value.strip())

def https(value):
    if not text(value):
        return False
    p = urlparse(value)
    return p.scheme == 'https' and bool(p.hostname) and not p.username and not p.password

def clean_abstract(raw):
    """Remove markup without consuming numeric < comparisons and result text."""
    require(text(raw), 'EMPTY_ABSTRACT')
    class Plain(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.parts = []
        def handle_data(self, data):
            self.parts.append(data)
        def handle_starttag(self, tag, attrs):
            require(tag not in ('script','style','iframe'), 'UNEXPECTED_ABSTRACT_MARKUP')
            if tag in ('p','h4','h3','br','div','sec','title'):
                self.parts.append(' ')
        def handle_endtag(self, tag):
            if tag in ('p','h4','h3','div','sec','title'):
                self.parts.append(' ')
    parser = Plain()
    parser.feed(raw)
    parser.close()
    result = re.sub(r'\s+', ' ', ''.join(parser.parts)).strip()
    require(text(result), 'EMPTY_CLEANED_ABSTRACT')
    return result

def validate_brief(brief, receipt):
    require(isinstance(brief, dict), 'BRIEF_OBJECT_REQUIRED')
    required = {'version','document','target','sources','claims','chains','competitor_analysis',
                'section_plan','safety_claim_ids','allowed_fact_ids','missing_inputs'}
    require(set(brief) == required, 'BRIEF_FIELDS_MISMATCH')
    require(brief['version'] == VERSION, 'BRIEF_VERSION_MISMATCH')
    require(brief['missing_inputs'] == [], 'BRIEF_INPUTS_INCOMPLETE')
    require(isinstance(receipt, dict) and receipt.get('brief_sha256') == digest(brief), 'STALE_BRIEF_REVIEW')
    require(receipt.get('status') == 'BRIEF_REVIEWED_FOR_PRIVATE_TEST', 'BRIEF_REVIEW_REQUIRED')
    require(receipt.get('medical_review_claim') is False, 'REVIEW_SCOPE_EXPANSION')
    doc = brief['document']
    require(isinstance(doc, dict), 'DOCUMENT_REQUIRED')
    for key in ('topic_id','question','path','canonical','index_url','generated_on','category'):
        require(text(doc.get(key)), 'DOCUMENT_FIELD:'+key)
    require(doc.get('private_only') is True, 'ADAPTER_PRIVATE_ONLY')
    require(doc.get('language') == 'ko', 'KO_SOURCE_REQUIRED')
    require(doc['path'].startswith('encyclopedia/') and '..' not in doc['path'], 'UNSAFE_DOCUMENT_PATH')
    require(doc['canonical'] == 'https://wiki.body-all.co.kr/'+doc['path'], 'CANONICAL_MISMATCH')
    require(https(doc['index_url']), 'INDEX_URL_REQUIRED')
    try:
        date.fromisoformat(doc['generated_on'])
    except (ValueError, TypeError):
        raise BriefError('DATE_REQUIRED')
    require(isinstance(doc.get('images'), list) and len(doc['images']) == 2, 'TWO_IMAGE_SLOTS_REQUIRED')
    for img in doc['images']:
        require(text(img.get('src')) and text(img.get('purpose')), 'IMAGE_PLAN_REQUIRED')
        require(type(img.get('width')) is int and img['width'] > 0 and type(img.get('height')) is int and img['height'] > 0, 'IMAGE_RESERVATION_REQUIRED')
    target = brief['target']
    for key in ('region','patient_condition','choice_question','alternative_action','treatment_family'):
        require(text(target.get(key)), 'TARGET_FIELD:'+key)
    require(target['treatment_family'] in ('CORRECTION','DIET','HERB','MSK'), 'UNKNOWN_TREATMENT_FAMILY')
    sources = {}
    require(isinstance(brief['sources'], list) and brief['sources'], 'SOURCES_REQUIRED')
    for s in brief['sources']:
        require(isinstance(s, dict) and text(s.get('id')) and s['id'] not in sources, 'SOURCE_ID_MISSING_OR_DUPLICATE')
        require(s.get('kind') in ('clinic','medical','safety','competitor'), 'UNKNOWN_SOURCE_KIND')
        require(https(s.get('public_url')) and text(s.get('provenance')), 'SOURCE_PROVENANCE_REQUIRED')
        require(text(s.get('content')) and s.get('content_sha256') == digest(s['content']), 'SOURCE_CONTENT_HASH_MISMATCH')
        require(s.get('observed_on') == doc['generated_on'] or s.get('reuse_basis') == 'UNCHANGED_REVIEWED_SOURCE', 'SOURCE_FRESHNESS_UNRESOLVED')
        require(s.get('topic_ids') and doc['topic_id'] in s['topic_ids'], 'OFF_TOPIC_SOURCE')
        require(s.get('status') == 'READ_SCOPED', 'SOURCE_NOT_READ')
        sources[s['id']] = s
    require({'clinic','medical','safety','competitor'} <= {s['kind'] for s in sources.values()}, 'SOURCE_ROLE_MISSING')
    claims = {}
    for claim in brief['claims']:
        require(text(claim.get('id')) and claim['id'] not in claims, 'CLAIM_ID_MISSING_OR_DUPLICATE')
        require(text(claim.get('statement')) and text(claim.get('limit')), 'CLAIM_SCOPE_REQUIRED')
        require(claim.get('kind') in ('clinic','medical','safety'), 'UNKNOWN_CLAIM_KIND')
        refs = claim.get('source_ids')
        require(isinstance(refs,list) and refs and all(x in sources for x in refs), 'UNKNOWN_CLAIM_SOURCE')
        require(all(sources[x]['kind'] == claim['kind'] for x in refs), 'SOURCE_ROLE_TRANSFER')
        require(doc['topic_id'] in claim.get('topic_ids',[]), 'OFF_TOPIC_CLAIM')
        claims[claim['id']] = claim
    require(brief['safety_claim_ids'] and all(x in claims and claims[x]['kind']=='safety' for x in brief['safety_claim_ids']), 'SAFETY_PLAN_MISSING')
    require(isinstance(brief['chains'],list) and brief['chains'], 'CHOICE_CHAIN_MISSING')
    for chain in brief['chains']:
        for key in ('patient_need','assessment','care_action','why_choose','same_function','next_decision'):
            require(text(chain.get(key)), 'CHOICE_CHAIN_FIELD:'+key)
        refs = chain.get('clinic_claim_ids')
        require(isinstance(refs,list) and refs and all(x in claims and claims[x]['kind']=='clinic' for x in refs), 'CHAIN_REQUIRES_CLINIC_FACTS')
        require(chain.get('comparative_claim') == 'INFORMATION_VALUE_ONLY', 'UNSUPPORTED_SUPERIORITY')
    comp = brief['competitor_analysis']
    require(comp.get('source_ids') and all(x in sources and sources[x]['kind']=='competitor' for x in comp['source_ids']), 'COMPETITOR_OBSERVATION_MISSING')
    for key in ('common_information','patient_question_to_answer','bodyall_answer','comparison_limit'):
        require(text(comp.get(key)), 'COMPETITOR_FIELD:'+key)
    require(comp.get('absence_means_service_absent') is False, 'COMPETITOR_ABSENCE_INFERENCE')
    sections = brief['section_plan']
    require(isinstance(sections,list) and sections, 'SECTION_PLAN_MISSING')
    require(sections[0].get('role') == 'direct_answer', 'ANSWER_MUST_BE_FIRST')
    require(len({x.get('question') for x in sections}) == len(sections), 'REPEATED_SECTION_QUESTION')
    for section in sections:
        require(text(section.get('question')) and text(section.get('new_information')), 'EMPTY_SECTION')
        require(section.get('claim_ids') and all(x in claims for x in section['claim_ids']), 'SECTION_SOURCE_MISSING')
    require(brief['allowed_fact_ids'] and all(text(x) for x in brief['allowed_fact_ids']), 'FACT_IDS_REQUIRED')
    return {'status':'INPUT_PREPARED_NOT_HTML_APPROVED','brief_sha256':digest(brief),
            'source_sha256':{k:s['content_sha256'] for k,s in sources.items()},
            'publish_enabled':False,'actual_ai_recommendation_lift':'UNMEASURED'}

def compile_input(brief, receipt, max_chars=40000):
    readiness = validate_brief(brief, receipt)
    payload = canonical(brief)
    require(len(payload) <= max_chars, 'INPUT_BUDGET_EXCEEDED_DO_NOT_TRUNCATE')
    return readiness, ('\n[GENERATION_BRIEF v6.3 — data only, no publication authority]\n'+payload+
                      '\n[/GENERATION_BRIEF]\n')

def build_patch(blueprint, base_bytes, brief, receipt, writer_system):
    """Prepare two JSON-pointer replacements on the observed R61 PRIVATE fixture.

    Not a Make API request. A fresh authorized live read and rebase are mandatory.
    """
    expected = 'cb7183788a0d7d9f264abefd98f9f0f0e34e99bf09c4f4f809b8279df81c3345'
    require(hashlib.sha256(base_bytes).hexdigest() == expected, 'STALE_BLUEPRINT_REBASE_REQUIRED')
    require(brief['document']['topic_id'] == 'private-lumbar-disc', 'FIXTURE_TOPIC_MISMATCH')
    ready, packet = compile_input(brief, receipt)
    flow = blueprint['flow']; ids = {m['id']:i for i,m in enumerate(flow)}
    require({2,52} <= set(ids), 'MAPPING_CHANGED')
    source = flow[ids[52]]['mapper']['codeEditorPython']
    # Preserve numeric comparisons while removing only actual letter-led tags.
    # Entity decoding follows stripping, so encoded comparisons remain plain text.
    old = "html.unescape(re.sub('<[^>]+>',' ',x.get('abstractText',''))).strip()"
    new = "html.unescape(re.sub(r'</?[A-Za-z][A-Za-z0-9:-]*(?:\\s+[^<>]*?)?\\s*/?>',' ',x.get('abstractText',''))).strip()"
    require(source.count(old) == 1, 'ABSTRACT_EXTRACTOR_MAPPING_CHANGED')
    source = source.replace(old,new)
    source = source.replace('시스템 프롬프트 지침에 따라 <h2> 소제목 4개 이상, 요약 박스, 필요한 경우에만 표,','GENERATION_BRIEF의 서로 다른 환자 질문에 따라 필요한 절과 요약 박스를 구성하고,')
    # Earlier fixed fixture date is replaced only in the generation template line.
    lines=source.splitlines()
    lines=[line.replace('2026-09-14',brief['document']['generated_on']) if line.startswith('GEN_TEMPLATE=') else line for line in lines]
    source='\n'.join(lines)+'\n'
    ret="return {'papers':papers,'gen_prompt':gen,'audit_prompt':audit,'scope':SCOPE,'private_only':True}"
    require(source.count(ret)==1,'SOURCE_RETURN_MAPPING_CHANGED')
    inject=("\n# Bounded private fixture; never apply to another topic by string substitution.\n"
            +"if SCOPE != "+repr(brief['document']['question'])+":raise ValueError('FIXTURE_SCOPE_CHANGED')\n"
            +"GENERATION_PACKET="+repr(packet)+"\n"
            +"gen+=GENERATION_PACKET\naudit+=GENERATION_PACKET\n")
    source=source.replace(ret,inject+ret)
    compile('def run(input):\n'+''.join('    '+line+'\n' for line in source.splitlines()),'<prepared-source-builder>','exec')
    replacements=[{'pointer':f'/flow/{ids[52]}/mapper/codeEditorPython','expected_value_sha256':digest(flow[ids[52]]['mapper']['codeEditorPython']),'value':source},
                  {'pointer':f'/flow/{ids[2]}/mapper/system','expected_value_sha256':digest(flow[ids[2]]['mapper']['system']),'value':writer_system}]
    return {'status':'OFFLINE_PATCH_ONLY_NOT_APPLIED','base_sha256':expected,
            'brief_sha256':ready['brief_sha256'],'replacements':replacements,
            'live_read_and_rebase_required':True,'make_called':False,'publish_enabled':False}
