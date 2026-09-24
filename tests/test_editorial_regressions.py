"""Regressions observed in real private drafts; necessary research limits survive."""
import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from wiki_content_guard import editorial_issues, receipt

class EditorialRegressions(unittest.TestCase):
    def test_source_availability_explanation_is_blocked(self):
        self.assertIn('AUTHORING_CONTEXT_LEAK', editorial_issues('<p>제공된 연구들은 안전한 시기를 제시하지 않습니다.</p>'))

    def test_reworded_protocol_disclaimer_is_blocked(self):
        self.assertIn('DEFENSIVE_CLINIC_DEFINITION', editorial_issues('<p>이는 특정 산후 전용 절차를 의미하지는 않습니다.</p>'))

    def test_material_research_limitation_is_preserved(self):
        self.assertEqual([], editorial_issues('<p>연구 간 차이가 커 다변량 분석을 하지 못했으므로 위험요인 간 상호작용은 확인하지 못했습니다.</p>'))

    def test_old_six_criterion_pass_cannot_skip_editorial_review(self):
        verdict={'decision':'PASS','criteria':{k:True for k in ('new_patient_decision','substantive_answer_difference','source_fidelity','bodyall_facts_supported','useful_clinic_application','no_unsubstantiated_superiority')}}
        out=receipt('<p>후속 질문에 답하는 서로 다른 문장입니다.</p>',{},verdict)
        self.assertIn('CRITERION:natural_patient_language',out['reason'])
        self.assertIn('CRITERION:no_redundant_caveats',out['reason'])

if __name__=='__main__': unittest.main()
