"""Original 60-second D-pentatonic courtyard theme for Hua Tuo's clinic.
All instrument waveforms and score are synthesized here; no sampled recordings.
Run: python audio-source/compose.py (requires numpy and scipy), then encode the WAV with ffmpeg.
"""
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io.wavfile import write

RATE=32000
BPM=64
BEAT=60/BPM
BARS=16
LENGTH=BARS*4*BEAT
N=round(LENGTH*RATE)
rng=np.random.default_rng(20260911)
bus=np.zeros((N,2),dtype=np.float64)

def hz(midi):return 440*2**((midi-69)/12)
def place(signal,beat,level=.1,pan=0):
    start=round(beat*BEAT*RATE)
    gains=np.array([np.cos((pan+1)*np.pi/4),np.sin((pan+1)*np.pi/4)])*level
    # Circular mixing carries note/reverb tails over the loop seam.
    indices=(np.arange(len(signal))+start)%N
    for channel in range(2):np.add.at(bus[:,channel],indices,signal*gains[channel])

def pluck(midi,seconds=3.5):
    t=np.arange(round(seconds*RATE))/RATE;f=hz(midi)
    signal=np.zeros(len(t))
    # Silky plucked strings, gently inharmonic upper partials, softened finger attack.
    for k in range(1,15):
        decay=np.exp(-t*(.95+.18*k))
        freq=f*k*np.sqrt(1+.00010*k*k)
        signal+=np.sin(2*np.pi*freq*t+.08*np.sin(2*np.pi*4.3*t))*decay/(k**1.5)
    attack=(1-np.exp(-t*120))*np.minimum(1,(seconds-t)/.09)
    noise=sosfilt(butter(2,[800,2800],btype='bandpass',fs=RATE,output='sos'),rng.normal(0,1,len(t)))
    return (signal+noise*np.exp(-t*65)*.085)*attack

def flute(midi,beats):
    seconds=beats*BEAT;t=np.arange(round(seconds*RATE))/RATE;f=hz(midi)
    vibrato=1+.0018*np.sin(2*np.pi*4.8*t)*np.minimum(t/.65,1)
    breath_bend=1-.006*np.exp(-t*7)
    phase=2*np.pi*np.cumsum(f*vibrato*breath_bend)/RATE
    signal=np.sin(phase)+.19*np.sin(2*phase+.25)+.065*np.sin(3*phase)
    noise=sosfilt(butter(2,[950,3000],btype='bandpass',fs=RATE,output='sos'),rng.normal(0,1,len(t)))
    envelope=np.minimum(t/.16,1)*np.minimum((seconds-t)/.28,1)
    envelope=np.maximum(envelope,0)**1.4
    return (signal+.075*noise)*envelope*(.94+.04*np.sin(2*np.pi*.65*t))

def drone(midi,beats):
    seconds=beats*BEAT;t=np.arange(round(seconds*RATE))/RATE;f=hz(midi)
    envelope=np.sin(np.pi*t/seconds)**2
    return (np.sin(2*np.pi*f*t)+.18*np.sin(2*np.pi*f*2*t))*envelope

# Four unhurried phrases; the rests matter as much as the notes.
# Each tuple: beat within phrase, MIDI pitch, held beats.
phrases=[
 [(1,74,1.6),(3,78,1.3),(5,81,2.4),(8.5,78,1.2),(10,76,1.8),(13,74,2.1)],
 [(0.5,76,1.8),(3,78,1.8),(6,83,2.2),(9.5,81,1.6),(12,78,2.5)],
 [(1,81,2.1),(4,78,1.3),(6,76,1.4),(8.5,74,2.2),(12,71,2.2)],
 [(0.5,74,1.8),(3.5,76,1.3),(6,78,2.0),(9.5,76,1.5),(12,74,2.6)]
]
for phrase,notes in enumerate(phrases):
    for onset,midi,length in notes:place(flute(midi,length),phrase*16+onset,.105,.18)
# Open fifths and pentatonic responses, never a busy arpeggio.
roots=[50,50,57,50, 47,50,57,50, 50,47,55,50, 50,57,50,50]
for bar,root in enumerate(roots):
    place(pluck(root,5),bar*4,.12,-.28)
    upper={47:62,50:69,55:74,57:76}[root]
    place(pluck(upper,3),bar*4+1.5,.074,.38)
    if bar%2==0:place(pluck(74 if bar%4==0 else 78,2.7),bar*4+3,.051,-.42)
for beat in range(0,64,8):
    place(drone(38,8),beat,.026,-.1);place(drone(45,8),beat,.017,.1)
# Circular, progressively darker room reflections yield a smooth repeat.
reverberated=bus.copy()
for delay,gain in [(.137,.15),(.293,.105),(.479,.074),(.733,.046),(1.107,.025)]:
    tap=np.roll(bus,round(delay*RATE),axis=0)
    tap[:,0],tap[:,1]=tap[:,1].copy(),tap[:,0].copy()
    reverberated+=tap*gain
reverberated=sosfilt(butter(2,6500,fs=RATE,output='sos'),reverberated,axis=0)
reverberated-=reverberated.mean(axis=0)
peak=np.max(np.abs(reverberated));reverberated*=.72/max(peak,1e-9)
out=Path(__file__).resolve().parent/'huata-courtyard.wav'
write(out,RATE,(np.clip(reverberated,-1,1)*32767).astype(np.int16))
print({'path':str(out),'seconds':LENGTH,'peak':float(np.max(np.abs(reverberated))),'rms':float(np.sqrt(np.mean(reverberated**2))),'seam_delta':float(np.max(np.abs(reverberated[-1]-reverberated[0])))})
