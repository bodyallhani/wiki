from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from verify_public_revision import expected_file, verify


class PublicRevisionTests(unittest.TestCase):
    def test_wrong_revision_prevents_notification_gate(self):
        with tempfile.TemporaryDirectory() as root:
            Path(root, 'index.html').write_text('<h1>approved</h1>')
            with self.assertRaisesRegex(RuntimeError, 'PUBLIC_DEPLOYMENT_PENDING'):
                verify(root, ['https://wiki.body-all.co.kr/'], 'a'*40, 0, lambda *_: b'<h1>old</h1>')

    def test_matching_revision_passes(self):
        with tempfile.TemporaryDirectory() as root:
            Path(root, 'index.html').write_bytes(b'<h1>approved</h1>')
            result=verify(root, ['https://wiki.body-all.co.kr/'], 'a'*40, 0, lambda *_: b'<h1>approved</h1>')
            self.assertEqual(result['verified'], 1)

    def test_source_traversal_and_foreign_hosts_rejected(self):
        for url in ['https://other.example/index.html', 'https://wiki.body-all.co.kr/../outside.html']:
            with self.assertRaises(ValueError): expected_file('/tmp/source', url)


if __name__ == '__main__': unittest.main()
