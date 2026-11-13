# 카드·릴스 제작 도구 비교 (2026-11-06 · 준희 요청)

> 배경: 자체 생성기(11/05) → Canva 생성 카드(11/05) 둘 다 준희 평가 「AI 티가 난다 · 녹색/오렌지가 칙칙하다」.
> 준희: 「예시 몇 개 보내줄 테니 그 느낌으로. Canva에 한계가 있으면 ChatGPT·Higgsfield 등 대안을 검토해서 결정해 달라. 릴스까지 고려.」
> 이 문서는 그 검토. **최종 결정은 준희 예시를 받은 뒤**(§5). 출처는 §6 — 대부분 업체 블로그라 수치는 참고만.

---

## 1. 먼저 진단 — 「AI 티」는 두 군데서 나온다

| 원인 | 지금 상태 | 고치는 법 |
|---|---|---|
| ① **그림(일러스트) 스타일**이 흔하다 | Canva 기본 생성 = 어디서나 본 플랫 일러스트 | **준희 예시를 스타일 참조로 넣어** 같은 결로 뽑는 도구가 필요 |
| ② **글자·배치**가 템플릿 같다 | 가운데 정렬 큰 제목 + 상자 2개 + CTA 띠 | 예시의 **글꼴·여백·정렬 규칙**을 뽑아 그대로 따라 만든다. 도구보다 규칙이 중요 |
| ③ **색**이 칙칙하다 | 포레스트그린 #083f29 + 오렌지 #f27522 (앱 아이콘에서 따온 것) | SNS용 팔레트를 **예시에서 따로 뽑는다**. 앱 색과 같을 필요 없음 |

→ 도구 하나로 해결되는 문제가 아니라 **「그림 도구」와 「글자 도구」를 나눠서** 고르는 게 답이다. 글자까지 AI 이미지에 맡기면 일본어가 깨지거나 매번 모양이 달라진다.

---

## 2. 후보 비교

### 2-1. 그림(일러스트·배경) 만드는 도구
| 도구 | 예시 스타일 따라가기 | 일본어 글자 | 일관성(매주 같은 결) | 비용(대략, 요확인) | Claude 연동 | 평 |
|---|---|---|---|---|---|---|
| **Recraft** | 🟢 **참조 이미지 최대 10장으로 「커스텀 스타일」 저장** → 이후 전부 같은 결 | △ (글자는 안 맡김) | 🟢 가장 강함. SVG(벡터)로도 나와 색 바꾸기 쉬움 | 월 $10 안팎 | ✗ 없음 (준희 수동 또는 API 키) | **카드 그림의 1순위 후보** |
| **ChatGPT (GPT Image 2)** | 🟡 참조 이미지 첨부 가능, 스타일 저장은 안 됨 | 🟢 CJK 포함 매우 정확(업체 주장) | 🟡 매번 프롬프트로 유지해야 함 | ChatGPT Plus $20 (이미 있으면 0) | ✗ | 단발 장면·급할 때. 준희가 이미 구독 중이면 **먼저 이걸로 테스트** |
| **Gemini (Nano Banana 2)** | 🟡 참조 편집에 강함 | 🟢 **일본어 긴 문장·세로쓰기에 가장 안정적**이라는 평 | 🟡 | Google AI 구독 | ✗ | 글자를 꼭 그림 안에 넣어야 할 때 |
| **Midjourney** | 🟢 `--sref`로 탐색은 최고 | 🔴 약함 | 🟡 | $10~ | ✗ | 「어떤 결로 갈지」 탐색용. 양산엔 비효율 |
| Canva Magic Studio | 🔴 스타일 참조 없음 | △ | 🔴 | Canva 요금 안 | 🟢 **연동됨** | 지금 쓴 것. **그림 생성은 여기로 안 간다** |
| Higgsfield | — (영상 중심) | — | — | $19~129/월, 크레딧 소진·만료 | ✗ | §2-3 |

