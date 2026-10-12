/* 자동 생성 — node scripts/extract-dm-catalog.mjs (원본: game/index.html 의 CONFIG rooms · KC · DMS · TYPES)
   손으로 고치지 말 것. 생성 2026-10-12 */
export const DM_ROOMS = [
 {
  "id": "land",
  "region": "호남권",
  "name": "울림 – 풍류가 시작되는 곳"
 },
 {
  "id": "speech",
  "region": "대경권",
  "name": "축적 – 시간이 만드는 품격"
 },
 {
  "id": "life",
  "region": "중부권",
  "name": "균형 – 전통·현대·미래의 접점"
 },
 {
  "id": "story",
  "region": "수도권",
  "name": "연결 – 세계로 열린 무대"
 },
 {
  "id": "island",
  "region": "제주",
  "name": "신화의 섬"
 },
 {
  "id": "field",
  "region": "전북",
  "name": "생명의 예향"
 },
 {
  "id": "mountain",
  "region": "강원",
  "name": "치유의 터전"
 },
 {
  "id": "sea",
  "region": "동남권",
  "name": "파도 – 바다가 깨우는 빛"
 }
];
export const CONCEPTS = {
 "beauty": {
  "name": "뷰티",
  "orn": "향갑",
  "color": "#C8557A"
 },
 "mukbang": {
  "name": "먹방",
  "orn": "석류",
  "color": "#B8323A"
 },
 "food": {
  "name": "음식",
  "orn": "방아다리",
  "color": "#A9781C"
 },
 "sight": {
  "name": "관광",
  "orn": "나비",
  "color": "#2C5FA8"
 },
 "travel": {
  "name": "여행",
  "orn": "호리병",
  "color": "#23806A"
 },
 "trad": {
  "name": "전통",
  "orn": "매미",
  "color": "#5D4E8C"
 }
};
export const DMS = [{"room":"land","no":1,"concept":"beauty","type":"ldGreenPack","title":"녹차 수분팩","who":"보성 찻잎 화장품 공방 '초록볕'","temp":false},{"room":"land","no":2,"concept":"mukbang","type":"ldGejang","title":"돌게장 비벼 한입","who":"여수 돌게장 백반집","temp":false},{"room":"land","no":3,"concept":"sight","type":"gjTrans","title":"전남 트랜지션 숏폼","who":"전남 관광 홍보팀 '남도로'","temp":false},{"room":"land","no":4,"concept":"travel","type":"hike","title":"무등산 오르기","who":"무등산 등산학교","temp":false},{"room":"land","no":5,"concept":"food","type":"tea","title":"보성 녹차 덖기","who":"보성 다원","temp":false},{"room":"land","no":6,"concept":"trad","type":"night","title":"강강술래","who":"해남 강강술래 보존회","temp":false},{"room":"land","no":7,"concept":"travel","type":"persimmon","title":"감 따기 — 까치밥","who":"영암 대봉감 농가","temp":false},{"room":"land","no":8,"concept":"trad","type":"gjGossaum","title":"칠석동 고싸움놀이","who":"광주 칠석동 고싸움 보존회","temp":false},{"room":"land","no":9,"concept":"sight","type":"gjDance","title":"ACC 하이터치","who":"ACC 거리공연팀","temp":false},{"room":"land","no":10,"concept":"travel","type":"gjTea","title":"보성 녹차밭 일창이기","who":"보성 차밭 체험장","temp":false},{"room":"speech","no":1,"concept":"beauty","type":"dgYak","title":"한방 크림 조제","who":"약령시 한방 화장품 연구소","temp":false},{"room":"speech","no":2,"concept":"mukbang","type":"dgVlog","title":"야시장 먹방 숏폼","who":"서문시장 야시장 상인회","temp":false},{"room":"speech","no":3,"concept":"sight","type":"dgStar","title":"첨성대 별자리","who":"경주 야간관광 센터","temp":false},{"room":"speech","no":4,"concept":"travel","type":"dgFerry","title":"하회 나룻배","who":"하회마을 나룻배 사공","temp":false},{"room":"speech","no":5,"concept":"food","type":"dgMakchang","title":"연탄불 막창","who":"안지랑 막창골목","temp":false},{"room":"speech","no":6,"concept":"trad","type":"paengi","title":"팽이치기","who":"경북 민속놀이 전수관","temp":false},{"room":"speech","no":7,"concept":"trad","type":"dgHahoe","title":"안동 하회탈놀이","who":"안동 하회별신굿탈놀이 전수관","temp":false},{"room":"speech","no":8,"concept":"sight","type":"dgCall","title":"치맥페스티벌 응원","who":"대구 치맥페스티벌","temp":false},{"room":"speech","no":9,"concept":"trad","type":"yutPan","title":"윷놀이","who":"경주 민속놀이마당","temp":false},{"room":"life","no":1,"concept":"beauty","type":"sjMud","title":"보령 머드팩","who":"보령 머드 화장품 체험관","temp":false},{"room":"life","no":2,"concept":"mukbang","type":"sjBread","title":"빵지순례","who":"대전 원도심 빵집 거리","temp":false},{"room":"life","no":3,"concept":"sight","type":"sjDrone","title":"옥상정원 드론","who":"세종 정부청사 옥상정원","temp":false},{"room":"life","no":4,"concept":"travel","type":"sjPara","title":"단양 패러글라이딩","who":"단양 패러글라이딩","temp":false},{"room":"life","no":5,"concept":"food","type":"sjPeach","title":"복숭아 화채","who":"조치원 복숭아 농가","temp":false},{"room":"life","no":6,"concept":"trad","type":"sjJikji","title":"직지 활자 조판","who":"청주 고인쇄박물관","temp":false},{"room":"life","no":7,"concept":"trad","type":"sjBaekje","title":"부여 백제 수막새","who":"부여 백제문화단지","temp":false},{"room":"life","no":8,"concept":"food","type":"jangdok","title":"장독 뚜껑 덮기","who":"충남 장 담그는 마을","temp":false},{"room":"life","no":9,"concept":"sight","type":"sjEnding","title":"한빛탑 윙크 직캠","who":"대전 한빛탑 공연","temp":false},{"room":"life","no":10,"concept":"trad","type":"writeStroke","title":"한글 붓글씨","who":"세종 한글 서예 공방","temp":false},{"room":"story","no":1,"concept":"beauty","type":"slCushion","title":"성수 팝업 메이크업","who":"성수동 K-뷰티 팝업","temp":false},{"room":"story","no":2,"concept":"mukbang","type":"slBindae","title":"광장시장 빈대떡 한입","who":"광장시장 빈대떡집","temp":false},{"room":"story","no":3,"concept":"sight","type":"slLive","title":"한강 야경 라이브","who":"한강 야경 크루즈","temp":false},{"room":"story","no":4,"concept":"travel","type":"slHwaseong","title":"화성 성곽길","who":"수원 화성 성곽길 해설사","temp":false},{"room":"story","no":5,"concept":"food","type":"slNoodle","title":"수타면","who":"인천 차이나타운 수타면집","temp":false},{"room":"story","no":6,"concept":"trad","type":"slSangmo","title":"상모돌리기","who":"평택농악 보존회","temp":false},{"room":"story","no":7,"concept":"sight","type":"slSanok","title":"음악방송 사녹","who":"상암 음악방송 사전녹화","temp":false},{"room":"story","no":8,"concept":"trad","type":"slBell","title":"보신각 제야의 종","who":"보신각 타종 행사","temp":false},{"room":"story","no":9,"concept":"trad","type":"slDdakji","title":"골목 딱지치기","who":"북촌 골목 놀이터","temp":false},{"room":"island","no":1,"concept":"beauty","type":"jjSongi","title":"화산송이·동백 팩","who":"제주 동백·화산송이 공방","temp":false},{"room":"island","no":2,"concept":"mukbang","type":"jjPork","title":"흑돼지 멜젓 먹방","who":"흑돼지 골목","temp":false},{"room":"island","no":3,"concept":"sight","type":"jjPano","title":"일출 파노라마","who":"성산일출봉","temp":false},{"room":"island","no":4,"concept":"travel","type":"tangerines","title":"감귤 따기","who":"감귤 체험 농장","temp":false},{"room":"island","no":5,"concept":"food","type":"jjNoodle","title":"고기국수 삶기","who":"고기국수 노포","temp":false},{"room":"island","no":6,"concept":"trad","type":"jjHaenyeo","title":"해녀 물질","who":"해녀 학교","temp":false},{"room":"island","no":7,"concept":"sight","type":"jjFanmeet","title":"협재 해변 팬미팅","who":"협재 해변 팬미팅","temp":false},{"room":"island","no":8,"concept":"travel","type":"jjHarubang","title":"돌하르방 코 문지르기","who":"제주 돌문화공원","temp":false},{"room":"island","no":9,"concept":"trad","type":"gonggi","title":"제주 공기놀이","who":"제주 민속 놀이마당","temp":false},{"room":"island","no":10,"concept":"trad","type":"cairn","title":"방사탑 쌓기","who":"제주 마을 방사탑 지킴이","temp":false},{"room":"field","no":1,"concept":"beauty","type":"jnDaenggi","title":"한복·댕기 스타일링","who":"한옥마을 한복 대여점","temp":false},{"room":"field","no":2,"concept":"mukbang","type":"bibim","title":"전주비빔밥 비비기","who":"전주비빔밥집","temp":false},{"room":"field","no":3,"concept":"sight","type":"jnFilm","title":"영화제 롱테이크","who":"전주국제영화제","temp":false},{"room":"field","no":4,"concept":"travel","type":"sickle","title":"김제 벼베기","who":"김제 지평선 농촌체험","temp":false},{"room":"field","no":5,"concept":"food","type":"jnToryeom","title":"한정식 상차림","who":"전주 한정식","temp":false},{"room":"field","no":6,"concept":"trad","type":"chuimsae","title":"판소리 추임새","who":"남원 판소리 전수관","temp":false},{"room":"field","no":7,"concept":"trad","type":"jnHanji","title":"전주 한지 뜨기","who":"전주 한지 공방","temp":false},{"room":"field","no":8,"concept":"sight","type":"jnFan","title":"소리축제 부채 칼군무","who":"전주세계소리축제 공연팀","temp":false},{"room":"field","no":9,"concept":"trad","type":"bow","title":"국궁 한 순","who":"전북 전통 활터","temp":false},{"room":"mountain","no":1,"concept":"beauty","type":"gnChangpo","title":"창포물 머리감기","who":"강릉단오제 체험부스","temp":false},{"room":"mountain","no":2,"concept":"mukbang","type":"gnDakgalbi","title":"닭갈비 먹방","who":"춘천 닭갈비 골목","temp":false},{"room":"mountain","no":3,"concept":"sight","type":"gnLive","title":"해돋이 타임랩스","who":"정동진 해돋이","temp":false},{"room":"mountain","no":4,"concept":"travel","type":"gnJump","title":"스키점프","who":"평창 스키점프대","temp":false},{"room":"mountain","no":5,"concept":"food","type":"gnTofu","title":"초당순두부","who":"초당순두부 마을","temp":false},{"room":"mountain","no":6,"concept":"trad","type":"gnMask","title":"관노가면극","who":"강릉 관노가면극 보존회","temp":false},{"room":"mountain","no":7,"concept":"trad","type":"gnGeune","title":"단오 그네","who":"강릉단오제 그네 마당","temp":false},{"room":"mountain","no":8,"concept":"travel","type":"gnGaetbae","title":"아바이마을 갯배","who":"속초 아바이마을 갯배","temp":false},{"room":"mountain","no":9,"concept":"sight","type":"gnIdol","title":"단오장 포인트 안무","who":"강릉 단오장 무대","temp":false},{"room":"mountain","no":10,"concept":"trad","type":"gnJwibul","title":"쥐불놀이","who":"정월대보름 쥐불 마당","temp":false},{"room":"sea","no":1,"concept":"beauty","type":"bsRedcarpet","title":"레드카펫 포토월","who":"부산 영화제 레드카펫 메이크업팀","temp":false},{"room":"sea","no":2,"concept":"mukbang","type":"bsHotteok","title":"씨앗호떡 한입","who":"남포동 씨앗호떡","temp":false},{"room":"sea","no":3,"concept":"sight","type":"bsDrone","title":"드론쇼 편집","who":"광안리 드론쇼","temp":false},{"room":"sea","no":4,"concept":"travel","type":"bsSajik","title":"사직구장 직관 응원","who":"사직야구장 응원단","temp":false},{"room":"sea","no":5,"concept":"food","type":"bsMyeolchi","title":"기장 멸치털이","who":"기장 멸치잡이 배","temp":false},{"room":"sea","no":6,"concept":"trad","type":"bsYudeung","title":"진주 남강 유등","who":"진주 남강 유등축제","temp":false},{"room":"sea","no":7,"concept":"travel","type":"skip","title":"해운대 물수제비","who":"해운대 해변","temp":false},{"room":"sea","no":8,"concept":"sight","type":"bsJinhae","title":"진해군항제 벚꽃","who":"진해군항제","temp":false}];
export const TYPES = {
 "beauty-beauty": {
  "name": "매분구",
  "desc": "화장품을 이고 전국을 다니던 행상처럼, 예뻐지는 법을 찾아다닌 사람"
 },
 "beauty-mukbang": {
  "name": "꽃단장 미식가",
  "desc": "곱게 꾸미고 맛있는 건 꼭 먹고 가는 사람"
 },
 "beauty-food": {
  "name": "약선 의녀",
  "desc": "몸에 좋은 재료로 바르고 먹는 법을 아는 사람"
 },
 "beauty-sight": {
  "name": "한양 멋쟁이",
  "desc": "어디서 찍어도 화면이 사는 사람"
 },
 "beauty-travel": {
  "name": "보부상",
  "desc": "좋은 물건을 지고 팔도를 누비는 사람"
 },
 "beauty-trad": {
  "name": "규방 장인",
  "desc": "옛 멋을 오늘의 멋으로 바꾸는 사람"
 },
 "mukbang-mukbang": {
  "name": "팔도 먹보",
  "desc": "도마다 그 동네 맛을 한입에 담아 온 사람"
 },
 "mukbang-food": {
  "name": "주막 사장",
  "desc": "만들고, 먹고, 손님까지 부르는 사람"
 },
 "mukbang-sight": {
  "name": "장터 구경꾼",
  "desc": "구경거리 옆엔 늘 먹을거리를 찾아낸 사람"
 },
 "mukbang-travel": {
  "name": "팔도 식객",
  "desc": "맛을 따라 길을 떠나는 사람"
 },
 "mukbang-trad": {
  "name": "잔칫날 큰손",
  "desc": "잔치 음식과 놀이판을 가장 즐기는 사람"
 },
 "food-food": {
  "name": "수라간 숙수",
  "desc": "재료 손질부터 한 상까지 직접 차리는 사람"
 },
 "food-sight": {
  "name": "저잣거리 소개꾼",
  "desc": "좋은 가게와 좋은 풍경을 함께 알려 주는 사람"
 },
 "food-travel": {
  "name": "팔도 숙수",
  "desc": "가는 곳마다 그 지역 요리를 배워 오는 사람"
 },
 "food-trad": {
  "name": "종갓집 종부",
  "desc": "오래된 맛을 지켜 이어 가는 사람"
 },
 "sight-sight": {
  "name": "명승 안내인",
  "desc": "가장 아름다운 순간을 골라 보여 주는 사람"
 },
 "sight-travel": {
  "name": "팔도 유람객",
  "desc": "보고, 걷고, 타며 전국을 즐긴 사람"
 },
 "sight-trad": {
  "name": "도화서 화원",
  "desc": "옛 풍경과 놀이를 그림처럼 담는 사람"
 },
 "travel-travel": {
  "name": "방랑 시인",
  "desc": "발길 닿는 대로 걸으며 이야기를 남기는 사람"
 },
 "travel-trad": {
  "name": "암행어사",
  "desc": "몰래 다니며 전국 구석구석의 옛것을 찾아낸 사람"
 },
 "trad-trad": {
  "name": "무형 전수자",
  "desc": "사라지면 안 될 놀이와 소리를 이어 받은 사람"
 }
};
