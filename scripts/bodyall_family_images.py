"""Convert only new DIET/HERB job images, using the existing image codec.

No HTML, index, sitemap or WIKI job is modified. The queue directory selects the
family; an untrusted job cannot supply an arbitrary path.
"""
import json
import pathlib
import re
from bodyall_wiki_images_v55 import oid, transcode

FAMILIES={'.diet-image-jobs':'BodyallFit/encyclopedia',
          '.herb-image-jobs':'Herbmed/encyclopedia'}

def regular_path(root,path):
    relative=path.relative_to(root)
    current=root
    for part in relative.parts:
        current=current/part
        if current.is_symlink():raise ValueError('SYMLINK_NOT_ALLOWED')
    return path

def prepare_job(root,jobpath):
    regular_path(root,jobpath)
    if jobpath.parent.parent!=root or jobpath.parent.name not in FAMILIES:
        raise ValueError('FAMILY_QUEUE_REQUIRED')
    job=json.loads(jobpath.read_text())
    if job.get('status')=='DONE':return []
    base=job.get('base_name','')
    if not re.fullmatch(r'[0-9]+\.[a-z0-9]+(?:-[a-z0-9]+)*',base) or jobpath.name!=base+'.json':
        raise ValueError('INVALID_JOB_NAME')
    shas=job.get('source_shas',[])
    if job.get('version')!=1 or job.get('status')!='PENDING' or len(shas)!=2 or any(not re.fullmatch(r'[0-9a-f]{40}',str(s)) for s in shas):
        raise ValueError('INVALID_JOB_CONTRACT')
    article=regular_path(root,root/FAMILIES[jobpath.parent.name])
    if any((article/(base+s+'.html')).exists() for s in ('','_en','_cn')):
        raise ValueError('EXISTING_PUBLIC_HTML_PROTECTED')
    files=[regular_path(root,article/'image'/f'{base}-{i}.webp') for i in (1,2)]
    if any(not path.is_file() for path in files):raise ValueError('IMAGE_PATH_NOT_REGULAR')
    if any(path.stat().st_size>8_000_000 for path in files):raise ValueError('IMAGE_TOO_LARGE')
    raw=[path.read_bytes() for path in files]
    if [oid(value) for value in raw]!=shas:raise ValueError('SOURCE_IMAGE_CHANGED')
    converted=[transcode(value) for value in raw]
    for path,value in zip(files,converted):path.write_bytes(value)
    job.update(status='DONE',output_shas=[oid(value) for value in converted])
    jobpath.write_text(json.dumps(job,ensure_ascii=False,indent=2)+'\n')
    return files+[jobpath]

def main():
    """Prepare changes in the local checkout only; never commit, push or deploy."""
    root=pathlib.Path.cwd()
    changed=[]
    for queue in FAMILIES:
        regular_path(root,root/queue)
        for jobpath in sorted((root/queue).glob('*.json')):
            changed.extend(prepare_job(root,jobpath))
    print(json.dumps({'local_changes':[str(p.relative_to(root)) for p in changed],
                      'committed':False,'pushed':False,'deployed':False}))

if __name__=='__main__':main()
