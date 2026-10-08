"""Temporary fixture checks: no repository files, network, commits or deploys."""
import io
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from bodyall_family_images import FAMILIES, prepare_job
from bodyall_wiki_images_v55 import oid

class Images(unittest.TestCase):
    def fixture(self,root,queue):
        article=root/FAMILIES[queue]
        (article/'image').mkdir(parents=True);(root/queue).mkdir()
        stream=io.BytesIO();Image.new('RGB',(8,8),'red').save(stream,format='PNG')
        raw=stream.getvalue()
        for i in (1,2):(article/'image'/f'9999.fixture-only-{i}.webp').write_bytes(raw)
        job=root/queue/'9999.fixture-only.json'
        job.write_text(json.dumps({'version':1,'status':'PENDING','base_name':'9999.fixture-only','source_shas':[oid(raw)]*2}))
        return article,job

    def test_family_conversion_and_idempotency(self):
        for queue in FAMILIES:
            with tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp);article,job=self.fixture(root,queue)
                (root/'sitemap.xml').write_text('unchanged')
                self.assertEqual(len(prepare_job(root,job)),3)
                self.assertEqual((article/'image/9999.fixture-only-1.webp').read_bytes()[8:12],b'WEBP')
                self.assertEqual((root/'sitemap.xml').read_text(),'unchanged')
                self.assertEqual(prepare_job(root,job),[])

    def test_published_html_and_source_change_block(self):
        for mode in ('published','changed'):
            with tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp);article,job=self.fixture(root,'.diet-image-jobs')
                image=article/'image/9999.fixture-only-1.webp'
                if mode=='published':(article/'9999.fixture-only_cn.html').write_text('existing')
                else:image.write_bytes(b'changed')
                before=image.read_bytes()
                with self.assertRaises(ValueError):prepare_job(root,job)
                self.assertEqual(image.read_bytes(),before)

    def test_symlink_block(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);article,job=self.fixture(root,'.herb-image-jobs')
            image=article/'image/9999.fixture-only-1.webp'
            target=root/'target';target.write_bytes(image.read_bytes());image.unlink();image.symlink_to(target)
            with self.assertRaisesRegex(ValueError,'SYMLINK'):prepare_job(root,job)

if __name__=='__main__':unittest.main()
