"""Public-corpus retrieval and fail-closed quality receipts for the Make writers.

Only public pages are fetched. This module neither publishes nor sends messages.
Similarity is an editorial review signal, not a search-engine ranking prediction.
The same source is embedded in Make Code; keep runtime dependencies in the stdlib.
"""
import base64
import concurrent.futures
import datetime as dt
import hashlib
import html
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import re
import time
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zlib

POLICY = "bodyall-content-guard-20260924.1"
ORIGIN = "https://wiki.body-all.co.kr/"
REPOSITORY = "https://api.github.com/repos/bodyallhani/wiki/"
RAW = "https://raw.githubusercontent.com/bodyallhani/wiki/"
VOID = set("area base br col embed hr img input link meta param source track wbr".split())


def digest(value):
    if not isinstance(value, str):
        value = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize(value):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", html.unescape(value))).strip()


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.all_text, self.main_text = [], [], []
        self.title, self.headings, self.links, self.alternates = [], [], [], {}
        self.canonical, self.lang, self.noindex = "", "", False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang", "")
        if tag == "meta" and a.get("name", "").lower() == "robots":
            self.noindex = "noindex" in a.get("content", "").lower()
        if tag == "link":
            if "canonical" in a.get("rel", ""):
                self.canonical = a.get("href", "")
            if a.get("hreflang"):
                self.alternates[a["hreflang"]] = a.get("href", "")
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        blocked = tag in {"script", "style", "nav", "header", "footer", "noscript", "form"}
        blocked = blocked or bool(set(a.get("class", "").split()) & {"doctor-card", "lang-switch", "language-switcher", "breadcrumb"})
        if tag not in VOID:
            self.stack.append((tag, blocked))
        if tag in {"p", "h1", "h2", "h3", "li", "tr", "div", "section", "br"}:
            self.all_text.append("\n")
            self.main_text.append("\n")

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break
        if tag in {"p", "h1", "h2", "h3", "li", "tr"}:
            self.all_text.append("\n")
            self.main_text.append("\n")

    def handle_data(self, data):
        tags = {t for t, _ in self.stack}
        if "title" in tags:
            self.title.append(data)
        if any(b for _, b in self.stack) or "head" in tags:
            return
        if tags & {"h1", "h2", "h3"}:
            self.headings.append(data)
        self.all_text.append(data)
        if tags & {"main", "article"}:
            self.main_text.append(data)


def parse_page(source, path="candidate.html"):
    p = Page()
    p.feed(source)
    main = "".join(p.main_text).strip()
    body = main if len(normalize(main)) > 100 else "".join(p.all_text)
    text = "\n".join(normalize(line) for line in body.splitlines() if normalize(line))
    links = sorted(set(urllib.parse.urljoin(ORIGIN + path, link) for link in p.links))
    refs = sorted(set(re.findall(r"10\.\d{4,9}/[^\s<>\"']+", " ".join(links))))
    refs += ["PMID:" + n for n in re.findall(r"pubmed\.ncbi\.nlm\.nih\.gov/(\d+)", " ".join(links))]
    return {"path": path, "url": ORIGIN + urllib.parse.quote(path),
            "title": normalize(" ".join(p.title)), "headings": p.headings,
            "text": text, "references": sorted(set(refs)), "lang": p.lang,
            "canonical": p.canonical, "alternates": p.alternates,
            "noindex": p.noindex, "links": links, "content_hash": digest(text)}


def classify(path, sitemap_paths=()):
    """Retain older numbered articles even when absent from the current sitemap."""
    if not path.endswith(".html"):
        return "non_html"
    if re.search(r"_(?:en|cn)\.html$", path):
        return "translation"
    if re.search(r"(?:^|/)(?:base_|.*backup|.*template|.*intake|deletefile|testintake|naver[0-9a-f])", path, re.I):
        return "template_form_or_backup"
    if re.search(r"(?:^|/)encyclopedia/\d{4}\.", path):
        return "article"
    if path in sitemap_paths or path.startswith(("spine/", "notice/")) or path == "BodyallFit/index.html":
        return "service_or_index"
    if path.startswith("pcode/") and path.rsplit("/", 1)[-1] not in {"bodyallsuga.html", "m1.html"}:
        return "service_or_index"
    if path.startswith("BodyallFit/") and path.rsplit("/", 1)[-1] in {
        "direct-management.html", "faq-guide.html", "pharmacology-comparison.html", "ai-verification.html"
    }:
        return "service_or_index"
    return "other_public_page"


