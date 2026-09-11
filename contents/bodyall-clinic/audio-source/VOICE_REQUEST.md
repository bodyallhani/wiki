# 화타의 노년 남성 비언어 추임새 — 제작 지침

## 현재 상태

2026-09-11: AI Voice Generator 연결 및 생성 도구 사용 가능. 앞선 “도구 미노출” 기록은 과거 상태다. 하지만 실제 도구에는 normal/clear/fancy/deep/crisp/delicate 프리셋만 있고 나이·음색 연출을 지정하는 입력이 없다.

deep 프리셋으로 만든 5종을 사용자가 직접 듣고 “젊은 남자 느낌, 할아버지여야 한다”고 거절했다. 해당 파일은 배포하지 않는다. 피치를 낮추거나 속도를 늦춘 결과를 노년 음색으로 간주하지 않는다.

현재 공개 사이트는 main e4f6c0dba687dd1ed3a15d743330e37768e54ff0의 기기 Web Speech 음성이다. 고정 파일 재생 코드는 준비했지만 적합한 음원 확보 전이므로 아직 공개 사이트에 반영하지 않았다.

## 확정 요구

- 듣자마자 70~80대 할아버지로 느껴지는 한국어 남성 음색. 노화된 성대의 거친 결, 약간 새는 숨, 작고 자연스러운 떨림, 느긋하고 따뜻한 반응.
- 특정 실존 배우·인물을 모방하지 않는 화타 캐릭터 목소리.
- 문장 없이 5종만 사용: 음…, 음음, 어…, 아하!, 허허….
- “그렇군”, “알겠네”, “좋네”, “그렇구먼” 등 실제 언어 문장 금지.
- 다섯 파일에 동일한 화자. 각 0.4~1.2초 정도, 음악·반향 없는 깨끗한 단독 음성. “허허”는 글자 낭독보다 부드러운 실제 웃음.
- 답변 즉시 한 파일만 재생, 연속 중복 방지, 앞 소리 중단, BGM 덕킹, 음소거·페이지 가림 유지.
- 기기 기본 음성으로 돌아가는 대체 경로를 사용하지 않는다. 음원 오류는 게임 진행을 막지 않는다.

## 확인한 제작 경로

Fal의 fal-ai/qwen-3-tts/voice-design/1.7b는 Korean 언어와 별도 prompt 입력을 제공한다.
https://fal.ai/models/fal-ai/qwen-3-tts/voice-design/1.7b/api

현재 Fal 연결 확인 및 실제 도구·스키마·가격 점검 완료. Voice Design은 한국어 및 별도 음색 prompt를 지원하며 1,000자당 0.09 USD로 조회됨. 첫 생성 요청은 403 “User is locked. Reason: Exhausted balance.”로 큐 등록 전에 거절됨. 생성 작업 ID와 새 음원은 없음. 연결을 다시 요구하지 말 것. 사용자가 Fal 잔액을 충전하면 elderly-voice-pending/FAL_REQUEST.json의 요청을 한 번 제출하고 샘플을 평가한다. 모델 설명만으로 성공했다고 단정하지 않는다. 맞는 음색을 얻으면 같은 생성 화자를 유지해서 5종을 만든다.

음색 프롬프트 초안:
An unmistakably elderly Korean grandfather in his late seventies or eighties. Naturally aged male vocal folds with a dry, weathered, lightly raspy texture, softly audible breath and a subtle irregular tremor. Gentle, unhurried, warm and slightly amused, like a kindly old physician listening closely. Age must be audible in the texture and phrasing. Short spontaneous nonverbal reactions, no spoken sentences. Dry close-mic voice, no music or room echo.

첫 샘플 text: “음… 허허…” / language: “Korean”. 세부 생성값은 연결 후 실제 스키마를 따른다.

## 준비 코드와 배포 게이트

- `elderly-voice-pending/sound.js`, `test-sound.cjs`: 고정 MP3 5종을 재생하는 준비 코드. 실제 적용 시 게임 폴더의 대응 파일로 옮긴다.
- 준비 코드의 무작위 선택·중복 방지·오디오 중첩·덕킹·음소거·숨김·오류 처리는 VM 테스트 통과. 사용한 임시 음원은 연령 요구를 충족하지 못함. 브라우저 음향 QA는 미실시.
- 합격 음원만 assets/huata-voice-{mm,mm-mm,uh,aha,chuckle}.mp3에 배치하고 AUDIO.json의 출처·해시·상태를 갱신한다. index.html의 sound.js 캐시 버전도 갱신한다.
- sound 및 startup 검증 후 최신 main 기반으로 이 게임 폴더만 반영. 정확한 커밋의 GitHub Pages 성공까지 확인한다.


## 최신 중단 지점

Fal 연결 후 제작을 재개했으나 계정 잔액 부족으로 차단됨. 연결 오류가 아니며 다른 계정·경로를 통해 제한을 우회하지 않는다. billing 페이지: https://fal.ai/dashboard/billing . 사용자에게 충전이 필요함을 안내. 기존 공개 사이트에 음원 변경은 반영하지 않았고, 거절된 젊은 남성 샘플은 여전히 배포 금지다.