### 2-2. 글자·배치(카드 레이아웃) 도구
| 도구 | 준희가 직접 손보기 | 정밀도 | Claude 연동 | 평 |
|---|---|---|---|---|
| **Canva** | 🟢 쉬움 | 🟡 | 🟢 복제·글자 교체·그림 교체까지 이 세션에서 됨 | **레이아웃은 계속 Canva**. 단 생성 템플릿이 아니라 **준희 예시 규칙으로 직접 짠 마스터**를 쓴다 |
| Figma | 🔴 디자인 경험 필요 | 🟢 | △ (플러그인은 있으나 이 세션에선 접속 실패) | 예시가 「에디토리얼·타이포 중심」이면 검토. 지금은 아님 |
| 자체 생성기 (`scripts/cardnews/`) | 🔴 코드 | 🟢 | 🟢 | 예비. Recraft 그림 + 생성기 레이아웃 조합도 가능하지만 준희가 못 고침 |

### 2-3. 릴스(3월 이후) 도구
| 도구 | 용도 | 비용 | 평 |
|---|---|---|---|
| **CapCut** | 텍스트 애니메이션 릴스의 일본 표준. 템플릿에 사진·문장 넣으면 끝. 자동 자막 | 무료(+Pro) | **릴스 1순위**. 일본 대학생 계정 대부분이 이걸로 만든다 |
| Instagram **Edits** (공식) | 워터마크 없음, 자동 자막, 정지화 애니메이션 | 무료 | CapCut 다음. 인스타 알고리즘 친화 |
| Canva 동영상 | 간단한 글자 움직임 | Canva 요금 | 카드를 그대로 움직이는 정도면 충분 |
| Higgsfield / Veo / Kling | AI 생성 영상(시네마틱 B롤) | 크레딧 비쌈 | **지금 필요 없음**. 우리 릴스는 글자+BGM이지 생성 영상이 아니다. 인물 생성 불허 원칙과도 충돌 |

---

## 3. 🟢 추천안 (예시 받기 전 잠정)

**「Recraft 그림 + Canva 레이아웃 + (3월~) CapCut 릴스」**

1. 준희 예시 3~5장 → 거기서 **팔레트·글꼴·여백 규칙**을 뽑아 `docs/MARKETING.md §3-1`을 다시 쓴다
2. 예시를 Recraft 커스텀 스타일로 저장 → A/B 그림·배경을 그 스타일로 뽑는다 (인물 없음 유지)
3. Canva 마스터를 **그 규칙대로 새로 짠다** (지금 팝 마스터는 폐기 가능). 글자 교체·복제는 지금처럼 Claude가
4. 릴스는 3월 전에 CapCut으로. 카드와 같은 그림·글꼴을 쓰면 계정 톤이 유지된다

**왜 ChatGPT·Higgsfield가 아닌가**
- ChatGPT: 그림은 좋지만 **스타일을 저장 못 해** 매주 같은 결을 내기 어렵다. 준희가 Plus를 이미 쓰면 **첫 테스트용**으로는 최적
- Higgsfield: 영상 생성 플랫폼. 카드엔 쓸 데가 없고, 릴스도 우리 형식(글자+BGM)엔 과하다. 크레딧 만료 구조라 비용 예측이 안 된다

**연동 현실**: Claude가 직접 조작할 수 있는 건 **Canva뿐**이다. Recraft·ChatGPT는 준희가 웹에서 만들어 Canva에 올리거나(가장 쉬움), API 키를 세션에 등록해 Claude가 호출(비용 발생). 처음엔 수동으로 가고, 매주 반복이 되면 API를 검토한다.

---

