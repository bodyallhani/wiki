"""Generate five nonverbal sounds with one elderly voice description, locally."""
import argparse,json,os,pathlib,threading,time
os.environ['ORT_DISABLE_TELEMETRY']='1'
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['HF_HUB_OFFLINE']='1'
os.environ['GRADIO_ANALYTICS_ENABLED']='false'
os.environ['TOKENIZERS_PARALLELISM']='false'
p=argparse.ArgumentParser();p.add_argument('--model',required=True);p.add_argument('--output',required=True)
a=p.parse_args(); out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
start=time.monotonic();done=threading.Event();phase='loading'
def heartbeat():
    while not done.wait(20):print(phase,round(time.monotonic()-start),'seconds',flush=True)
threading.Thread(target=heartbeat,daemon=True).start()
import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel
torch.set_num_threads(8);torch.set_num_interop_threads(1);torch.manual_seed(82)
model=Qwen3TTSModel.from_pretrained(a.model,device_map='cpu',dtype=torch.float32,attn_implementation='sdpa',local_files_only=True)
for layers in [model.model.talker.model.layers,model.model.talker.code_predictor.model.layers]:
    torch.ao.quantization.quantize_dynamic(layers,{torch.nn.Linear},dtype=torch.qint8,inplace=True)
voice=('An 82-year-old Korean grandfather. Clearly elderly male, with a dry weathered rasp, '
       'a slightly reedy resonance, softly leaking breath, a gentle uneven tremor and slow relaxed phrasing. '
       'Warm, kindly and slightly amused, like a very old physician. '
       'One brief natural nonverbal reaction, then stop. Soft intimate voice, no music, no background noise.')
texts=['음.','음, 음.','어.','아하!','허허.'];ids=['mm','mm-mm','uh','aha','chuckle']
phase='generating five elderly nonverbal clips'
with torch.inference_mode():
    wavs,sr=model.generate_voice_design(text=texts,language=['Korean']*5,instruct=[voice]*5,
         max_new_tokens=48,temperature=.8,subtalker_temperature=.8,repetition_penalty=1.1)
clips=[]
for name,text,wav in zip(ids,texts,wavs):
    sf.write(out/(name+'.wav'),wav,sr)
    clips.append({'id':name,'text':text,'sampleRate':sr,'durationSeconds':len(wav)/sr})
meta={'model':'Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign','revision':'5ecdb67327fd37bb2e042aab12ff7391903235d3',
      'modelLicense':'Apache-2.0','execution':'Local CPU; no paid API','seed':82,'decoderInt8':True,
      'speakerMode':'same elderly character description for all five; no real person reference',
      'instruct':voice,'clips':clips,'elapsedSeconds':round(time.monotonic()-start,2)}
(out/'generation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
done.set();print(json.dumps(meta,ensure_ascii=False),flush=True);print('FIVE_CLIPS_READY',out,flush=True)
