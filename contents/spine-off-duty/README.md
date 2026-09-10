# 척추야, 퇴근하자! — Bodyall Off Duty

바디올한의원의 설치 없는 60초 코믹 웹게임입니다. `wiki/contents/spine-off-duty/` 안에서만 작동하는 독립적인 정적 페이지입니다.

공개 경로: https://wiki.body-all.co.kr/contents/spine-off-duty/

## 플레이

- 모바일: 게임 화면을 좌우로 드래그하거나 아래의 방향 버튼을 누릅니다.
- PC: 마우스 드래그, 방향키 또는 A / D. P 또는 Escape로 일시정지합니다.
- 주황색 업무 카드는 피하고 초록색 ‘쉬는 틈’을 받습니다.
- 업무 카드에 부딪히면 커피가 하나 줄고, 3잔을 모두 잃으면 종료합니다. 충돌 후 1.5초 동안 추가 충돌로 커피가 줄지 않습니다.
- 게임 속 업무 피로가 100이 되면 종료합니다. 쉬는 틈은 피로를 25 줄이고 연속 획득 보너스를 줍니다.
- 60초 생존 시 퇴근 성공. 새 패턴을 선택하지 않는 한 같은 도전 코드를 재사용합니다.
- 게임 밖으로 이동하거나 탭이 숨겨지면 자동으로 일시정지합니다. 재개는 직접 눌러야 합니다.

## 배포와 파일

프레임워크, 패키지 설치, 빌드, API 키, 자체 서버가 필요하지 않습니다. 기존 GitHub Pages가 저장소 루트를 게시하면 이 폴더도 그대로 게시됩니다. 부모 경로의 HTML, sitemap, 워크플로, 다른 콘텐츠는 변경하지 않습니다.

- `index.html`: 게임 화면, 결과, 생활 점검, 안내
- `style.css`: 모바일·PC 레이아웃과 테마
- `engine.js`: 고정 시간 간격의 결정적 게임 시뮬레이션
- `app.js`: 조작·캔버스·효과음·공유·로컬 기록·선택적 WebMCP
- `assets/employee.png`: 게임 전용으로 생성한 투명 캐릭터 원본
- `test-engine.cjs`: 의존성 없는 시뮬레이션·정적 연결 검사

게임 자체는 JavaScript를 켠 현대적인 모바일/PC 브라우저에서 실행합니다. 파일을 직접 열 수도 있지만 공유·클립보드 등의 기능은 HTTPS 웹주소에서 이용하는 것을 권장합니다. 모바일 공유·이미지 다운로드의 표시 방식은 브라우저와 운영체제에 따라 다릅니다.

## 점수와 난이도

시간 점수 초당 12점, 회피 15점, 아슬아슬 회피 추가 60점. 쉬는 틈은 150점 + 연속 횟수에 따른 20~100점. 퇴근 성공 시 400점 + 남은 커피당 100점.

0~15초 알림 지옥, 15~40초 회의, 40~60초 마지막 업무의 세 구간으로 나뉩니다. 점수와 물리효과는 게임을 위한 설계이며 실제 하중·통증·척추 정렬·치료 효과와 대응하지 않습니다. 입력값이 같은 도전은 동일한 장애물 패턴을 사용합니다. 공개 순위표는 없고 최고기록은 기기 안의 기록입니다. 클라이언트 점수는 조작 방지 인증 기록이 아닙니다.

## 브랜드 연결

기존 저장소의 홈페이지·진료 안내에서 확인한 링크를 사용했습니다.

- 위치·예약 안내: https://naver.me/53lcJrXB
- 목·허리 진료: https://wiki.body-all.co.kr/pain-spine-clinic.html
- 추나요법: https://wiki.body-all.co.kr/chuna-therapy.html
- SART: https://wiki.body-all.co.kr/SART.html

외부 이동 버튼 클릭을 예약 완료로 계산하지 않습니다. 외부 링크는 해당 서비스의 운영 상태에 따라 달라질 수 있습니다. 리뷰 작성·플레이스 저장·방문에 보상을 연결하지 않았습니다. 플레이스 순위·검색 노출·매출 상승을 보장하지 않습니다.

