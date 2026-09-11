"""Only .wiki-image-jobs requests can select images; never touches HTML or indexes.
A source SHA and absence of published HTML are checked before converting either image.
Git push is fast-forward only, with initial attempt plus three fresh-head retries.
"""
import hashlib,io,json,pathlib,re,subprocess,sys
from PIL import Image
Image.MAX_IMAGE_PIXELS=40_000_000

def git(*args,check=True):
 return subprocess.run(['git',*args],text=True,check=check,capture_output=True)
def oid(raw):return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
def transcode(raw):
 with Image.open(io.BytesIO(raw)) as image:
  if image.format not in ('WEBP','JPEG','PNG') or getattr(image,'n_frames',1)!=1:raise ValueError('UNSUPPORTED_IMAGE_FORMAT')
  image.load()
  if image.format=='WEBP':return raw
  output=io.BytesIO();options={'format':'WEBP','lossless':True,'method':4}
  if image.info.get('icc_profile'):options['icc_profile']=image.info['icc_profile']
  if image.info.get('exif'):options['exif']=image.info['exif']
  image.convert('RGBA' if 'A' in image.getbands() else 'RGB').save(output,**options)
  return output.getvalue()

def prepare_job(root,jobpath):
 job=json.loads(jobpath.read_text())
 if job.get('status')=='DONE':return []
 base=job.get('base_name','')
 if not re.fullmatch(r'[0-9]+\.[a-z0-9]+(?:-[a-z0-9]+)*',base) or jobpath.name!=base+'.json':raise ValueError('INVALID_JOB_NAME')
 if job.get('version')!=1 or job.get('status')!='PENDING' or len(job.get('source_shas',[]))!=2:raise ValueError('INVALID_JOB_CONTRACT')
 if any((root/'encyclopedia'/(base+s+'.html')).exists() for s in ('','_en','_cn')):raise ValueError('EXISTING_PUBLIC_HTML_PROTECTED')
 files=[root/'encyclopedia/image'/f'{base}-{i}.webp' for i in (1,2)]
 if any(p.is_symlink() or not p.is_file() for p in files):raise ValueError('IMAGE_PATH_NOT_REGULAR')
 raw=[p.read_bytes() for p in files]
 if any(len(v)>8_000_000 for v in raw):raise ValueError('IMAGE_TOO_LARGE')
 if [oid(v) for v in raw]!=job['source_shas']:raise ValueError('SOURCE_IMAGE_CHANGED')
 converted=[transcode(v) for v in raw]
 for p,v in zip(files,converted):p.write_bytes(v)
 job.update(status='DONE',output_shas=[oid(v) for v in converted]);jobpath.write_text(json.dumps(job,ensure_ascii=False,indent=2)+'\n')
 return files+[jobpath]

def main():
 root=pathlib.Path.cwd();git('config','user.name','bodyall-wiki-image-bot');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 for attempt in range(4):
  # This is a disposable Actions checkout, never a user's workspace.
  git('fetch','origin','main');git('reset','--hard','origin/main');changed=[];failures=[]
  for jobpath in sorted((root/'.wiki-image-jobs').glob('*.json')):
   try:changed.extend(prepare_job(root,jobpath))
   except (ValueError,OSError,KeyError) as exc:failures.append(jobpath.name+': '+str(exc))
  if not changed:
   if failures:raise RuntimeError('; '.join(failures))
   print('No pending new-image job.');return
  git('add','--',*[str(p.relative_to(root)) for p in changed]);git('commit','-m','Convert requested new wiki images to actual WebP')
  result=git('push','origin','HEAD:main',check=False)
  if result.returncode==0:
   print('Converted explicitly requested new wiki images. HTML and indexes untouched.')
   if failures:raise RuntimeError('; '.join(failures))
   return
 raise RuntimeError('PUSH_CONFLICT_AFTER_INITIAL_PLUS_THREE_RETRIES')
if __name__=='__main__':main()