def sitemap_paths(xml):
    root = ET.fromstring(xml)
    paths = set()
    for el in root.findall("{*}url/{*}loc"):
        url = urllib.parse.urlsplit(el.text or "")
        if url.scheme != "https" or url.netloc != "wiki.body-all.co.kr":
            raise ValueError("SITEMAP_ORIGIN_MISMATCH")
        path = urllib.parse.unquote(url.path).lstrip("/")
        paths.add(path + "index.html" if not path or path.endswith("/") else path)
    if not paths:
        raise ValueError("EMPTY_SITEMAP")
    return paths


def assemble(tree, xml, read):
    paths = sitemap_paths(xml)
    inventory = [{"path": x["path"], "kind": classify(x["path"], paths)}
                 for x in tree["tree"] if x["path"].endswith(".html")]
    required = [x for x in inventory if x["kind"] in {"article", "service_or_index"}]
    docs = []
    for entry in required:
        doc = parse_page(read(entry["path"]), entry["path"])
        if len(doc["text"]) < 100:
            raise ValueError("EMPTY_OR_UNREADABLE_PAGE:" + entry["path"])
        doc["kind"] = entry["kind"]
        doc["in_sitemap"] = entry["path"] in paths
        docs.append(doc)
    if not docs or not any(d["kind"] == "article" for d in docs):
        raise ValueError("EMPTY_ARTICLE_CORPUS")
    corpus_hash = digest([(d["path"], d["content_hash"]) for d in sorted(docs, key=lambda x: x["path"])])
    return {"policy": POLICY, "commit": tree.get("commit_sha", tree["sha"]), "tree_sha": tree["sha"], "sitemap_hash": digest(xml),
            "corpus_hash": corpus_hash, "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "complete": True, "inventory": inventory, "documents": docs}


def get_public(url):
    if not url.startswith((REPOSITORY, RAW, ORIGIN)):
        raise ValueError("PUBLIC_SOURCE_ALLOWLIST")
    req = urllib.request.Request(url, headers={"User-Agent": "BodyallContentGuard/1.0", "Accept": "application/json,text/html,*/*"})
    with urllib.request.urlopen(req, timeout=4) as response:
        if response.status != 200:
            raise ValueError("PUBLIC_SOURCE_HTTP_" + str(response.status))
        data = response.read(2_000_001)
    if len(data) > 2_000_000:
        raise ValueError("PAGE_TOO_LARGE")
    return data.decode("utf-8")


def fetch_live():
    started = time.monotonic()
    revision = json.loads(get_public(REPOSITORY + "commits/main"))
    commit_sha = revision.get("sha", "")
    tree_sha = revision.get("commit", {}).get("tree", {}).get("sha", "")
    if not all(re.fullmatch(r"[0-9a-f]{40}", x) for x in (commit_sha, tree_sha)):
        raise ValueError("INVALID_REPOSITORY_REVISION")
    tree = json.loads(get_public(REPOSITORY + "git/trees/" + tree_sha + "?recursive=1"))
    if tree.get("truncated") or not re.fullmatch(r"[0-9a-f]{40}", tree.get("sha", "")):
        raise ValueError("INCOMPLETE_REPOSITORY_TREE")
    if tree["sha"] != tree_sha:
        raise ValueError("REPOSITORY_TREE_REVISION_MISMATCH")
    tree["commit_sha"] = commit_sha
    xml = get_public(RAW + commit_sha + "/sitemap.xml")
    paths = sitemap_paths(xml)
    required = [x["path"] for x in tree["tree"] if classify(x["path"], paths) in {"article", "service_or_index"}]
    if len(required) > 240:
        raise ValueError("CORPUS_CAPACITY_REQUIRES_INCREMENTAL_CACHE")
    pages, errors = {}, []
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        futures = {pool.submit(get_public, RAW + commit_sha + "/" + urllib.parse.quote(path)): path for path in required}
        for future in concurrent.futures.as_completed(futures):
            path = futures[future]
            try:
                pages[path] = future.result()
            except Exception as exc:
                errors.append(path + ":" + type(exc).__name__)
    if errors:
        raise ValueError("CORPUS_FETCH_FAILED:" + ";".join(errors[:8]))
    corpus = assemble(tree, xml, pages.__getitem__)
    corpus["fetch_seconds"] = round(time.monotonic() - started, 3)
    return corpus


def tokens(text):
    value = normalize(text).lower()
    words = re.findall(r"[a-z0-9]{2,}|[가-힣]{2,}", value)
    result = set(words)
    aliases = [
        ('cervical', 'neck', '경추', '경부', '목'),
        ('lumbar', '요추', '허리'), ('thoracic', '흉추'),
        ('facet', '후관절'), ('radiculopathy', 'radicular', '신경근'),
        ('stenosis', '협착'), ('disc', '디스크'),
        ('chuna', '추나'), ('acupotomy', '도침'),
        ('shoulder', '어깨'), ('pelvis', 'pelvic', '골반'),
        ('weight', 'obesity', '비만', '체중'), ('fatigue', '피로'),
    ]
    for group in aliases:
        def mentioned(term):
            if re.search('[가-힣]', term):
                if len(term) > 1:
                    return term in value
                return bool(re.search(r'(?<![가-힣])' + term + r'(?=$|[^가-힣]|은|는|이|가|을|의|에|과|도|만|부터|에서|뼈)', value))
            return bool(re.search(r'(?<![a-z])' + re.escape(term) + r'(?![a-z])', value))
        if any(mentioned(t) for t in group):
            result.update(group)
    for word in words:
        if re.search("[가-힣]", word):
            result.update(word[i:i+2] for i in range(len(word)-1))
    return result - {"바디올", "바디", "디올", "한의원", "한의", "의원", "치료", "환자", "the", "and", "can", "for", "with", "from", "how", "does", "is", "it", "of", "to", "in", "are", "what", "as", "or", "be", "by", "at", "on", "an", "that", "this"}


def shingles(text, width=5):
    words = re.findall(r"[\w]+", normalize(text).lower())
    return {" ".join(words[i:i+width]) for i in range(max(0, len(words)-width+1))}


def validate_corpus(corpus):
    if not corpus.get("complete") or not corpus.get("documents") or corpus.get("policy") != POLICY:
        raise ValueError("CORPUS_NOT_READY")
    age = dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(corpus["fetched_at"])
    if age.total_seconds() < -300 or age.total_seconds() > 48 * 3600:
        raise ValueError("CORPUS_STALE")
    expected = digest([(d["path"], digest(d["text"])) for d in sorted(corpus["documents"], key=lambda x: x["path"])])
    if expected != corpus["corpus_hash"]:
        raise ValueError("CORPUS_INTEGRITY_FAILED")


def retrieve(corpus, query, candidate="", limit=6, exclude_path=""):
    validate_corpus(corpus)
    docs = [d for d in corpus["documents"] if d["path"] != exclude_path]
    if not query.strip():
        raise ValueError("EMPTY_QUESTION")
    q = tokens(query)
    anatomy = {"cervical", "lumbar", "thoracic", "shoulder", "pelvis"}
    query_anatomy = q & anatomy
    document_tokens = [tokens(d["text"] + " " + d["path"].replace("-", " ")) for d in docs]
    df = {word: sum(word in terms for terms in document_tokens) for word in q}
    candidate_text = parse_page(candidate)["text"] if candidate else ""
    cs = shingles(candidate_text)
    ranked = []
    for d, dtokens in zip(docs, document_tokens):
        title_tokens = tokens(d["title"] + " ".join(d["headings"]) + " " + d["path"].replace("-", " "))
        score = sum(math.log((len(docs) + 1) / (df[t] + .5)) for t in q & dtokens)
        score += 3 * len(q & title_tokens)
        score += 15 * len(query_anatomy & title_tokens)
        ds = shingles(d["text"]) if candidate_text else set()
        copied = len(cs & ds) / max(1, len(cs))
        exact = bool(candidate_text and normalize(candidate_text) == normalize(d["text"]))
        ranked.append((score, copied, exact, d))
    ranked.sort(key=lambda x: (x[0], x[1]), reverse=True)
    overlap = sorted(ranked, key=lambda x: x[1], reverse=True)
    selected = ranked[:limit]
    # Cross-language retrieval must not lose older articles about the same anatomy.
    # Add article-level matches explicitly so broad clinic hubs cannot crowd them out.
    same_anatomy = [x for x in ranked if x[3]["kind"] == "article" and
                    query_anatomy & tokens(x[3]["title"] + " " + x[3]["path"].replace("-", " "))]
    for item in same_anatomy[:8]:
        if item not in selected:
            selected.append(item)
    for item in overlap[:2]:
        if item[1] >= .15 and item not in selected:
            selected.append(item)
    return {"policy": POLICY, "corpus_hash": corpus["corpus_hash"], "commit": corpus["commit"],
            "coverage": {"documents": len(docs), "articles": sum(d["kind"] == "article" for d in docs),
                         "off_sitemap_articles": [d["path"] for d in docs if d["kind"] == "article" and not d["in_sitemap"]]},
            "hard_duplicate": any(x[2] or (len(candidate_text) > 400 and x[1] >= .80) for x in ranked),
            "maximum_copy_fraction": round(max((x[1] for x in ranked), default=0), 4),
            "candidate_hash": digest(candidate) if candidate else "",
            "nearest": [{"path": x[3]["path"], "url": x[3]["url"], "title": x[3]["title"],
                         "text": x[3]["text"], "references": x[3]["references"],
                         "copy_fraction": round(x[1], 4)} for x in selected],
            "catalog": [{"path": d["path"], "title": d["title"], "headings": d["headings"]} for d in docs],
            "interpretation": "Retrieval and text reuse signals only; a semantic reviewer must judge question, answer and clinical decision overlap. Paper reuse alone is not rejection."}


def pack(corpus):
    return base64.b64encode(zlib.compress(json.dumps(corpus, ensure_ascii=False).encode("utf-8"), 9)).decode("ascii")


def unpack(value):
    return json.loads(zlib.decompress(base64.b64decode(value)))


def editorial_issues(candidate):
    """Catch concrete authoring-language regressions; never delete clinical caveats."""
    visible = normalize(parse_page(candidate)["text"])
    patterns = {
        "AUTHORING_CONTEXT_LEAK": r"제공된 (?:연구|자료)|이번에 확인한 자료|이 글에서는.{0,100}(?:만들어|설명하지)|입력(?:에|에서) (?:없|확인)",
        "DEFENSIVE_CLINIC_DEFINITION": r"(?:특정|별도|고정된|특별한).{0,20}(?:프로토콜|절차).{0,20}(?:뜻|의미)|모든 환자에게 같은 SART 과정을 적용했다는 뜻은",
    }
    issues = [name for name, pattern in patterns.items() if re.search(pattern, visible)]
    if re.search(r"(?:프로토콜|절차).{0,55}(?:뜻|의미).{0,12}(?:아니|아닙)", visible):
        issues.append("DEFENSIVE_CLINIC_DEFINITION")
    if re.search(r"근육.{0,65}(?:때문|긴장).{0,65}관절.{0,65}(?:가늠|구분|구별|감별)", visible):
        issues.append("UNSUPPORTED_EXAM_CAUSE_DISCRIMINATION")
    for paragraph in re.findall(r"<p\b[^>]*>([\s\S]*?)</p>", candidate, re.I):
        text = normalize(parse_page(paragraph)["text"])
        if "torbayandsouthdevon.nhs.uk" in paragraph and re.search(r"(?:다리.{0,35}(?:힘 빠짐|감각 저하|저림)|출혈|발열)", text):
            issues.append("CES_CITATION_SCOPE_MISMATCH")
    if re.search(r"<h[23][^>]*>[^<]*(?:알 수 없|정보.{0,8}공백|범위 밖)[^<]*</h[23]>", candidate):
        issues.append("AUTHORING_LIMITATION_SECTION")
    if re.search(r"<(?:span|p)[^>]*>\s*(?:이번 질문|답변|이번 주제)\s*</", candidate):
        issues.append("AUTHORING_PLACEHOLDER")
    class ParagraphStructure(HTMLParser):
        def __init__(self):
            super().__init__(); self.open_p = False; self.invalid = False
        def handle_starttag(self, tag, attrs):
            if self.open_p and tag in {"p", "div", "section", "h1", "h2", "h3", "ul", "ol", "table"}:
                self.invalid = True
            if tag == "p": self.open_p = True
        def handle_endtag(self, tag):
            if tag == "p": self.open_p = False
    structure = ParagraphStructure(); structure.feed(candidate)
    if structure.invalid: issues.append("NESTED_PARAGRAPH_MARKUP")
    return sorted(set(issues))


def receipt(candidate, context, verdict, document=None):
    """A receipt binds exact draft bytes, current corpus and reviewer evidence."""
    if isinstance(verdict, str):
        verdict = json.loads(verdict)
    errors = editorial_issues(candidate)
    if context.get("candidate_hash") != digest(candidate):
        errors.append("DRAFT_HASH_MISMATCH")
    if context.get("hard_duplicate"):
        errors.append("SUBSTANTIAL_TEXT_REUSE")
    criteria = ("new_patient_decision", "substantive_answer_difference", "source_fidelity",
                "bodyall_facts_supported", "useful_clinic_application", "no_unsubstantiated_superiority",
                "natural_patient_language", "no_redundant_caveats")
    if verdict.get("decision") != "PASS":
        errors.append("SEMANTIC_REVIEW_" + str(verdict.get("decision", "MISSING")))
    for key in criteria:
        if verdict.get("criteria", {}).get(key) is not True:
            errors.append("CRITERION:" + key)
    checks = verdict.get("claim_checks", [])
    if {c.get("area") for c in checks} != {"research", "clinic", "safety", "reader_value"}:
        errors.append("CLAIM_CHECKS_INCOMPLETE")
    if any(c.get("supported") is not True for c in checks):
        errors.append("CLAIM_CHECK_FAILED")
    compared = verdict.get("compared", [])
    expected = {d["path"] for d in context.get("nearest", [])}
    actual = {d.get("path") for d in compared}
    if not expected or not expected.issubset(actual):
        errors.append("NEAREST_DOCUMENTS_NOT_REVIEWED")
    for item in compared:
        if not item.get("difference") or item.get("same_decision") is not False:
            errors.append("DUPLICATE_DECISION_OR_MISSING_EXPLANATION")
    for key in ("new_answer_quote", "clinic_application_quote"):
        quote = normalize(verdict.get(key, ""))
        if len(quote) < 12 or quote not in normalize(parse_page(candidate)["text"]):
            errors.append("UNVERIFIABLE_DRAFT_QUOTE:" + key)
    document_hash = digest(document) if document is not None else None
    return {"ok": not errors, "policy": POLICY, "draft_hash": digest(candidate), "document_hash": document_hash,
            "corpus_hash": context.get("corpus_hash"), "commit": context.get("commit"),
            "reason": "PASS" if not errors else ";".join(sorted(set(errors))),
            "review": verdict, "receipt_hash": digest([POLICY, digest(candidate), document_hash, context.get("corpus_hash"), verdict])}


def local_corpus(site, tree_path, sitemap_path):
    tree = json.loads(Path(tree_path).read_text())
    return assemble(tree, Path(sitemap_path).read_text(), lambda path: (Path(site) / path).read_text())


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--tree", required=True)
    parser.add_argument("--sitemap", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    corpus = local_corpus(args.site, args.tree, args.sitemap)
    Path(args.out).write_text(json.dumps(corpus, ensure_ascii=False))
    print(json.dumps({"documents": len(corpus["documents"]), "hash": corpus["corpus_hash"],
                      "articles": sum(d["kind"] == "article" for d in corpus["documents"])}, ensure_ascii=False))
