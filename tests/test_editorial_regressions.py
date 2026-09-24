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

    def test_observed_nested_markup_and_placeholder_are_blocked(self):
        self.assertIn('NESTED_PARAGRAPH_MARKUP', editorial_issues('<p>진찰을 <p>확인합니다.</p></p>'))
        self.assertIn('AUTHORING_PLACEHOLDER', editorial_issues('<p class="aio-q">이번 질문</p>'))

    def test_rom_observation_cannot_establish_tissue_cause(self):
        self.assertIn('UNSUPPORTED_EXAM_CAUSE_DISCRIMINATION', editorial_issues('<p>관절가동범위를 비교해 통증이 근육의 긴장 때문인지 관절 움직임 자체의 제한 때문인지를 가늠합니다.</p>'))

    def test_specific_ces_reference_cannot_support_unlisted_symptoms(self):
        link='<a href="https://www.torbayandsouthdevon.nhs.uk/cauda-equina-syndrome/">안내</a>'
        self.assertIn('CES_CITATION_SCOPE_MISMATCH', editorial_issues('<p>다리로 뻗치는 힘 빠짐이나 감각 저하가 있으면 응급 진료를 받으세요.'+link+'</p>'))
        self.assertEqual([], editorial_issues('<p>회음부 감각과 배뇨 조절에 갑작스러운 변화가 함께 나타나면 즉시 응급실로 가세요.'+link+'</p>'))

    def test_model_pass_cannot_override_its_own_claim_failure(self):
        review={'decision':'PASS','claim_checks':[{'area':a,'supported':True,'problem_quote':''} for a in ('research','clinic','safety','reader_value')]}
        review['claim_checks'][1].update(supported=False,problem_quote='가동범위로 원인을 구별합니다')
        self.assertIn('CLAIM_CHECK_FAILED', receipt('<p>가동범위로 원인을 구별합니다.</p>',{},review)['reason'])

    def test_search_inventory_is_edited_but_evidence_size_is_retained(self):
        self.assertIn('LITERATURE_SEARCH_INVENTORY', editorial_issues('<p>1611편의 논문 중 16편을 선정했습니다.</p>'))
        self.assertEqual([], editorial_issues('<p>산후 요통의 수기치료 결과는 무작위시험 1편에 근거했습니다.</p>'))

    def test_actual_study_scope_does_not_need_a_second_sart_denial(self):
        scoped='<p>카이로프랙틱 수기치료 연구에서 산후 요통의 긍정적 결과가 보고됐지만 명확한 권고에는 근거가 부족했습니다.</p>'
        self.assertEqual([], editorial_issues(scoped))
        self.assertIn('REDUNDANT_SART_DENIAL', editorial_issues(scoped+'<p>SART를 직접 검증한 연구는 아닙니다.</p>'))

    def test_specific_clinic_value_must_not_follow_a_long_literature_report(self):
        clinical='<p>SART에서는 역중력치료기로 골반을 지지하고 천장관절을 다룹니다.</p>'
        self.assertEqual([], editorial_issues(clinical))
        self.assertIn('CLINIC_VALUE_BURIED', editorial_issues('<p>'+('연구 결과 설명입니다. '*100)+'</p>'+clinical))

    def test_required_object_covers_all_four_review_areas(self):
        checks={a:{'supported':True,'draft_quote':'실제 진료 과정입니다.','explanation':'Confirmed.'} for a in ('research','clinic','safety','reader_value')}
        result=receipt('<p>실제 진료 과정입니다.</p>',{}, {'decision':'PASS','claim_checks':checks})
        self.assertNotIn('CLAIM_CHECKS_INCOMPLETE',result['reason'])
        self.assertNotIn('CLAIM_CHECK_FAILED',result['reason'])
        self.assertEqual(result['review']['claim_checks'],checks)

    def test_object_cannot_hide_a_missing_or_failed_area(self):
        checks={a:{'supported':True,'draft_quote':'실제 진료 과정입니다.','explanation':'Confirmed.'} for a in ('research','clinic','safety')}
        self.assertIn('CLAIM_CHECKS_INCOMPLETE',receipt('<p>실제 진료 과정입니다.</p>',{}, {'claim_checks':checks})['reason'])
        checks['reader_value']={'supported':False,'draft_quote':'실제 진료 과정입니다.','explanation':'Missing decision.'}
        self.assertIn('CLAIM_CHECK_FAILED',receipt('<p>실제 진료 과정입니다.</p>',{}, {'claim_checks':checks})['reason'])

    def test_review_quote_must_be_in_the_draft_not_only_in_clinic_inputs(self):
        checks={'reader_value':{'supported':True,'draft_quote':'입력에만 있는 진료 설명입니다.','explanation':'Correct.'}}
        self.assertIn('UNVERIFIABLE_CLAIM_QUOTE:reader_value',receipt('<p>다른 설명입니다.</p>',{}, {'claim_checks':checks})['reason'])

    def test_wiezer_favourable_course_is_not_a_majority_claim(self):
        ref='<a href="https://pubmed.ncbi.nlm.nih.gov/32560862/">참고문헌</a>'
        self.assertIn('UNSUPPORTED_NATURAL_COURSE_QUANTIFIER',editorial_issues('<p>산후 골반통은 자연 경과상 대부분 호전됩니다.</p>'+ref))
        self.assertEqual([],editorial_issues('<p>산후 골반통은 자연스럽게 호전되는 경과를 보이지만 통증이 남는 경우도 있습니다.</p>'+ref))

if __name__=='__main__': unittest.main()
