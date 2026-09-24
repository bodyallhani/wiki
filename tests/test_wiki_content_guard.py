import copy
import datetime as dt
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import wiki_content_guard as guard
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from wiki_content_guard import *


class GuardTests(unittest.TestCase):
    def setUp(self):
        self.body = '<h1>허리 통증과 앉는 자세</h1><p>' + '장시간 앉으면 나타나는 증상과 일어섰을 때 달라지는 통증을 기록합니다. ' * 20 + '</p>'
        d = parse_page(self.body, 'encyclopedia/0001.test.html')
        d.update(kind='article', in_sitemap=True)
        self.corpus = {'complete': True, 'policy': POLICY, 'commit': 'a'*40,
                       'fetched_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'documents': [d],
                       'corpus_hash': digest([(d['path'], d['content_hash'])])}

    def test_exact_copy_is_blocked(self):
        self.assertTrue(retrieve(self.corpus, '허리 통증', self.body)['hard_duplicate'])

    def test_markup_changes_do_not_hide_copy(self):
        modified = self.body.replace('<p>', '<section><p>').replace('</p>', '</p></section>')
        self.assertTrue(retrieve(self.corpus, '허리 통증', modified)['hard_duplicate'])

    def test_shared_paper_is_not_automatic_rejection(self):
        changed = '<h1>허리 수술 의뢰가 필요한 신경학적 변화</h1><p>진행하는 다리 근력 저하와 배뇨 장애는 응급 평가가 필요한 신호입니다.</p><a href="https://doi.org/10.1234/shared">근거</a>'
        self.corpus['documents'][0]['references'] = ['10.1234/shared']
        self.assertFalse(retrieve(self.corpus, '신경학적 변화', changed)['hard_duplicate'])

    def test_missing_corrupt_or_stale_corpus_never_passes(self):
        for key, value in [('complete', False), ('corpus_hash', 'wrong'), ('fetched_at', '2020-01-01T00:00:00+00:00')]:
            c = copy.deepcopy(self.corpus)
            c[key] = value
            with self.assertRaises(ValueError): retrieve(c, '허리 통증')

    def test_unlisted_past_article_retained(self):
        self.assertEqual(classify('encyclopedia/0015.suwon-parents-spinal-stenosis.html'), 'article')
        self.assertEqual(classify('encyclopedia/base_modify.html'), 'template_form_or_backup')

    def test_translation_is_grouped_not_new_topic(self):
        self.assertEqual(classify('encyclopedia/0015.test_en.html'), 'translation')

    def test_pass_without_checked_quotes_is_rejected(self):
        context = retrieve(self.corpus, '허리 통증', '<p>다른 내용</p>')
        self.assertFalse(receipt('<p>다른 내용</p>', context, {'decision': 'PASS'})['ok'])

    def test_altered_draft_invalidates_receipt(self):
        context = retrieve(self.corpus, '허리 통증', '<p>다른 내용</p>')
        self.assertIn('DRAFT_HASH_MISMATCH', receipt('<p>수정 내용</p>', context, {})['reason'])

    def test_pack_preserves_integrity(self):
        validate_corpus(unpack(pack(self.corpus)))

    def test_live_fetch_pins_commit_not_tree_as_raw_revision(self):
        commit, tree_sha = 'a'*40, 'b'*40
        path = 'encyclopedia/0001.test.html'
        xml = '<urlset><url><loc>'+ORIGIN+path+'</loc></url></urlset>'
        calls = []
        def get(url):
            calls.append(url)
            if url.endswith('commits/main'):
                return json.dumps({'sha': commit, 'commit': {'tree': {'sha': tree_sha}}})
            if '/git/trees/' in url:
                return json.dumps({'sha': tree_sha, 'tree': [{'path': path}]})
            return xml if url.endswith('sitemap.xml') else self.body
        with patch.object(guard, 'get_public', get):
            corpus = guard.fetch_live()
        self.assertEqual(corpus['commit'], commit)
        self.assertEqual(corpus['tree_sha'], tree_sha)
        self.assertTrue(all('/'+commit+'/' in u for u in calls if u.startswith(RAW)))

    def test_script_and_navigation_not_used_as_article(self):
        d = parse_page('<head><title>제목</title><script>invented medical claim</script></head><nav>공통 메뉴</nav>' + self.body)
        self.assertNotIn('invented', d['text'])
        self.assertNotIn('공통 메뉴', d['text'])

    def test_english_anatomy_query_retrieves_korean_article(self):
        self.assertIn('cervical', tokens('경추 목'))
        self.assertIn('경추', tokens('cervical facet syndrome'))
        self.assertIn('cervical', tokens('목을 뒤로 젖힐 때'))
        self.assertIn('cervical', tokens('경추후관절 통증'))
        self.assertNotIn('cervical', tokens('제목을 확인합니다'))


if __name__ == '__main__': unittest.main()
