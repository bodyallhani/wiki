/* Huata v2: authored entertainment profiles, not medical or psychometric assessment. */
(function(root){
  "use strict";
  const data={
  "version": "huata-v2",
  "questions": [
    {
      "id": 1,
      "text": "어떤 말을 들으면 가장 기운이 나나?",
      "answers": [
        {
          "code": "A",
          "label": "덕분에 해결됐어."
        },
        {
          "code": "B",
          "label": "역시 네가 최고야."
        },
        {
          "code": "C",
          "label": "네가 있어 든든해."
        },
        {
          "code": "D",
          "label": "너는 참 너답다."
        },
        {
          "code": "N",
          "label": "잘 모르겠어요"
        }
      ]
    },
    {
      "id": 2,
      "text": "오늘은 좀 쉬라고 하면?",
      "answers": [
        {
          "code": "A",
          "label": "하던 것만 마무리할게요."
        },
        {
          "code": "B",
          "label": "좋아요. 바로 쉴게요."
        },
        {
          "code": "C",
          "label": "누가 부르면 또 나갈 것 같아요."
        },
        {
          "code": "D",
          "label": "재미있는 것만 조금 더 할게요."
        },
        {
          "code": "N",
          "label": "잘 모르겠어요"
        }
      ]
    },
    {
      "id": 3,
      "text": "설명을 듣고 결정할 때는?",
      "answers": [
        {
          "code": "A",
          "label": "이유가 납득돼야 해요."
        },
        {
          "code": "B",
          "label": "요점만 알면 바로 정해요."
        },
        {
          "code": "C",
          "label": "믿을 만한 사람이면 맡겨요."
        },
        {
          "code": "D",
          "label": "제 경험과 맞는지 생각해요."
        },
        {
          "code": "N",
          "label": "잘 모르겠어요"
        }
      ]
    },
    {
      "id": 4,
      "text": "친구들과 메뉴를 정한다면?",
      "answers": [
        {
          "code": "A",
          "label": "후보를 추려 비교해요."
        },
        {
          "code": "B",
          "label": "제가 먹고 싶은 곳을 설득해요."
        },
        {
          "code": "C",
          "label": "다들 괜찮다는 곳으로 가요."
        },
        {
          "code": "D",
          "label": "누가 골라주면 따라가요."
        },
        {
          "code": "N",
          "label": "잘 모르겠어요"
        }
      ]
    },
    {
      "id": 5,
      "text": "세 번 연속 지면?",
      "answers": [
        {
          "code": "A",
          "label": "방법을 바꿔 다시 해요."
        },
        {
          "code": "B",
          "label": "이길 때까지 한 번 더 해요."
        },
        {
          "code": "C",
          "label": "잘하는 사람에게 물어봐요."
        },
        {
          "code": "D",
          "label": "오늘은 접고 다음을 봐요."
        },
        {
          "code": "N",
          "label": "잘 모르겠어요"
        }
      ]
    },
    {
      "id": 6,
      "text": "내 계획을 친구가 말린다면?",
      "answers": [
        {
          "code": "A",
          "label": "이유를 듣고 고쳐봐요."
        },
        {
          "code": "B",
          "label": "납득할 때까지 제 뜻대로 해요."
        },
        {
          "code": "C",
          "label": "누구에게 영향이 갈지 생각해요."
        },
        {
          "code": "D",
          "label": "다른 속셈이 있나 싶어요."
        },
        {
          "code": "N",
          "label": "잘 모르겠어요"
        }
      ]
    },
    {
      "id": 7,
      "text": "여럿이 일을 맡으면?",
      "answers": [
        {
          "code": "A",
          "label": "할 일을 정리하고 역할을 나눠요."
        },
        {
          "code": "B",
          "label": "제가 먼저 손을 보태요."
        },
        {
          "code": "C",
          "label": "같이 의논하며 힘을 합쳐요."
        },
        {
          "code": "D",
          "label": "잘하는 사람에게 부탁해요."
        },
        {
          "code": "N",
          "label": "잘 모르겠어요"
        }
      ]
    },
    {
      "id": 8,
      "text": "일이 잘 풀리기 시작하면?",
      "answers": [
        {
          "code": "A",
          "label": "끝나기 전까지는 말을 아껴요."
        },
        {
          "code": "B",
          "label": "성공한 모습부터 상상해요."
        },
        {
          "code": "C",
          "label": "함께한 사람들에게 고마워해요."
        },
        {
          "code": "D",
          "label": "사람을 모아 널리 알리고 싶어요."
        },
        {
          "code": "N",
          "label": "잘 모르겠어요"
        }
      ]
    },
    {
      "id": 9,
      "text": "친구가 틀린 말을 하면?",
      "answers": [
        {
          "code": "A",
          "label": "근거를 정리해서 설명해요."
        },
        {
          "code": "B",
          "label": "그 자리에서 바로 말해요."
        },
        {
          "code": "C",
          "label": "민망하지 않게 따로 말해요."
        },
        {
          "code": "D",
          "label": "농담에 섞어서 짚어줘요."
        },
        {
          "code": "N",
          "label": "잘 모르겠어요"
        }
      ]
    },
    {
      "id": 10,
      "text": "갑자기 반나절이 비면?",
      "answers": [
        {
          "code": "A",
          "label": "미뤄둔 일을 정리해요."
        },
        {
          "code": "B",
          "label": "몸을 움직이는 일을 해요."
        },
        {
          "code": "C",
          "label": "사람을 만나러 가요."
        },
        {
          "code": "D",
          "label": "그때 마음 가는 대로 해요."
        },
        {
          "code": "N",
          "label": "잘 모르겠어요"
        }
      ]
    }
  ],
  "people": [
    {
      "id": "zhuge",
      "name": "제갈량",
      "role": "촉의 책사",
      "title": "머릿속에 지도가 펼쳐진 책사",
      "pattern": "AAAAAAAAAA",
      "quote": "제갈량이었구만! 그 부채는 어디 두고 왔나?",
      "chapter": "103",
      "story": "제갈량은 세세한 업무까지 직접 살폈어요. 남에게 맡기기 어려운 마음에는 자신이 받은 책임을 끝까지 다하려는 뜻이 있었죠.",
      "tile": 0,
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%A0%9C%EA%B0%88%EB%9F%89",
      "core": [
        2,
        6,
        1
      ],
      "family": "cool"
    },
    {
      "id": "cao",
      "name": "조조",
      "role": "위의 군주",
      "title": "판을 읽고 먼저 움직이는 승부사",
      "pattern": "BABAAAAAAA",
      "quote": "조조로군! 앉자마자 이 방의 주인이 될 셈인가?",
      "chapter": "001",
      "story": "조조는 권모와 임기응변에 능한 인물로 등장해요. 변화하는 상황에서 길을 찾고, 생각을 행동으로 옮기는 모습에 주목했어요.",
      "tile": 1,
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%A1%B0%EC%A1%B0",
      "core": [
        2,
        6,
        4
      ],
      "family": "cool"
    },
    {
      "id": "liu",
      "name": "유비",
      "role": "촉의 군주",
      "title": "사람을 모으는 군주",
      "pattern": "CCCCCCCCCC",
      "quote": "유비였구먼. 밖에서 두 아우가 기다리나?",
      "chapter": "041",
      "story": "유비는 위험한 피란길에서도 자신을 따라온 백성을 버리기 어려워했어요. 곁의 사람과 함께 가려는 모습이 이 결과의 바탕이에요.",
      "tile": 2,
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%9C%A0%EB%B9%84",
      "core": [
        3,
        0,
        6
      ],
      "family": "cool"
    },
    {
      "id": "guan",
      "name": "관우",
      "role": "의리의 장수",
      "title": "한 번 한 약속은 지키는 장수",
      "pattern": "CADCBCCABA",
      "quote": "관우로구먼! 수염부터 알아봤어야 했는데.",
      "chapter": "025",
      "story": "관우는 어려운 처지에서도 유비와의 약속과 맡은 책임을 지키려 조건을 제시했어요. 한 번 정한 원칙을 쉽게 놓지 않는 모습이에요.",
      "tile": 3,
      "biographyURL": "https://ko.wikipedia.org/wiki/%EA%B4%80%EC%9A%B0",
      "core": [
        5,
        1,
        0
      ],
      "family": "cool"
    },
    {
      "id": "zhang",
      "name": "장비",
      "role": "호탕한 호걸",
      "title": "속마음이 먼저 튀어나오는 호걸",
      "pattern": "DCBBBCCCBC",
      "quote": "장비였구만. 거울 너머로도 우렁차군!",
      "chapter": "001",
      "story": "장비는 함께 나서자고 먼저 제안하고, 감정을 행동으로 빠르게 드러내요. 의기와 솔직함, 움직이는 힘을 담은 결과예요.",
      "tile": 4,
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%9E%A5%EB%B9%84_(%EC%82%BC%EA%B5%AD%EC%A7%80)",
      "core": [
        8,
        6,
        2
      ],
      "family": "cool"
    },
    {
      "id": "zhao",
      "name": "조운",
      "role": "믿음직한 장수",
      "title": "위기에서 더 선명해지는 해결사",
      "pattern": "CABCACBACB",
      "quote": "조운이었군! 맡겨둔 일은 걱정 없겠어.",
      "chapter": "041",
      "story": "조운은 혼란한 전장에서도 자신에게 맡겨진 이들을 찾으러 나서요. 상황에 휩쓸리기보다 해야 할 일을 붙드는 모습에 주목했어요.",
      "tile": 5,
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%A1%B0%EC%9A%B4_(%EC%B4%89%ED%95%9C)",
      "core": [
        6,
        7,
        0
      ],
      "family": "cool"
    },
    {
      "id": "sun",
      "name": "손권",
      "role": "오의 군주",
      "title": "혼자보다 함께 강해지는 군주",
      "pattern": "CBCCCAACCC",
      "quote": "손권이었구만. 믿을 사람 보는 눈이 있었지.",
      "chapter": "029",
      "story": "손책은 손권이 사람을 써서 각자의 힘을 발휘하게 하는 능력을 인정했어요. 믿고 맡기며 함께 이끄는 방식이 이 결과의 중심이에요.",
      "tile": 6,
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%86%90%EA%B6%8C",
      "core": [
        2,
        6,
        3
      ],
      "family": "cool"
    },
    {
      "id": "zhou",
      "name": "주유",
      "role": "오의 대도독",
      "title": "잘하는데, 더 잘하고 싶은 지휘관",
      "pattern": "BAAAAAAACA",
      "quote": "주유였군! 거울에도 대도독의 기품이 남았어.",
      "chapter": "044",
      "story": "주유는 큰 전쟁을 앞두고 자기 판단과 지휘에 자신감을 보여요. 뛰어난 능력과 높은 성취 욕구를 함께 가진 인물로 해석했어요.",
      "tile": 7,
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%A3%BC%EC%9C%A0",
      "core": [
        0,
        6,
        7
      ],
      "family": "cool"
    },
    {
      "id": "sima",
      "name": "사마의",
      "role": "때를 읽는 전략가",
      "title": "마지막 수를 남겨두는 전략가",
      "pattern": "ABAADDAAAA",
      "quote": "사마의였구만. 끝까지 기다릴 줄 알았지.",
      "chapter": "103",
      "story": "사마의는 도발을 받아도 군을 지키며 상대의 상황을 살펴요. 먼저 움직이는 대신 기다림을 선택할 줄 아는 모습이에요.",
      "tile": 8,
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%82%AC%EB%A7%88%EC%9D%98",
      "core": [
        7,
        2,
        4
      ],
      "family": "cool"
    },
    {
      "id": "huang",
      "name": "황충",
      "role": "백전노장",
      "title": "실력으로 대답하는 노장",
      "pattern": "BADDBBBAAB",
      "quote": "황충이었군! 아직 한창이라는 표정이구먼.",
      "chapter": "053",
      "story": "황충은 관우와 겨루며 무예와 활솜씨를 보여줘요. 나이나 겉모습보다 자기 실력으로 대답하는 모습을 담았어요.",
      "tile": 9,
      "biographyURL": "https://ko.wikipedia.org/wiki/%ED%99%A9%EC%B6%A9",
      "core": [
        4,
        9,
        0
      ],
      "family": "cool"
    },
    {
      "id": "lu",
      "name": "여포",
      "role": "천하의 무장",
      "title": "말보다 실전이 빠른 무장",
      "pattern": "BDBBBBBBBB",
      "quote": "여포였구만! 적토마는 밖에 세워뒀나?",
      "chapter": "016",
      "story": "여포는 멀리 세운 극을 활로 맞혀 두 진영의 다툼을 중재해요. 스스로 가진 능력으로 상황을 바꾸려는 모습에 주목했어요.",
      "tile": 10,
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%97%AC%ED%8F%AC",
      "core": [
        2,
        6,
        0
      ],
      "family": "cool"
    },
    {
      "id": "diao",
      "name": "초선",
      "role": "마음을 읽는 인물",
      "title": "사람의 마음으로 판을 바꾸는 인물",
      "pattern": "DCCCACCCCC",
      "quote": "초선이었군! 칼 없이도 판을 흔들던 자네.",
      "chapter": "008",
      "story": "초선은 왕윤의 계획에 참여해 동탁과 여포 사이에서 역할을 수행해요. 사람의 마음과 관계를 통해 상황을 바꾸는 모습을 담았어요.",
      "tile": 11,
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%B4%88%EC%84%A0_(%EC%82%BC%EA%B5%AD%EC%A7%80)",
      "core": [
        8,
        3,
        5
      ],
      "family": "cool"
    },
    {
      "id": "meng",
      "name": "맹획",
      "role": "남쪽의 왕",
      "title": "졌지만, 아직 안 진 사람",
      "quote": "자네, 일곱 번은 물어봐야 인정하겠구먼.",
      "story": "맹획은 붙잡혔다 풀려나기를 거듭하면서도 쉽게 패배를 인정하지 않아요. 이 결과는 한 번 더 해보자는 끈기와 고집을 함께 담았어요.",
      "chapter": "090",
      "tile": null,
      "portrait": "assets/portraits-v2/meng.webp",
      "biographyURL": "https://ko.wikipedia.org/wiki/%EB%A7%B9%ED%9A%8D",
      "pattern": "BDDBBBBCBB",
      "core": [
        4,
        5,
        2
      ],
      "family": "fun"
    },
    {
      "id": "dong",
      "name": "동탁",
      "role": "제멋에 사는 권력자",
      "title": "내가 좋아야 천하태평",
      "quote": "천하는 모르겠고, 자네는 아주 흡족하구먼.",
      "story": "동탁은 권력과 자기 욕망을 앞세우는 인물이에요. 이 결과에서는 자기 취향이 뚜렷하고 원하는 것을 밀어붙이는 모습을 익살스럽게 각색했어요.",
      "chapter": "009",
      "tile": null,
      "portrait": "assets/portraits-v2/dong.webp",
      "biographyURL": "https://ko.wikipedia.org/wiki/%EB%8F%99%ED%83%81",
      "pattern": "BBDBBBABBD",
      "core": [
        3,
        5,
        1
      ],
      "family": "fun"
    },
    {
      "id": "yuan",
      "name": "원술",
      "role": "왕관부터 쓴 야심가",
      "title": "일단 왕관부터 주문했다",
      "quote": "일은 아직인데, 왕관은 벌써 맞췄나?",
      "story": "원술은 반대 의견을 듣고도 황제 자리를 주장해요. 성공한 자기 모습이 눈앞의 일보다 한발 빠른 캐릭터로 각색했어요.",
      "chapter": "017",
      "tile": null,
      "portrait": "assets/portraits-v2/yuan.webp",
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%9B%90%EC%88%A0",
      "pattern": "BDDBBBABBA",
      "core": [
        7,
        0,
        5
      ],
      "family": "fun"
    },
    {
      "id": "liushan",
      "name": "유선",
      "role": "평온을 택한 군주",
      "title": "천하보다 오늘의 평온",
      "quote": "자네 전생에도, 일은 남들이 다 했겠구먼.",
      "story": "유선은 촉을 떠난 뒤 새로운 곳에서의 즐거움을 말하는 장면으로도 유명해요. 이 결과는 복잡한 일보다 오늘의 평온을 택하는 모습으로 각색했어요.",
      "chapter": "119",
      "tile": null,
      "portrait": "assets/portraits-v2/liushan.webp",
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%9C%A0%EC%84%A0_%28%EC%B4%89%ED%95%9C%29",
      "pattern": "DBCDDADCCD",
      "core": [
        1,
        6,
        3
      ],
      "family": "fun"
    },
    {
      "id": "jiao",
      "name": "장각",
      "role": "확신에 찬 전도사",
      "title": "취미를 시작했는데 교주가 됐다",
      "quote": "손목을 맡기랬더니, 나를 입교시키려는 게냐?",
      "story": "장각은 태평도의 가르침을 전하며 많은 사람을 모아요. 좋아하는 일에 몰입하다 주변까지 끌어들이는 과몰입 캐릭터로 각색했어요.",
      "chapter": "001",
      "tile": null,
      "portrait": "assets/portraits-v2/jiao.webp",
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%9E%A5%EA%B0%81",
      "pattern": "DCDBBBCDAC",
      "core": [
        7,
        3,
        5
      ],
      "family": "fun"
    },
    {
      "id": "li",
      "name": "이각",
      "role": "경계심 많은 무장",
      "title": "같은 편인데 일단 의심함",
      "quote": "미안하네만, 자네가 이각인지 곽사인지는 좀 헷갈리는군.",
      "story": "이각과 곽사는 같은 편이었지만 서로를 의심하며 다투어요. 상대의 의도와 주도권을 확인하려는 모습에 주목했어요. 화타가 이름을 헷갈리는 대사는 이 테스트의 농담이에요.",
      "chapter": "013",
      "tile": null,
      "portrait": "assets/portraits-v2/li.webp",
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%9D%B4%EA%B0%81_%28%ED%9B%84%ED%95%9C%29",
      "pattern": "AADBBDAABA",
      "core": [
        5,
        6,
        3
      ],
      "family": "fun"
    },
    {
      "id": "xing",
      "name": "형도영",
      "role": "등장부터 웅장한 무장",
      "title": "자기소개는 여포급",
      "quote": "등장할 때는 여포인 줄 알았네.",
      "story": "형도영은 자신 있게 나섰다가 패하고, 항복과 계책으로 길을 바꿔요. 웅장한 등장과 빠른 방향 전환의 차이를 웃음으로 담았어요. 실제 실력을 판정하는 결과는 아니에요.",
      "chapter": "052",
      "tile": null,
      "portrait": "assets/portraits-v2/xing.webp",
      "biographyURL": "https://ko.wikipedia.org/wiki/%ED%98%95%EB%8F%84%EC%98%81",
      "pattern": "BDBBDBBBBD",
      "core": [
        0,
        7,
        4
      ],
      "family": "fun"
    },
    {
      "id": "mi",
      "name": "예형",
      "role": "거침없는 독설가",
      "title": "입으로 천하통일",
      "quote": "맥은 고른데, 말은 좀 안 고르는군.",
      "story": "예형은 재능을 인정받는 한편 거침없는 말로 사람들을 당황하게 해요. 할 말은 하는 성향과 전달 방식의 빈틈을 함께 담았어요.",
      "chapter": "023",
      "tile": null,
      "portrait": "assets/portraits-v2/mi.webp",
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%98%88%ED%98%95",
      "pattern": "DDABBBBDBD",
      "core": [
        8,
        5,
        2
      ],
      "family": "fun"
    },
    {
      "id": "zuo",
      "name": "좌자",
      "role": "장난스러운 신선",
      "title": "단톡방에 가끔 출몰하는 신선",
      "quote": "자네도 볼 줄 알면서 왜 나한테 왔나?",
      "story": "좌자는 조조 앞에서 신기한 도술과 장난을 보여줘요. 틀에 얽매이기보다 자기 재미를 따라 나타났다 사라지는 인물로 각색했어요.",
      "chapter": "068",
      "tile": null,
      "portrait": "assets/portraits-v2/zuo.webp",
      "biographyURL": "https://ko.wikipedia.org/wiki/%EC%A2%8C%EC%9E%90",
      "pattern": "DDDDDADDDD",
      "core": [
        8,
        9,
        1
      ],
      "family": "fun"
    },
    {
      "id": "xu",
      "name": "허저",
      "role": "든든한 행동파",
      "title": "설명은 됐고, 어디 들면 되나",
      "quote": "손목만 내밀라 했네. 옷은 입게.",
      "story": "허저는 마초와 싸우며 웃옷까지 벗고 달려드는 장면으로 유명해요. 필요한 순간 먼저 몸을 움직이는 든든함과 과한 의욕을 함께 담았어요.",
      "chapter": "059",
      "tile": null,
      "portrait": "assets/portraits-v2/xu.webp",
      "biographyURL": "https://ko.wikipedia.org/wiki/%ED%97%88%EC%A0%80",
      "pattern": "CDBDBCBCAB",
      "core": [
        6,
        9,
        0
      ],
      "family": "fun"
    }
  ],
  "analysis": [
    [
      "문제를 해결했다는 말에 힘이 나요.",
      "실력을 인정받을 때 힘이 나요.",
      "든든한 사람이라는 말이 좋아요.",
      "나다움을 알아봐 주는 말이 좋아요."
    ],
    [
      "하던 일을 정리해야 편히 쉬어요.",
      "쉴 기회가 생기면 기꺼이 쉬어요.",
      "쉬다가도 누가 찾으면 나가는 편이에요.",
      "재미있는 일에는 시간을 더 쓰고 싶어요."
    ],
    [
      "이유를 납득한 뒤 결정해요.",
      "요점을 알면 결정을 미루지 않아요.",
      "믿을 만한 사람에게 맡길 줄 알아요.",
      "직접 겪은 경험을 판단 기준으로 삼아요."
    ],
    [
      "여러 선택지를 비교해서 골라요.",
      "원하는 게 있으면 직접 설득해요.",
      "함께 있는 사람들의 취향을 살펴요.",
      "다른 사람이 고른 선택도 편히 받아들여요."
    ],
    [
      "잘 안되면 방법부터 바꿔봐요.",
      "질수록 한 번 더 해보고 싶어요.",
      "혼자 막히면 잘하는 사람에게 물어요.",
      "안 풀리는 날은 다음 기회를 봐요."
    ],
    [
      "의견을 들으면 계획을 고칠 수 있어요.",
      "납득하기 전에는 쉽게 물러서지 않아요.",
      "내 선택이 주변에 미칠 영향을 생각해요.",
      "상대가 왜 말리는지 의도부터 살펴요."
    ],
    [
      "할 일을 정리하고 역할을 나눠요.",
      "도움이 필요하면 먼저 손을 보태요.",
      "같이 의논하며 일을 풀어가요.",
      "잘하는 사람에게 부탁할 줄 알아요."
    ],
    [
      "끝날 때까지 결과를 쉽게 장담하지 않아요.",
      "잘될 조짐이 보이면 성공한 모습부터 그려요.",
      "일이 잘되면 함께한 사람들을 떠올려요.",
      "좋은 일이 생기면 사람들을 모아 알리고 싶어요."
    ],
    [
      "의견이 다르면 근거를 들어 설명해요.",
      "틀린 말은 그 자리에서 바로 짚어요.",
      "상대가 민망하지 않도록 따로 말해요.",
      "할 말도 농담에 섞어 전하는 편이에요."
    ],
    [
      "시간이 나면 미뤄둔 일을 정리해요.",
      "시간이 나면 몸을 움직이고 싶어요.",
      "빈 시간이 생기면 사람을 만나고 싶어요.",
      "계획 없는 시간은 마음 가는 대로 보내요."
    ]
  ],
  "horse": {
    "id": "horse",
    "name": "하후돈이 타던 말",
    "role": "이름조차 남기지 않은 전생",
    "title": "주인 이름은 아는데, 내 이름은 모른다.",
    "quote": "하후돈이 타던 말일세. 이름은… 나도 모르겠네.",
    "story": "열 번의 “잘 모르겠어요” 끝에서 발견한 특별한 전생이에요. 하후돈이 타던 이름 모를 말은 이 테스트를 위해 만든 개그 설정이에요.",
    "tile": null,
    "family": "special",
    "revealQuote": "자네는 전생에 사람이 아니었나 보구먼…"
  },
  "priority": [
    5,
    6,
    7,
    8,
    4,
    2,
    3,
    0,
    1,
    9
  ],
  "url": "https://wiki.body-all.co.kr/contents/bodyall-clinic/",
  "clinicURL": "https://wiki.body-all.co.kr/SART.html",
  "mapURL": "https://naver.me/53lcJrXB",
  "horseAnalysis": [
    "질문이 열 개여도 대답은 하나예요.",
    "전생의 이름은 화타도 모르겠대요."
  ]
};
  root.HuataDataV2=data;root.HuataData=data;
  if(typeof module!=="undefined"&&module.exports)module.exports=data;
})(typeof globalThis!=="undefined"?globalThis:window);
