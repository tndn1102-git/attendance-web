/* 「K의 나라」 놀이 카탈로그 63종 — 개발완료보고서(2026-10-11) 기준.
   ⚠️ type(놀이 id)은 앱 번들 순서로 매핑한 "추정"이다. 연동 시 앱 소스의 놀이 데이터({ role, art, type, ... })에서
   실제 type 값을 확인해 이 표를 맞춰야 한다. 대시보드는 표에 없는 id가 들어오면 id 원문을 그대로 보여준다(미등록 표시).
   유형: common=공용, idol=아이돌, chef=셰프, creator=크리에이터 */

export const ROOMS = [
  { id: "land", name: "땅의 방", region: "전남" },
  { id: "speech", name: "말의 방", region: "경북" },
  { id: "life", name: "삶의 방", region: "충북·충남" },
  { id: "story", name: "이야기의 방", region: "서울·경기" },
  { id: "island", name: "섬의 방", region: "제주" },
  { id: "field", name: "들의 방", region: "전북" },
  { id: "mountain", name: "산의 방", region: "강원" },
  { id: "sea", name: "바다의 방", region: "경남" },
];

export const ROLES = { idol: "아이돌", chef: "셰프", creator: "크리에이터", common: "공용" };
export const LANGS = { ko: "한국어", en: "영어", ja: "일본어", zh: "중국어", es: "스페인어" };

