from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from wiki_preflight_extensions import check


class PreflightExtensionTests(unittest.TestCase):
    def test_empty_image_filename_is_blocked(self):
        draft={'CORE_BODY_KO': '<img src="./image/-1.webp"><img src="./image/-2.webp">'}
        self.assertIn('EXACT_IMAGE_FILENAMES_REQUIRED', check(draft, '0028.neck', []))

    def test_truncated_model_json_is_not_a_success(self):
        self.assertEqual(check('{"CORE_BODY_KO":"unfinished', '0028.neck', []), ['WRITER_JSON_INCOMPLETE_OR_INVALID'])

    def test_known_population_mistranslation_is_blocked(self):
        body='<p>비방사통성 경부통</p><img src="./image/0028.neck-1.webp"><img src="./image/0028.neck-2.webp">'
        self.assertIn('NON_RADICULAR_TERMINOLOGY', check({'CORE_BODY_KO':body}, '0028.neck', ['non-radicular cervical impairments']))


if __name__ == '__main__': unittest.main()
