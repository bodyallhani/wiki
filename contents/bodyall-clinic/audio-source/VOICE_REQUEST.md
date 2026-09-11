# 화타 비언어 추임새 — 현재 제작 기준

5종: 음…, 음음, 어…, 아하!, 허허…. 실제 의미를 가진 답변 문장을 읽지 않는다. 70~80대 할아버지의 거친 성대 질감과 숨, 느긋한 반응이 목표다. 젊은 남성 deep 프리셋은 사용자가 거절했으므로 재사용하지 않는다.

현재 파일은 무료 공개 Qwen3-TTS-12Hz-1.7B-VoiceDesign 모델을 로컬 CPU에서 실행해 제작했다. 모든 항목에 같은 노년 캐릭터 설명을 사용했다. 피치 저하로 노년 목소리를 대신하지 않는다. 실제 연령 인상은 사용자 청취로 평가한다.

재생 코드: sound.js. 최종 MP3: assets/huata-voice-{mm,mm-mm,uh,aha,chuckle}.mp3. 생성 지침과 해시: AUDIO.json. 생성 원본 5종과 선택 구간: elderly-voice-source.zip. 제작 코드: generate-elderly-final.py, prepare-elderly-clips.py.

설치: 별도 Python 3.12 환경에 torch==2.8.0+cpu 및 torchaudio==2.8.0+cpu를 공식 CPU 인덱스에서 설치하고 qwen-tts==0.1.1을 설치한다. 모델 revision 5ecdb67327fd37bb2e042aab12ff7391903235d3을 내려받아 --model 경로로 넘긴다. 실행 전 ORT_DISABLE_TELEMETRY=1 및 HF_HUB_DISABLE_TELEMETRY=1 적용. 모델과 패키지는 사이트에 포함하지 않는다.

원본 모델: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign
공식 코드: https://github.com/QwenLM/Qwen3-TTS

검증: node test-sound.cjs, node test-startup.cjs. 새 파일을 게시할 때 sound.js 쿼리 버전을 바꾸고 해당 커밋의 GitHub Pages 성공을 확인한다.
