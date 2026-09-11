# 화타 비언어 추임새 — 승인 완료 기준

2026-09-11 원장님이 채팅의 ‘화타_목소리_샘플01.mp3’를 직접 듣고 음색을 승인했습니다. 현재 기준은 이 녹음이며, 생성 프롬프트만으로 음색이 검증됐다고 판단하지 않습니다.

- 승인 원본: `approved-voice-sample.mp3`. 원본 샘플과 같은 바이트이며 SHA-256은 `approved-voice.json`과 `../AUDIO.json`에 기록합니다. 원본 MP3의 ‘검토용’ 태그는 샘플 제작 당시의 기록입니다.
- 생성: 무료 로컬 Qwen3-TTS-12Hz-1.7B-CustomVoice, 고정 화자 `Uncle_Fu`, seed 1282, float32. 모델 revision과 지침은 `approved-voice.json`에 있습니다.
- 재생: 승인한 녹음을 ‘음·아하·허허’ 3종으로 분할. 새 음성 생성, 음높이·속도·볼륨 변경 없음. 5ms 경계 페이드만 적용합니다.
- 최종 파일: `../assets/huata-approved-{mm,aha,chuckle}.mp3`. 코드: `../sound.js`.
- 재현: ffmpeg/ffprobe가 있는 환경에서 `python3 prepare-approved-voice.py`. 모델 다운로드나 유료 API가 필요하지 않습니다.
- 검증: `node test-sound.cjs`, `node test-startup.cjs`. 실제 청취 선택은 원장님이 수행했으며 자동 검사는 재생 동작을 확인합니다.

기존 `generate-elderly-final.py`, `prepare-elderly-clips.py`, `elderly-voice-source.zip`은 **음색이 거절된 이전 실험의 기록**입니다. 동일 설명을 여러 번 쓰는 VoiceDesign 방식은 화자 고정이 아니므로 최종 음원으로 다시 사용하지 않습니다. 기기 Web Speech로 대체하지 않습니다.

새 음색을 제안할 때는 게임에 먼저 배포하지 말고 채팅에서 샘플을 들려준 뒤 원장님의 선택을 받습니다.
