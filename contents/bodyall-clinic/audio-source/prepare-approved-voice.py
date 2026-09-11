"""Cut the approved recording; requires ffmpeg and ffprobe, no voice generation.

Run from any directory. All playback clips keep the approved pitch, speed and gain.
"""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'audio-source/approved-voice-sample.mp3'
EXPECTED_SHA256 = '307b9fc5461ca90fa35cf7c8c941198c66ece27efd516f980c1480ffdf3df607'
SEGMENTS = [('mm', '음…', 0.0, 0.50),
            ('aha', '아하!', 0.76, 1.78),
            ('chuckle', '허허…', 1.82, 3.52)]


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED_SHA256
    metadata = json.loads((ROOT / 'AUDIO.json').read_text())
    clips = []
    for cue_id, text, start, end in SEGMENTS:
        duration = end - start
        target = ROOT / f'assets/huata-approved-{cue_id}.mp3'
        filters = (f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS,'
                   f'afade=t=in:d=0.005,afade=t=out:st={duration - .005}:d=0.005')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(SOURCE),
                        '-af', filters, '-map_metadata', '-1', '-ac', '1', '-ar', '24000',
                        '-codec:a', 'libmp3lame', '-b:a', '128k', str(target)], check=True)
        encoded = float(subprocess.check_output([
            'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
            '-of', 'default=nw=1:nk=1', str(target)], text=True))
        assert 0 < duration < encoded < 2.0
        clips.append({'id': cue_id, 'text': text, 'file': str(target.relative_to(ROOT)),
                      'sourceSegments': [[start, end]], 'durationSeconds': round(duration, 3),
                      'encodedDurationSeconds': encoded, 'bytes': target.stat().st_size,
                      'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    metadata['speech']['cues'] = clips
    (ROOT / 'AUDIO.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(clips, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
