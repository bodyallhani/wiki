/* EP.01 — revised for clear roles, short dialogue and three direct choices. */
(function(root){
const story = {
  "title": "이 환자, 나잖아?",
  "episode": "EP.01 퇴근했는데 아직도 일하는 최대리",
  "opening": "원장님, 퇴근했는데 일이 자꾸 따라와요.",
  "replayOpening": "아, 아까 못 한 얘기가 또 있어요.",
  "items": {
    "O1": {
      "id": "O1",
      "label": "휴대폰",
      "prompt": "자기 전에 휴대폰 많이 보세요?",
      "reply": "짧은 영상만 보려고요. 근데 하나만 더 보다 두 시간이 갔어요.",
      "clue": "영상 보다가 두 시간",
      "followupPrompt": "아까 그 영상, “하나만 더”가 계속되는 거죠?",
      "lastLine": "맞아요. 영상은 30초인데, 제 잠은 두 시간 늦어져요.",
      "ending": "A",
      "nickname": "“잠깐” 단속반",
      "shareHeadline": "영상은 30초. 늦게 잔 건 두 시간.",
      "detail": [
        "어젯밤 휴대폰 사용",
        "2시간 17분",
        "딱 하나만 더 보려던 결과"
      ]
    },
    "O2": {
      "id": "O2",
      "label": "노트북",
      "prompt": "아직도 일하는 중이에요?",
      "reply": "이 파일만 보내면 끝이에요. 아까도 그랬는데 또 수정이 왔어요.",
      "clue": "끝나지 않는 수정 요청",
      "followupPrompt": "아까 그 파일, 오늘 안에 꼭 보내야 해요?",
      "lastLine": "급한 건 보냈어요. 나머진 내일 할래요. 저도 퇴근해야죠.",
      "ending": "B",
      "nickname": "퇴근 응원단",
      "shareHeadline": "파일은 “진짜최종”. 나는 아직 야근 중.",
      "detail": [
        "열려 있는 업무 파일",
        "진짜최종_17",
        "마지막 수정이라고 했는데…"
      ]
    },
    "O3": {
      "id": "O3",
      "label": "수첩",
      "prompt": "수첩에 “다음 주”가 왜 이렇게 많아요?",
      "reply": "친구 만나기, 영화 보기… 제 약속은 전부 다음 주로 밀렸어요.",
      "clue": "자꾸 미루게 되는 내 약속",
      "followupPrompt": "아까 수첩에 적은 약속, 뭐부터 하고 싶어요?",
      "lastLine": "친구부터 만나야겠어요. 이번엔 제가 먼저 날짜 잡고요.",
      "ending": "B",
      "nickname": "내 시간 지킴이",
      "shareHeadline": "회사 약속은 오늘. 내 약속은 다음 주.",
      "detail": [
        "이번 주에 하려던 것",
        "친구랑 저녁",
        "또 다음 주로 미뤘다"
      ]
    },
    "O4": {
      "id": "O4",
      "label": "커피",
      "prompt": "커피가 다 식었네요?",
      "reply": "아침에 산 건데… 한 모금 마실 틈도 없었네요.",
      "clue": "마시지도 못한 아침 커피",
      "followupPrompt": "아까 그 커피, 마실 틈도 없었던 거예요?",
      "lastLine": "네. 내일은 따뜻할 때 마시려고요. 커피까지 야근시킬 순 없죠.",
      "ending": "A",
      "nickname": "휴식 알림이",
      "shareHeadline": "아침에 산 커피를 퇴근할 때 발견했다.",
      "detail": [
        "텀블러에 붙인 메모",
        "아침 9시 10분",
        "한 모금도 못 마셨다"
      ]
    },
    "O5": {
      "id": "O5",
      "label": "메모",
      "prompt": "메모에 무슨 말 적어오셨어요?",
      "reply": "할 말은 적어왔는데… 막상 오니까 어디부터 말할지 모르겠네요.",
      "clue": "아직 꺼내지 못한 말",
      "followupPrompt": "아까 적어온 메모, 첫 줄이 뭐예요?",
      "lastLine": "“오늘 좀 힘들었어요.” 이 말부터 하고 싶었나 봐요.",
      "ending": "C",
      "nickname": "첫마디 도우미",
      "shareHeadline": "“오늘 좀 힘들었어요.” 사실 이 말이 하고 싶었다.",
      "detail": [
        "최대리가 적어온 메모",
        "오늘 꼭 할 말",
        "뒷면까지 빼곡한 메모"
      ]
    },
    "Q1": {
      "id": "Q1",
      "label": "오늘 점심은 뭐 드셨어요?",
      "prompt": "오늘 점심은 뭐 드셨어요?",
      "reply": "삼각김밥이요. 메일 쓰면서 먹어서 맛은 잘 모르겠어요.",
      "clue": "메일 보면서 먹은 점심",
      "followupPrompt": "밥 먹을 때도 메일을 봐요?",
      "lastLine": "네. 답장만 보내고 먹으려 했는데, 어느새 포장지만 남았더라고요.",
      "ending": "A",
      "nickname": "점심시간 수호자",
      "shareHeadline": "점심 메뉴는 기억나는데 맛은 기억 안 난다."
    },
    "Q2": {
      "id": "Q2",
      "label": "집에 가면 뭐 하세요?",
      "prompt": "집에 가면 뭐 하세요?",
      "reply": "노트북 켜요. 회사에서 못 끝낸 일이 있어서요.",
      "clue": "집에서도 켜는 업무용 노트북",
      "followupPrompt": "오늘 저녁엔 뭘 하고 싶어요?",
      "lastLine": "노트북은 두고 밥부터 먹을래요. 드라마도 밀렸거든요.",
      "ending": "B",
      "nickname": "저녁시간 지킴이",
      "shareHeadline": "퇴근하고 집에 왔더니 노트북으로 다시 출근."
    },
    "Q3": {
      "id": "Q3",
      "label": "요즘 제일 하고 싶은 건요?",
      "prompt": "요즘 제일 하고 싶은 건요?",
      "reply": "아무것도 안 하고 싶어요. 근데 쉬면 괜히 눈치가 보여요.",
      "clue": "쉬고 싶어도 보이는 눈치",
      "followupPrompt": "여기선 괜찮은 척 안 해도 돼요.",
      "lastLine": "그럼 솔직히요. 오늘은 누가 “고생했다”고 해줬으면 했어요.",
      "ending": "C",
      "nickname": "내 편 같은 원장님",
      "shareHeadline": "오늘 듣고 싶던 말은 “고생했어” 한마디."
    }
  },
  "endings": {
    "A": {
      "title": "눈썰미 좋은 원장님",
      "description": "그냥 지나칠 일도 놓치지 않았네요."
    },
    "B": {
      "title": "퇴근 챙겨주는 원장님",
      "description": "일에 밀려 있던 최대리의 시간을 챙겼네요."
    },
    "C": {
      "title": "말이 통하는 원장님",
      "description": "최대리가 하고 싶던 말을 편하게 꺼냈네요."
    }
  }
};
if(typeof module !== "undefined" && module.exports) module.exports=story;
else root.ClinicStory=story;
})(typeof globalThis !== "undefined" ? globalThis : this);