// [room, 순번, kind, name, controls, target(0=끝까지 완성), limit_s, type]
const RAW = [
  ["land", 1, "chef", "보성 녹차 덖기", "터치 · 원 그리기", 4, 14, "tea"],
  ["land", 2, "common", "감 따기 — 까치밥", "끌어 겨누기 · 톡·비틀기", 6, 14, "persimmon"],
  ["land", 3, "common", "칠석동 고싸움놀이", "폰 밀기 · 박자", 1, 14, "gjGossaum"],
  ["land", 4, "common", "무등산 오르기", "걸음 · 톡톡", 16, 12, "hike"],
  ["land", 5, "idol", "ACC 하이터치회", "손바닥(손가락 셋) · 타이밍", 3, 13, "gjDance"],
  ["land", 6, "creator", "전남 트랜지션 숏폼", "폰 휙 돌리기 · 타이밍", 3, 14, "gjTrans"],
  ["land", 7, "common", "보성 녹차밭 일창이기", "두 손가락 동시 톡", 4, 12, "gjTea"],
  ["land", 8, "common", "강강술래", "두 손가락 비틀기 · 빠르기", 2, 12, "night"],
  ["speech", 1, "common", "안동 하회탈놀이", "터치 · 누르는 길이", 5, 12, "dgHahoe"],
  ["speech", 2, "common", "경주 첨성대 별자리", "터치 · 점 잇기", 2, 12, "dgStar"],
  ["speech", 3, "idol", "치맥페스티벌 떼창", "응원봉 흔들기 · 박수", 3, 14, "dgCall"],
  ["speech", 4, "chef", "연탄불 막창", "터치 · 뒤집기 · 가위질", 4, 16, "dgMakchang"],
  ["speech", 5, "common", "약령시 대저울", "폰 기울이기 · 수평", 3, 14, "dgYak"],
  ["speech", 6, "creator", "서문시장 야시장 숏폼", "폰 돌려 겨누기 · 핀치 줌", 0, 18, "dgVlog"],
  ["speech", 7, "common", "윷놀이", "폰 휙 · 말 고르기", 1, 18, "yutPan"],
  ["speech", 8, "common", "팽이치기", "터치 · 타이밍", 3, 12, "paengi"],
  ["life", 1, "common", "부여 백제 수막새", "터치 · 톡 해서 돌리기", 2, 12, "sjBaekje"],
  ["life", 2, "common", "장독 뚜껑 덮기", "폰 엎었다 뒤집기", 5, 13, "jangdok"],
  ["life", 3, "idol", "대전 한빛탑 윙크 직캠", "핀치 줌 · 셔터", 2, 14, "sjEnding"],
  ["life", 4, "chef", "조치원 복숭아 화채", "터치 · 길게 쓸기 · 빠르기", 3, 12, "sjPeach"],
  ["life", 5, "creator", "세종청사 옥상정원 드론", "폰 기울이기 · 드론 조종", 3, 20, "sjDrone"],
  ["life", 6, "common", "보령 머드축제", "위로 쓸기 · 톡", 15, 12, "sjMud"],
  ["life", 7, "common", "한글 붓글씨", "터치 · 획 따라 쓰기", 6, 14, "writeStroke"],
  ["life", 8, "common", "청주 직지 활자 조판", "터치 · 골라 집기", 1, 10, "sjJikji"],
  ["story", 1, "common", "인천 차이나타운 수타면", "두 손가락 벌리기 · 늘이기", 6, 12, "slNoodle"],
  ["story", 2, "common", "수원 화성 거중기", "터치 · 연타", 3, 12, "slHwaseong"],
  ["story", 3, "idol", "음악방송 사녹", "폰 기울이기·휙 · 안무", 2, 14, "slSanok"],
  ["story", 4, "chef", "광장시장 빈대떡", "꾹 누르기 · 폰 휙 · 톡", 1, 14, "slBindae"],
  ["story", 5, "creator", "한강 야경 라이브", "폰 돌려 겨누기 · 라이브", 2, 14, "slLive"],
  ["story", 6, "common", "보신각 제야의 종", "터치 · 타이밍", 3, 13, "slBell"],
  ["story", 7, "common", "평택농악 상모돌리기", "폰 돌리기 · 원 그리기", 2, 14, "slSangmo"],
  ["story", 8, "common", "골목 딱지치기", "끌어 겨누기 · 폰 내리치기", 2, 14, "slDdakji"],
  ["island", 1, "common", "감귤 굴리기", "폰 기울이기", 8, 18, "tangerines"],
  ["island", 2, "common", "해녀 물질", "누르고 버티기 · 숨", 5, 18, "jjHaenyeo"],
  ["island", 3, "idol", "협재 해변 팬미팅", "핀치 · 쓸기 · 톡", 3, 14, "jjFanmeet"],
  ["island", 4, "chef", "고기국수 삶기", "톡 · 폰 흔들기", 0, 17, "jjNoodle"],
  ["island", 5, "creator", "성산일출봉 일출 파노라마", "폰 돌리기 · 파노라마", 0, 16, "jjPano"],
  ["island", 6, "common", "돌하르방 코 문지르기", "터치 · 문지르기", 0, 14, "jjHarubang"],
  ["island", 7, "common", "제주 공기놀이", "터치 · 톡 두 번", 4, 12, "gonggi"],
  ["island", 8, "common", "방사탑 쌓기", "터치 · 타이밍", 3, 9, "cairn"],
  ["field", 1, "common", "김제 황금 벼베기", "폰 휘두르기 · 쓸기 · 톡", 12, 12, "sickle"],
  ["field", 2, "common", "전주 한지 뜨기", "폰 앞뒤로 출렁 · 흘림뜨기", 2, 14, "jnHanji"],
  ["field", 3, "common", "전주비빔밥 비비기", "터치 · 원 그리기", 6, 14, "bibim"],
  ["field", 4, "idol", "소리축제 부채 칼군무", "박수·톡 · 칼군무", 3, 18, "jnFan"],
  ["field", 5, "chef", "전주 한정식 상차림", "터치 · 끌어다 놓기", 5, 12, "jnToryeom"],
  ["field", 6, "creator", "전주국제영화제 롱테이크", "박수 · 폰 돌려 따라가기", 3, 14, "jnFilm"],
  ["field", 7, "common", "남원 판소리 추임새", "터치·박수 · 타이밍", 2, 14, "chuimsae"],
  ["field", 8, "common", "국궁 한 순", "터치 · 당겨서 놓기", 3, 14, "bow"],
  ["mountain", 1, "common", "평창 스키점프", "폰 앞으로 숙이기 · 타이밍", 2, 14, "gnJump"],
  ["mountain", 2, "common", "단오 그네", "터치 · 타이밍", 4, 13, "gnGeune"],
  ["mountain", 3, "common", "속초 아바이마을 갯배", "번갈아 아래로 쓸기 · 박자", 8, 12, "gnGaetbae"],
  ["mountain", 4, "idol", "단오장 포인트 안무", "터치 · 기억력", 2, 14, "gnIdol"],
  ["mountain", 5, "chef", "초당순두부", "폰 기울이기 · 멈추기", 2, 14, "gnTofu"],
  ["mountain", 6, "creator", "정동진 해돋이 타임랩스", "폰 가로로 돌리기", 1, 13, "gnLive"],
  ["mountain", 7, "common", "쥐불놀이", "폰 흔들기 · 세기 유지", 3, 12, "gnJwibul"],
  ["mountain", 8, "common", "관노가면극", "터치 · 골라 치기", 3, 14, "gnMask"],
  ["sea", 1, "common", "해운대 물수제비", "폰 휙 · 위로 쓸기", 8, 14, "skip"],
  ["sea", 2, "common", "기장 멸치털이", "폰 털기 · 박자", 6, 14, "bsMyeolchi"],
  ["sea", 3, "idol", "사직구장 \"마!\"", "응원봉 휘두르기 · 박수 · 톡", 3, 14, "bsSajik"],
  ["sea", 4, "chef", "남포동 씨앗호떡", "꾹 누르기 · 폰 기울여 붓기", 2, 12, "bsHotteok"],
  ["sea", 5, "creator", "광안리 드론쇼 편집", "타임라인 훑기 · 컷 · 폰 휙 업로드", 2, 14, "bsDrone"],
  ["sea", 6, "common", "진주 남강 유등", "손가락으로 끌기 · 길 안내", 3, 14, "bsYudeung"],
  ["sea", 7, "common", "진해군항제 벚꽃", "폰 옆으로 옮기기 · 받기", 5, 13, "bsJinhae"],
];

export const GAMES = RAW.map(([room, no, kind, name, controls, target, limit_s, type]) => ({
  type, room, no, kind, name, controls, target, limit_s,
  // 센서(가속도·회전·마이크) 의존 여부 — 조작 설명에서 추정. 권한 거부 시 대체 조작 분석용.
  sensor: /폰|흔들|기울|응원봉|박수|걸음|휙/.test(controls),
}));

export const GAME_BY_TYPE = Object.fromEntries(GAMES.map((g) => [g.type, g]));
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

/** 대시보드에 그대로 내려주는 카탈로그 (클라이언트가 이름·제한시간을 조회) */
export function catalogForClient() {
  return { rooms: ROOMS, roles: ROLES, langs: LANGS, games: GAMES };
}
