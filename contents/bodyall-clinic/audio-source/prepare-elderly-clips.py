"""Trim edge silence and balance our generated clips without pitch/age shifting."""
import argparse, hashlib, json, pathlib, subprocess
import numpy as np

p=argparse.ArgumentParser(); p.add_argument('--source',required=True); p.add_argument('--assets',required=True)
a=p.parse_args(); source=pathlib.Path(a.source); assets=pathlib.Path(a.assets); assets.mkdir(exist_ok=True,parents=True)
segment_path=source/'selected-segments.json'
selections=json.loads(segment_path.read_text()) if segment_path.exists() else {}
entries=[]
for name in ['mm','mm-mm','uh','aha','chuckle']:
    raw=source/(name+'.wav')
    data=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-i',str(raw),
        '-af','highpass=f=55,lowpass=f=7000','-ar','24000','-ac','1','-f','f32le','pipe:1'])
    x=np.frombuffer(data,dtype='<f4').copy(); sr=24000; block=240
    spans=selections.get(name)
    if spans:
        parts=[x[int(start*sr):int(end*sr)].copy() for start,end in spans]
        joined=[]
        for part in parts:
            # Selections end in quiet gaps, never in the middle of a syllable.
            fade=min(120,len(part)//2)
            part[:fade]*=np.linspace(0,1,fade);part[-fade:]*=np.linspace(1,0,fade)
            if joined:joined.append(np.zeros(int(.14*sr),dtype=np.float32))
            joined.append(part)
        x=np.concatenate(joined)
    envelope=np.sqrt(np.mean(x[:len(x)//block*block].reshape(-1,block)**2,axis=1))
    threshold=max(float(envelope.max())*.035,.0005)
    active=np.flatnonzero(envelope>threshold)
    if len(active)==0: raise ValueError('Silent clip: '+name)
    start=max(0,int(active[0]*block)-int(.045*sr))
    end=min(len(x),int((active[-1]+1)*block)+int(.070*sr))
    x=x[start:end]
    duration=len(x)/sr
    if not .15<duration<1.95: raise ValueError(f'Review {name}: active duration {duration:.2f}s')
    rms=float(np.sqrt(np.mean(x*x))); peak=float(np.max(np.abs(x)))
    gain=min(.115/max(rms,.0001),.82/max(peak,.0001)); x*=gain
    fade_in=min(int(.005*sr),len(x)); fade_out=min(int(.012*sr),len(x))
    x[:fade_in]*=np.linspace(0,1,fade_in); x[-fade_out:]*=np.linspace(1,0,fade_out)
    target=assets/('huata-voice-'+name+'.mp3')
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','f32le','-ar',str(sr),'-ac','1',
        '-i','pipe:0','-c:a','libmp3lame','-b:a','64k',str(target)],input=x.astype('<f4').tobytes(),check=True)
    entry={'id':name,'file':'assets/'+target.name,'durationSeconds':round(duration,3),'sourceSegments':spans,
           'trimFromSeconds':round(start/sr,3),'trimToSeconds':round(end/sr,3),
           'peak':round(float(np.max(np.abs(x))),4),'rms':round(float(np.sqrt(np.mean(x*x))),4),
           'gain':round(gain,4),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size}
    entries.append(entry); print(json.dumps(entry),flush=True)
(source/'production-clips.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