## 4. 테스트 계획 (예시 받은 뒤 1시간)
| # | 할 것 | 누가 |
|---|---|---|
| 1 | 예시에서 팔레트 5색·글꼴 후보 2개·배치 규칙 5줄 뽑기 | Claude |
| 2 | 같은 소재(空きコマ90分)로 그림 2장씩: Recraft(커스텀 스타일) vs ChatGPT(참조 첨부) | 준희 (웹) |
| 3 | 그림을 Canva 새 마스터에 얹어 2안 비교 → 준희가 고름 | Claude + 준희 |
| 4 | 결과를 DECISIONS에 한 줄, §3-1 규칙 갱신 | Claude |

---

## 5. 🔴 준희가 보낼 것
- **마음에 드는 카드·투고 예시 3~5장** (어느 계정 것이든 OK. 참고만 하고 전재하지 않는다 — MARKETING §5-1)
- 각 예시에서 **좋은 점 한 줄**: 색인지, 글꼴인지, 그림 결인지, 여백인지. 이게 있어야 규칙으로 바꿀 수 있다
- ChatGPT Plus·Canva Pro 등 **이미 결제 중인 것**이 있으면 알려줄 것 (비용 계산에 반영)

---

## 6. 출처 (전부 2차 자료 · 수치는 변동)
- 일본어 글자 렌더링: [invideo 비교](https://invideo.io/blog/best-ai-model-text-in-images/) · [Adpicto gpt-image-2 일본어 가이드](https://www.adpicto.com/en/blog/ai-image-generator-japanese-text-rendering) · [vibedex](https://vibedex.ai/blog/best-ai-text-rendering-2026)
- Recraft 스타일 참조: [Recraft 블로그](https://www.recraft.ai/blog/best-ai-image-generators) · [mindstudio 비교](https://www.mindstudio.ai/blog/recraft-v4-vs-imagen-3-vs-midjourney-v8-design-comparison) · [eesel](https://www.eesel.ai/blog/canva-craft-alternatives)
- Higgsfield 요금·성격: [Krea 정리](https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs) · [hackceleration 리뷰](https://hackceleration.com/labs/review/higgsfield) · [HeyGen 정리](https://www.heygen.com/blog/higgsfield-pricing)
- 일본 릴스 도구: [PerfectCorp](https://www.perfectcorp.com/ja/consumer/blog/video-editing/instagram-reels-guide-video-app) · [istep Edits/Canva](https://istep.click/news_blog/5576) · [remolabo](https://remolabo.co.jp/magazine/10875/)

---

## 7. 🆕 Higgsfield MCP 「무료 무제한」 프로모션 검토 (2026-11-10, 준희가 공유한 링크)

준희가 공유한 안내(인플루언서 노션 + higgsfield.ai/mcp)는 이 세션 네트워크에서 직접 열리지 않아 **공식 X 게시물·헬프센터·제3자 가이드로 확인**했다.

| 항목 | 확인된 내용 |
|---|---|
| 내용 | 11/9 발표. Higgsfield MCP **72시간 무료 체험**, 영상·이미지·오디오 상위 모델 「무제한」 |
| 🔴 함정 1 | **체험 종료 후 자동으로 Higgsfield Ultra 유료 전환**(첫 달 40% 할인). 취소 안 하면 과금 |
| ~~함정 2~~ 🔁 정정 (11/13) | ~~MCP로 만들면 크레딧 차감~~ → 헬프센터의 그 문구는 **일반 무제한 플랜** 얘기. **이번 프로모션은 공식 X·안내 모두 「MCP 안에서」 3일 무료·무제한**이라고 명시 → Claude에서 바로 써도 된다. 단 **신규 계정만**, 가입 화면에 3일 무료 표시가 떠야 적용 |
| 연결 | claude.ai/데스크톱: 설정 → 커넥터 → 커스텀 커넥터 `https://mcp.higgsfield.ai/mcp` (Higgsfield 유료 플랜 필요). Claude Code는 공식적으로 Higgsfield CLI 경로 |
| 모델 | Nano Banana·Kling·Seedance·Veo 등을 한 곳에서 쓰는 **모음 플랫폼** — §2의 그림 후보(Nano Banana 등)가 여기 들어 있다 |

| 출처 보강 | 준희가 붙여준 노션 원문(인스타 @trenddalkak.ai 작성, **초대 코드가 붙은 홍보 링크** — 제휴 콘텐츠로 보고 걸러 읽음). 사례(게임·3D·전투기)는 우리와 무관 |
| 기간 | 11/9 시작. **가입 가능 마감일은 공개된 곳에서 확인 못 함** — 늦을수록 프로모션이 끝났을 위험 |

### 판단 (11/13: 「예시 받고 켜기」로 확정 — 준희)
- **지금 바로 체험을 시작하지 않는다.** 72시간이 흘러가는데, 기준이 될 **준희 예시가 아직 없어서** 뽑아도 버릴 가능성이 크다
- **쓸 가치가 있는 순간 = 예시를 받고 스타일이 정해진 직후.** 그때 체험을 켜고 3일 안에 몰아서 뽑은 뒤 **72시간 전에 취소**한다. MCP가 프로모션 대상이라 **Claude 대화 안에서 바로** 뽑으면 된다
- 🟢 **우리한테 진짜 쓸모 있는 건 영상 쪽이다** — 준희 캠퍼스 사진(인물 없음)을 **이미지→영상으로 살짝 움직이게**(벚꽃 흔들림·구름 흐름) 만들어 **릴스 배경**으로 쓴다. 실사 기반이라 AI 티가 적고, 인물 생성 금지 원칙에도 안 걸린다

### 우리 계정용 3일 계획 (체험 켜는 날 그대로 실행)
| 날 | 할 것 | 결과물 |
|---|---|---|
| 준비(체험 전) | 준희 예시 3~5장으로 스타일 확정 · 캠퍼스 사진 5~10장 더 촬영(인물 없이) · Claude가 프롬프트 목록 작성 | 프롬프트 30개 |
| DAY 1 | 캠퍼스 사진 → 5~8초 움직이는 영상(모델 2~3개 비교: Seedance·Kling 등) | 릴스 배경 10개 |
| DAY 2 | 확정 스타일로 카드 그림·배경 이미지 몰아서 생성 | 카드 그림 30~50장 |
| DAY 3 | 배경 영상 + 글자로 15초 릴스 3개 시안(글자는 CapCut/Canva에서 얹음) · **취소** | 릴스 시안 3개 |
- ~~노션이 권하는 「UGC 광고」는 하지 않는다~~ → 🔁 **11/13 준희: UGC형은 연습용으로 만든다** (게시 여부는 나중에). 진행은 [MARKETING-VIDEO-PLAN.md](MARKETING-VIDEO-PLAN.md)
- 체험 시작 시각을 Claude에게 말하면 **60시간 뒤 취소 알림**을 건다
- ~~릴스용 AI 영상은 우선순위 아님~~ → 🔁 11/13 골이 「홍보 릴스·유튜브 완성」으로 정해져 영상 생성이 주력이 됐다
- 체험을 켜는 날 **취소 알림을 같이 건다** (Claude에게 「〇시간 뒤 알려줘」)

출처: [Higgsfield 공식 X — 72시간 체험](https://x.com/higgsfield/status/2119884452054937656) · [자동 갱신 조건](https://x.com/higgsfield/status/2119884460577726915) · [헬프센터: Higgsfield MCP란](https://higgsfield.ai/creator-hub/help-center/integrations/what-is-higgsfield-mcp) · [헬프센터: Claude 연결](https://higgsfield.ai/creator-hub/help-center/integrations/how-do-i-connect-higgsfield-to-ai-agent) · [layer3labs: 크레딧 함정](https://www.layer3labs.io/guides/higgsfield-mcp) · [pasqualepillitteri 정리](https://pasqualepillitteri.it/en/news/31553/higgsfield-free-72-hour-trial-claude-fable-5-2)
