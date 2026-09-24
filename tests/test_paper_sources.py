import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from wiki_paper_sources import plain, fixture_from_selection, queries


class PaperSourceTests(unittest.TestCase):
    def setUp(self):
        self.plan = {'slug':'postpartum-pain','sub_topic':'Question','angle_instruction':'postpartum assessment',
                     'treatment_name':'Chuna Manual Therapy','paper_search_query':'("pelvic girdle pain") AND ("manual therapy")'}
        self.pool = {'candidates':[]}
        self.selection = {'verified_papers':[]}
        for n, role in [(1,'TREATMENT'),(2,'BACKGROUND')]:
            source = {'title':'Source '+str(n),'doi':'10.1234/example'+str(n),'pmid':str(n),
                      'authors_year':'Researcher (2024)','journal':'Journal','url':'https://doi.org/10.1234/example'+str(n),
                      'source_name':'Europe PMC abstract','source_record':'There was no between-group difference. Further study is needed.'}
            self.pool['candidates'].append(source)
            self.selection['verified_papers'].append(dict(source, verification_status='VERIFIED', bridge_ko='요약', bridge_en='Summary', bridge_zh='摘要',
                reason='EVIDENCE_V2; ROLE='+role+'; SOURCE_QUOTE=There was no between-group difference.'))

    def test_html_cleanup_preserves_statistical_comparisons(self):
        self.assertEqual(plain('<b>Result</b> P < 0.05 and score > 2'), 'Result P < 0.05 and score > 2')

    def test_hallucinated_quote_is_blocked(self):
        self.selection['verified_papers'][0]['reason']='EVIDENCE_V2; ROLE=TREATMENT; SOURCE_QUOTE=There was a large beneficial effect.'
        with self.assertRaisesRegex(ValueError,'SOURCE_QUOTE_NOT_VERIFIABLE'):
            fixture_from_selection(self.plan,self.pool,self.selection)

    def test_changed_pmid_is_blocked(self):
        self.selection['verified_papers'][0]['pmid']='9999'
        with self.assertRaisesRegex(ValueError,'MODEL_BIBLIOGRAPHY_MISMATCH'):
            fixture_from_selection(self.plan,self.pool,self.selection)

    def test_two_background_sources_are_blocked(self):
        self.selection['verified_papers'][0]['reason']=self.selection['verified_papers'][0]['reason'].replace('TREATMENT','BACKGROUND')
        with self.assertRaisesRegex(ValueError,'TWO_BACKGROUND_SOURCES_NOT_ALLOWED'):
            fixture_from_selection(self.plan,self.pool,self.selection)

    def test_canonical_metadata_used_for_valid_sources(self):
        self.selection['verified_papers'][0]['authors_year']='Invented (2099)'
        result=fixture_from_selection(self.plan,self.pool,self.selection)
        self.assertTrue(result['ok'])
        self.assertEqual(result['fixture']['papers'][0]['1'],'Researcher (2024)')

    def test_postpartum_population_stays_in_every_query(self):
        self.assertTrue(all('TITLE_ABS:(postpartum' in q for q in queries(self.plan)))


if __name__ == '__main__':
    unittest.main()