## 개인정보와 성과 측정

로그인·카메라·마이크를 사용하지 않습니다. `bodyall-off-duty-v1`이라는 localStorage 항목에 최고점수·소리·효과 줄이기 설정만 저장합니다. 저장이 제한된 환경에서도 게임은 작동합니다. 생활 점검의 체크 항목은 저장·전송하지 않으며 창을 닫으면 지웁니다.

이 버전은 분석 서비스, 추적 픽셀, 외부 SDK를 넣지 않았습니다. 브라우저 내 `bodyall:game-event` CustomEvent만 제공하며 서버로 전송하지 않습니다. 따라서 중앙에서 완료율·전환율을 수집하는 대시보드는 **아직 없습니다**. 추후 적절한 개인정보 안내와 승인된 분석 구성을 연결할 수 있는 접점입니다.

이벤트: `game_start`, `game_complete`, `challenge_share`, `result_card_export`, `body_check_open`, `clinic_link_click`. 생활 점검 답변은 이벤트에 포함하지 않습니다. 게임 완료에는 점수·시간·게임 종료 사유만, 외부 링크 클릭에는 목적지 종류만 포함됩니다.

공유 링크에는 `?challenge=v1-…` 형태의 패턴 코드만 포함됩니다. 공유 문구와 저장 이미지에는 게임 점수가 들어가며 건강 판정은 들어가지 않습니다. 검색 canonical은 파라미터 없는 게임 주소입니다. 호스팅과 외부 서비스의 기본 접속 로그까지 없다고 보장하는 것은 아닙니다.

## 건강 메시지

게임 기록과 생활 점검을 분리했습니다. ‘척추 나이’, ‘변형 확률’, ‘교정 필요 점수’, ‘틀어짐 정도’ 같은 의학적 측정값을 만들지 않습니다. 특정 자세 때문에 척추가 영구적으로 변형된다고 주장하지 않습니다. 치료를 게임 속 즉시 회복 아이템으로 표현하지 않습니다.

편안한 범위의 움직임, 불편함이 지속되거나 일상을 방해할 때의 평가, 중요한 경고 증상에 대한 안내를 제공합니다. 의료진이 직접 이 버전을 검수했다고 표시하지 않았습니다.

확인한 참고 자료(2026-09-10):

- https://www.nhs.uk/conditions/back-pain/
- https://www.nhs.uk/conditions/scoliosis/

## 검증

`node --check app.js`, `node --check engine.js`, `node test-engine.cjs`로 구문, 시뮬레이션, 자산 연결을 검사할 수 있습니다. 모의 조작의 성공률은 실제 사람의 재미나 완료율을 측정한 결과가 아닙니다.

사용자 요청에 별도의 브라우저 QA가 포함되지 않아 실제 휴대폰·브라우저 시각 검증은 수행하지 않았습니다. 출시 후 실제 기기에서 터치, 공유, 이미지 저장을 확인하는 것이 권장됩니다. 자동 실행으로 이를 완료했다고 표시하지 않습니다.

WebMCP를 지원하는 브라우저에서는 `read_off_duty_game`, `start_off_duty_round` 도구를 선택적으로 등록합니다. 미지원 환경에서는 일반 UI만 사용하며 네트워크 통신은 추가하지 않습니다. 지원 브라우저 문맥에서의 WebMCP 실행 검증은 수행하지 않았습니다.

## 캐릭터 제작

게임 전용 캐릭터는 built-in image generation으로 한 번 생성했고 알파를 유지한 PNG를 사용합니다. 별도 유료 이미지 API 키를 사용하지 않았습니다.

제작 프롬프트 요지: “transparent PNG; one full-body chibi adult human office worker seated on a compact teal rolling chair holding takeaway coffee; large ivory rounded face, dark hair, weary determined expression, white shirt, teal tie, charcoal pants, sneakers; thick dark outlines and flat Korean comic cel illustration; teal/orange/ivory palette; no text, logo, medical anatomy, exposed spine, background or extra people.”
