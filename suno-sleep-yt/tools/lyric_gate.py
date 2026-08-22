# -*- coding: utf-8 -*-
r"""
추억 감성가요 — 가사 게이트 v3 검증기 (CLAUDE.md §✍️ v2 + §🔊🔝 EP06 개정 · 2026-08-21)

v3 변경 (근거 = research\oktapbang\_분석-텍스트.md §8 · 2026-08-19 사용자 청취 판정):
  🆕 컨셉어 카운터 — 한 단어 곡당 3회 이하 + 세트 전 곡 공통 단어 0개 (EP05 「새벽」 곡당 9.8회 사고)
  🆕 시간대어(밤·새벽·저녁) 곡당 2회 이하·세트 3곡 이하 / 부사(자꾸·괜히류) 곡당 3회 이상
  🆕 제목 게이트 3열 — 부정·상실어 0~1 · 시간대어 0~1 · 부사 선행형 2개 이상
  🆕 완료형 후렴 금지(설렘 편) — 후렴 끝행 「~했어/버렸어/없어/끝났어」
  🔧 부정(못/안/않) = 상한 2 (하한 폐지) · 가정문 = 상한 1 (필수 폐지·브릿지 한정은 눈으로)
  🔧 미종결 25~35% · 「~는데」 곡당 2행 이하 · 「~을까」 1행 이하 · 「사랑」 곡당 상한 4
  🔧 그대계 0~2곡 · 눈물 등장 세트 0~2곡 · 이별 등장 세트 0~1곡
  🔧 현대 소품 시대 분기 — 2000년대 편이라 「문자」 허용, 영구금지에 스마트폰·인스타·읽씹·에어팟·배달앱 추가

  py -3 tools\lyric_gate.py <Suno프롬프트파일>

🚦 **이 표를 출력해 붙이기 전에는 발행 금지.** EP01은 게이트 10개 중 4개 미달인 채 나갔다
   (규칙 위반이 아니라 규칙 미실행). 실패 항목은 가사를 고쳐 통과시킨 뒤 Suno 생성에 들어간다.

입력 = 곡마다 【LYRICS】…【STYLE】 / 【TITLE】 블록이 있는 프롬프트 파일.
      블록이 하나도 없으면 파일 전체를 곡 1개로 본다.

⚠ 자동 판정이 불가능한 항목이 3개 있다 — **사람이 눈으로 봐야 한다**(맨 아래 수동 체크리스트).
   ①후렴이 완결문인가 ②곡당 사건이 있는가 ③화자 상황 배분.
⚠ '미종결 연결행'은 종결어미 사전 기반 **추정치**다. 합불 판정에 쓰되 경계값은 눈으로 확인할 것.
"""
import os, sys, io, re

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

if len(sys.argv) < 2:
    sys.exit('사용: lyric_gate.py <Suno프롬프트파일>')
PATH = sys.argv[1]
if not os.path.exists(PATH):
    sys.exit('파일 없음: %s' % PATH)

RAW = open(PATH, encoding='utf-8').read()

# ── 게이트 기준 (CLAUDE.md §📏 수치 게이트 v2) ─────────────────────────
G = {
    'chars':      (400, 460),   # 총 글자수(공백 제외) · 하한 350은 경고선
    'lines':      (34, 38),
    'syl_line':   (11.0, 13.0),
    'rep':        (15.0, 35.0), # 6자 shingle 반복률 % (실측 근거 = 상한 12→35 · 하한 15 신설)
    'first':      (9, 11),      # 1인칭
    'second':     (7, 9),       # 2인칭
    # 🔧 v3 — 부정은 **상한**으로 반전됐다(§8-2). 우리 「못」이 옥탑방의 11배였다.
    #   (v2의 "하한만 건다" 논리는 v1 근거였고, 옥탑방 실측이 방향을 뒤집었다)
    'neg':        (None, 2),    # 부정 못/안/않 — 상한 2 · 하한 폐지
    'ifs':        (None, 1),    # 가정문 ~다면 — 상한 1 (브릿지 한정은 사람이 눈으로)
    'quest':      (2, None),    # 의문형 종결 행수 (단 「~을까」는 1행까지 — 별도 검사)
    'unfin':      (25.0, 35.0), # 미종결 연결행 % — v2 35~45 에서 하향(설명체 과밀 교정)
    'props':      (0, 2),       # 소품 종수
    'chorus_rep': (3, None),    # 후렴 같은 행 반복 최대
    'sarang':     (None, 4),    # 「사랑」 곡당 상한 (옥탑방 0.2회/곡 · 우리 3.3회)
    'nunde':      (None, 2),    # 「~는데」 행수 — 우리 2위 어절(2.24%) 교정
    'eulkka':     (None, 1),    # 「~을까」 행수 — 1.06% 과밀 교정
    'adv':        (3, None),    # 속도·정도 부사 합계 하한 — 옥탑방 종결 상위가 전부 부사
    'time':       (None, 2),    # 시간대어(밤·새벽·저녁) 합계 상한 — 우리 1.6/100자 vs 옥탑방 0.1
    'concept':    (None, 3),    # 🚨 컨셉어 — 한 단어 곡당 3회 이하 (EP05 「새벽」 9.8회/곡)
}
CHARS_HARD_MIN = 350
REP_HARD_MIN = None

HAN = re.compile(r'[가-힣]')
TAG = re.compile(r'^\s*\[[^\]]+\]\s*$')
PUNCT = ' \t.,!?~…"\'`·—-()'

FIRST_P = re.compile(r'^(나|난|날|내|우리|우린|우릴|저|제)([은는이가을를도만의와과랑]|에게|에겐|한테|보다)?$')
SECOND_P = re.compile(r'^(너|넌|널|네|니|그대)([은는이가을를도만의와과랑]|에게|에겐|한테|보다)?$')
GEUDAE = re.compile(r'그대')
NEO = re.compile(r'^(너|넌|널|네|니)([은는이가을를도만의와과랑]|에게|에겐|한테)?$')

# '미종결 연결행' = 행이 **연결어미**로 끝나 다음 행으로 이어지는 것.
# ⚠ 처음엔 "종결어미 사전에 안 걸리면 미종결"로 셌는데, 그러면 **체언 종결 행**(…아침 / …자리)이
#   전부 미종결로 잡혀 EP01이 60%로 나왔다(독립 진단 실측 27.8%의 2배). 연결어미를 직접 세는 쪽이 맞다.
CONN = ('고', '서', '며', '면서', '면', '는데', 'ㄴ데', '은데', '지만', '거나', '든지',
        '어도', '아도', '도록', '려고', '니까', '아서', '어서', '다가', '듯', '처럼', '같이', '채')
QUEST = re.compile(r'(까|ㄹ까|을까|니|냐|나요|가요|는지)[\?]?$|\?$')
IFS = re.compile(r'(다면|라면|더라면|었다면|였다면)')
# 🐞 v2.1 수정 — 옛 식 r'(않|못하|못\s|안\s|없)' 은 두 군데서 틀렸다:
#   ① '없'을 포함시켜 "없어/없이/없는"까지 셌다. 규칙 문구는 **못/안/않** 이지 '없'이 아니다.
#      '없'은 90년대 발라드의 기본 어휘라(부정 44.3/만자 = 눈물보다 흔함) 상한 2회에 걸려
#      자연스러운 문장을 계속 우회하게 만들었다.
#   ② '안\s'가 "동안 "·"한동안 "을 오탐했다(EP02 곡7에서 실제 발생).
NEG = re.compile(r'않|(?<![가-힣])못|(?<![가-힣])안(?=\s)')
HONOR = re.compile(r'(어요|아요|에요|예요|세요|합니다|습니다|입니다|나요|까요|겠어요)$')

PROPS = ['창가', '창문', '커피', '이어폰', '버스', '침대', '편의점', '우산', '알람', '신호',
         '전화', '편지', '사진', '거울', '시계', '가방', '의자', '골목', '지하철', '카톡',
         '라디오', '카세트', '테이프', '삐삐', '담요', '빵', '컵', '노트', '책상', '이불',
         '정거장', '벤치', '가로등', '자전거', '휴대폰', '핸드폰']
# 🔧 v3 — 감정어에 설렘 계열 추가 (§👤: 설렘 편 제목의 감정어는 설렘 계열로 채운다)
EMO_T = ['사랑', '이별', '눈물', '그리', '보고', '아픔', '아파', '슬픔', '슬퍼', '기다',
         '마음', '미련', '추억', '잊', '떠나', '헤어', '가슴', '외로', '후회',
         '설레', '마주', '나란히', '스며', '가까워', '웃']
BAN_WORD = {'당신': re.compile(r'당신'), '운명': re.compile(r'운명'),
            # 🆕 §8-3 감정어 직접 서술 금지 — 설렘은 행동으로만 (옥탑방 42곡 등장 0회)
            '설레(직접서술)': re.compile(r'설레'), '두근': re.compile(r'두근'),
            '떨려(직접서술)': re.compile(r'떨려|떨리')}
BAN_HEAL = ['천천히 가도', '괜찮은', '이대로 좋아', '충분해', '그걸로 됐어']
BAN_CANCEL = [r'뜻은 아니', r'건 아닌데', r'별거 아니', r'그런 건 아니']
# 🔧 v3 시대 분기(§8-3) — 이 채널은 현재 2000년대 편. 「문자」는 허용으로 이동,
#   영구금지에 스마트폰·인스타·읽씹·에어팟·배달앱 추가. (90년대 편으로 돌아가면 문자도 다시 금지)
BAN_MODERN = ['카톡', '편의점', '지하철', '이어폰', '휴대폰', '핸드폰',
              '스마트폰', '인스타', '읽씹', '에어팟', '배달']
WATCH = ['밤', '방', '문', '불', '창', '봄', '여름', '가을', '겨울', '저녁',
         '눈물', '사랑', '자리', '기다']
SEASON = ['봄', '여름', '가을', '겨울']
# 🆕 v3 — 부사 하한(§8-2)·제목 부사 선행형(§8-4)
ADV = ['자꾸', '괜히', '먼저', '조금씩', '문득', '굳이', '아직', '슬쩍', '천천히']
TIMEW = ['밤', '새벽', '저녁']
TITLE_NEG = ['안 ', '못', '없', '않', '사라', '떠나', '잊', '끝']
# 🆕 v3 — 컨셉어 카운터에서 제외할 기능어·문법 형태 앞머리 (명사가 아닌 것들).
#   ⚠️ EP05 캘리브레이션으로 다듬은 목록 — 지우면 오탐이 되살아난다.
STOP2 = {'그대', '우리', '당신', '그냥', '이제', '다시', '너무', '정말', '조금', '아직',
         '아무', '어디', '언제', '무슨', '다른', '모든', '모두', '함께', '혼자', '괜히',
         '자꾸', '먼저', '문득', '굳이', '슬쩍', '천천', '있어', '있는', '있다', '없어',
         '없는', '없이', '같아', '같은', '같이', '하는', '하던', '했던', '해도', '하지',
         '않아', '않은', '않고', '못해', '아니', '그런', '이런', '저런', '그렇', '이렇',
         '어떻', '왜냐', '해서', '그래', '그리', '이미', '결국', '오늘', '내일', '어제',
         # 활용어미·의존명사 조각 (EP05 캘리브레이션에서 오탐으로 확인 — 어휘가 아니라 문법이다.
         #  ⚠️ 웃으/살고/끝나 같은 **내용 용언**은 일부러 안 거른다 — 그 도배는 잡혀야 한다)
         '했어', '거야', '거는', '건데', '건지', '였어', '이야', '인데', '인지', '일까',
         '있을', '있고', '있지', '있잖', '됐어', '된다', '되는', '때문', '동안'}


def parse(raw):
    """【LYRICS】…【STYLE】 / 【TITLE】 로 곡을 자른다."""
    songs = []
    idx = [m.start() for m in re.finditer(r'【LYRICS】', raw)]
    if not idx:
        return [{'no': 1, 'title': os.path.basename(PATH), 'lyrics': raw}]
    for n, s in enumerate(idx):
        end = raw.find('【STYLE】', s)
        body = raw[s + len('【LYRICS】'):end if end > 0 else len(raw)]
        # ⚠ 파일 머리말의 설명문에도 '【LYRICS】' 라는 글자가 나온다(블록 순서 안내 등).
        #   그게 곡 1개로 잡혀 표가 한 칸씩 밀렸다 → 본문이 8행 미만이면 곡이 아니다.
        real = [l for l in body.split('\n') if l.strip() and not TAG.match(l)]
        if len(real) < 8:
            continue
        nxt = idx[n + 1] if n + 1 < len(idx) else len(raw)
        tm = re.search(r'【TITLE】\s*\n?\s*([^\n]+)', raw[s:nxt])
        songs.append({'no': len(songs) + 1,
                      'title': (tm.group(1).strip() if tm else '(제목없음)'),
                      'lyrics': body})
    return songs


def measure(song):
    lines = [l.strip() for l in song['lyrics'].split('\n')]
    lines = [l for l in lines if l and not TAG.match(l)]
    text = '\n'.join(lines)
    flat = re.sub(r'\s+', '', text)

    m = {}
    m['lines'] = len(lines)
    m['chars'] = len(flat)
    syls = [len(HAN.findall(l)) for l in lines]
    m['syl_line'] = round(sum(syls) / len(syls), 2) if syls else 0.0

    # 6자 shingle 반복률
    sh = [flat[i:i + 6] for i in range(max(0, len(flat) - 5))]
    m['rep'] = round((1 - len(set(sh)) / len(sh)) * 100, 1) if sh else 0.0

    # 같은 행 최대 반복(후렴)
    norm = [re.sub(r'[%s]' % re.escape(PUNCT), '', l) for l in lines]
    counts = {}
    for l in norm:
        if len(l) >= 4:
            counts[l] = counts.get(l, 0) + 1
    m['chorus_rep'] = max(counts.values()) if counts else 0

    # 인칭
    toks = [t.strip(PUNCT) for t in text.replace('\n', ' ').split(' ')]
    toks = [t for t in toks if t]
    # 🐞 v2.1 — '날'은 "나를"(1인칭)이기도 하고 "day"이기도 하다.
    #   앞 토큰이 관형형(-던/-은/-는)이거나 지시어면 day 로 보고 1인칭에서 뺀다.
    #   (안 고치면 "돌아서던 날"·"짐을 풀던 날"이 1인칭으로 계수돼 EP02 곡5가 19회로 나왔고,
    #    작가가 그걸 피하려 훅을 "돌아서던 그 밤"으로 바꿨다 = **가사가 채점기에 맞춰 휘었다.**)
    DET = ('그', '이', '저', '오늘', '내일', '어제', '매', '첫', '그런', '지난')
    cnt = 0
    for k, t in enumerate(toks):
        if not FIRST_P.match(t):
            continue
        if t.startswith('날'):
            prev = toks[k - 1] if k else ''
            if prev in DET or prev.endswith(('던', '은', '는', 'ㄴ')):
                continue
        cnt += 1
    m['first'] = cnt
    m['second'] = sum(1 for t in toks if SECOND_P.match(t))
    m['geudae'] = len(GEUDAE.findall(text))
    m['neo'] = sum(1 for t in toks if NEO.match(t))

    # 어휘·문법
    m['sarang'] = len(re.findall(r'사랑', text))
    m['nunmul'] = len(re.findall(r'눈물', text))
    m['ibyeol'] = len(re.findall(r'이별', text))
    m['neg'] = len(NEG.findall(text))
    m['ifs'] = len(IFS.findall(text))
    m['quest'] = sum(1 for l in lines if QUEST.search(re.sub(r'[%s]' % re.escape(' .,!~…'), '', l)))

    # 🆕 v3 — §8-2 신설 게이트
    m['nunde'] = sum(1 for l in lines if '는데' in l)
    m['eulkka'] = sum(1 for l in lines
                      if re.search(r'(을까|ㄹ까)', re.sub(r'[%s]' % re.escape(' .,!~…?'), '', l)[-4:]))
    m['adv'] = sum(text.count(a) for a in ADV)
    m['time'] = sum(text.count(w) for w in TIMEW)

    # 🆕 v3 — 컨셉어 카운터. 토큰 앞 2글자를 명사 근사치로 센다(한국어 명사는 어절 앞에 온다).
    #   조사·어미는 어절 뒤라 안 잡히고, 남는 오탐(용언 활용형·기능어)은 STOP2 로 거른다.
    pref = {}
    for t in toks:
        w = t.strip(PUNCT)
        if len(w) < 2 or not re.match(r'^[가-힣]+$', w):
            continue
        if FIRST_P.match(w) or SECOND_P.match(w):
            continue
        p = w[:2]
        if p in STOP2:
            continue
        pref[p] = pref.get(p, 0) + 1
    m['concept_over'] = sorted(((w, c) for w, c in pref.items() if c > G['concept'][1]),
                               key=lambda x: -x[1])
    m['concept'] = max(pref.values()) if pref else 0
    m['prefset'] = set(pref)

    # 🆕 v3 — 완료형 후렴 금지(설렘 편·§8-3). 3회 이상 반복되는 행(=후렴)의 끝을 본다.
    m['chorus_done'] = sorted({l for l, c in counts.items() if c >= 3
                               and l.endswith(('했어', '버렸어', '없어', '끝났어'))})

    conn = sum(1 for l in lines if l.rstrip(PUNCT).endswith(CONN))
    m['unfin'] = round(conn / len(lines) * 100, 1) if lines else 0.0

    m['honor'] = sum(1 for l in lines if HONOR.search(l.rstrip(PUNCT)))
    m['props_list'] = sorted({p for p in PROPS if p in text})
    m['props'] = len(m['props_list'])

    # 어휘 편중 — 한 단어가 한 곡에 8회 이상이면 경고(판정은 사람이).
    # EP02 곡5가 '밤' 19회였다. 채점기 오탐('날'을 1인칭으로 셈)을 피하려다 그렇게 됐다.
    m['skew'] = [(w, text.count(w)) for w in WATCH if text.count(w) >= 8]
    m['season'] = {s: text.count(s) for s in SEASON if text.count(s)}

    m['ban'] = []
    for w, rx in BAN_WORD.items():
        if rx.search(text):
            m['ban'].append(w)
    for w in BAN_HEAL:
        if w in text:
            m['ban'].append('힐링:' + w)
    for rx in BAN_CANCEL:
        if re.search(rx, text):
            m['ban'].append('감정취소:' + rx.replace('\\', ''))
    for w in BAN_MODERN:
        if w in text:
            m['ban'].append('현대소품:' + w)
    return m


def chk(v, key, warn_min=None):
    lo, hi = G[key]
    if warn_min is not None and v < warn_min:
        return 'FAIL'
    if lo is not None and v < lo:
        return 'FAIL' if warn_min is None else 'WARN'
    if hi is not None and v > hi:
        return 'FAIL'
    return 'ok'


def cell(v, st):
    mark = {'ok': ' ', 'WARN': '!', 'FAIL': 'X'}[st]
    return '%s%s' % (str(v), mark)


songs = parse(RAW)
print('=' * 96)
print(' 가사 게이트 v3  —  %s' % os.path.basename(PATH))
print(' 곡 %d개 · 기준 = §✍️ v2 + §8 EP06 개정안(oktapbang) · 캘리브레이션 = EP05 새벽 8/8곡 검출 확인' % len(songs))
print('=' * 96)

rows, fails = [], 0
for s in songs:
    m = measure(s)
    st = {
        'chars': chk(m['chars'], 'chars', CHARS_HARD_MIN),
        'lines': chk(m['lines'], 'lines'),
        'syl_line': chk(m['syl_line'], 'syl_line'),
        'rep': chk(m['rep'], 'rep', REP_HARD_MIN),
        'chorus_rep': chk(m['chorus_rep'], 'chorus_rep'),
        'first': chk(m['first'], 'first'),
        'second': chk(m['second'], 'second'),
        'neg': chk(m['neg'], 'neg'),
        'ifs': chk(m['ifs'], 'ifs'),
        'quest': chk(m['quest'], 'quest'),
        'unfin': chk(m['unfin'], 'unfin'),
        'props': chk(m['props'], 'props'),
        'sarang': chk(m['sarang'], 'sarang'),
        'nunde': chk(m['nunde'], 'nunde'),
        'eulkka': chk(m['eulkka'], 'eulkka'),
        'adv': chk(m['adv'], 'adv'),
        'time': chk(m['time'], 'time'),
        'concept': chk(m['concept'], 'concept'),
    }
    if m['chorus_done']:
        st['chorus_rep'] = 'FAIL'      # 완료형 후렴(설렘 편 금지)
    if m['first'] < m['second']:
        st['first'] = 'FAIL'          # 1인칭 ≥ 2인칭
    if m['geudae'] and m['neo']:
        st['second'] = 'FAIL'          # 곡 안 호칭 혼용 금지
    if m['ban']:
        st['props'] = 'FAIL'
    n_fail = sum(1 for v in st.values() if v == 'FAIL')
    fails += n_fail
    rows.append((s, m, st, n_fail))

hdr = ('곡', '제목', '글자', '행', '음절', '반복%', '후렴', '1인', '2인', '부정', '가정', '의문',
       '미종%', '소품', '부사', '시간', '컨셉')
print('\n%-3s %-12s %6s %4s %6s %7s %5s %5s %5s %5s %5s %5s %7s %5s %5s %5s %5s' % hdr)
print('-' * 114)
for s, m, st, nf in rows:
    print('%-3d %-12s %6s %4s %6s %7s %5s %5s %5s %5s %5s %5s %7s %5s %5s %5s %5s' % (
        s['no'], s['title'][:12],
        cell(m['chars'], st['chars']), cell(m['lines'], st['lines']),
        cell(m['syl_line'], st['syl_line']), cell(m['rep'], st['rep']),
        cell(m['chorus_rep'], st['chorus_rep']),
        cell(m['first'], st['first']), cell(m['second'], st['second']),
        cell(m['neg'], st['neg']), cell(m['ifs'], st['ifs']),
        cell(m['quest'], st['quest']), cell(m['unfin'], st['unfin']),
        cell(m['props'], st['props']),
        cell(m['adv'], st['adv']), cell(m['time'], st['time']),
        cell(m['concept'], st['concept'])))
print('-' * 114)
print('기준  400~460  34~38  11~13  15~35  3+  9~11  7~9  ≤2  ≤1  2+  25~35  0~2  3+  ≤2  ≤3   (X=미달 !=경고)')
print('      부사=자꾸·괜히·먼저·조금씩·문득·굳이·아직·슬쩍 합계 · 시간=밤·새벽·저녁 합계 · 컨셉=한 단어 최대 등장')

# 곡별 상세 지적
print('\n[곡별 지적]')
any_note = False
for s, m, st, nf in rows:
    notes = []
    if m['ban']:
        notes.append('금지 %s' % ', '.join(m['ban']))
    if m['props_list']:
        notes.append('소품 %s' % '/'.join(m['props_list']))
    if m['first'] < m['second']:
        notes.append('1인칭(%d) < 2인칭(%d)' % (m['first'], m['second']))
    if m['geudae'] and m['neo']:
        notes.append('호칭 혼용 (그대 %d · 너 %d)' % (m['geudae'], m['neo']))
    if m['skew']:
        notes.append('⚠ 어휘 편중 %s' % ', '.join('%s %d회' % x for x in m['skew']))
    if m['concept_over']:
        notes.append('🚨 컨셉어 초과 %s' % ', '.join('%s %d회' % x for x in m['concept_over']))
    if m['chorus_done']:
        notes.append('⛔ 완료형 후렴 "%s"' % '" / "'.join(m['chorus_done']))
    if m['nunde'] > G['nunde'][1]:
        notes.append('「~는데」 %d행 (상한 2)' % m['nunde'])
    if m['eulkka'] > G['eulkka'][1]:
        notes.append('「~을까」 %d행 (상한 1)' % m['eulkka'])
    if notes:
        any_note = True
        print('  곡%-2d %-12s : %s' % (s['no'], s['title'][:12], ' | '.join(notes)))
if not any_note:
    print('  없음')

# ── 세트 단위 ────────────────────────────────────────────────────────
n = len(songs)
g_songs = [s['no'] for s, m, st, _ in rows if m['geudae'] > 0]
n_songs = [s['no'] for s, m, st, _ in rows if m['neo'] > 0 and m['geudae'] == 0]
h_songs = [s['no'] for s, m, st, _ in rows if m['honor'] >= max(2, m['lines'] * 0.2)]
sa_songs = [s['no'] for s, m, st, _ in rows if m['sarang'] > 0]
nu_songs = [s['no'] for s, m, st, _ in rows if m['nunmul'] > 0]
ib_songs = [s['no'] for s, m, st, _ in rows if m['ibyeol'] > 0]


def setchk(label, got, lo, hi, detail=''):
    global fails
    bad = (lo is not None and got < lo) or (hi is not None and got > hi)
    if bad:
        fails += 1
    rng = '%s~%s' % (lo if lo is not None else '', hi if hi is not None else '')
    print('  %-22s %2d곡  (기준 %-6s) %s %s' % (label, got, rng, 'X' if bad else 'ok', detail))


print('\n[세트 단위]  (8곡 기준. 곡 수가 다르면 비례로 읽을 것)')
setchk('그대계 곡', len(g_songs), 0, 2, str(g_songs))   # 🔧 v3 §8-1: 2000년대 화법상 그대 2곡 이하
setchk('너계 곡', len(n_songs), 5, 8, str(n_songs))
setchk('존대 곡', len(h_songs), 1, 2, str(h_songs))
setchk('사랑 등장 곡', len(sa_songs), 6, 7, str(sa_songs))
setchk('눈물 등장 곡', len(nu_songs), 0, 2, str(nu_songs))   # 🔧 v3 §8-2: 설렘 편
setchk('이별 등장 곡', len(ib_songs), 0, 1, str(ib_songs))   # 🔧 v3: 상실어 최소화

# 🆕 v3 — 시간대어 세트 상한(§8-2): 등장 곡 3곡 이하
t_songs = [s['no'] for s, m, st, _ in rows if m['time'] > 0]
setchk('시간대어 등장 곡', len(t_songs), 0, 3, str(t_songs))

# 🆕 v3 — 🚨 컨셉어 카운터(§8-6): 세트 전 곡에 등장하는 단어(2글자 명사 근사)는 0개여야 한다.
#   옥탑방은 한 편 7곡에 공통으로 나오는 단어가 0개다. EP05는 「새벽」이 8/8곡이었다.
if len(rows) >= 2:
    common = set.intersection(*[m['prefset'] for _, m, _, _ in rows])
    common -= {a[:2] for a in ADV}          # 부사는 명사가 아니다(부사 하한과 충돌 방지)
    if common:
        fails += 1
        print('  %-22s %2d개  (기준 0)      X %s' % ('전곡 공통 단어', len(common),
              ' · '.join(sorted(common))))
    else:
        print('  %-22s  0개  (기준 0)      ok' % '전곡 공통 단어')

# 계절 고유명사 — 판정하지 않고 **숫자만** 보여준다.
# 90s 74곡 실측에서 봄·겨울은 만자당 한 자릿수라 "규칙을 만들지 말라"고 보고됐다.
# 그래서 하드 기준을 세우지 않는다. 다만 세트에 몰리면 눈에 띄어야 한다.
sea = {}
for s_, m, st, _ in rows:
    for k, v in m['season'].items():
        sea[k] = sea.get(k, 0) + v
if sea:
    print('  %-22s %s   (판정 안 함 · 세트에 몰리면 눈으로 볼 것)'
          % ('계절어 총계', ' · '.join('%s %d회' % kv for kv in sorted(sea.items(), key=lambda x: -x[1]))))

# ── 제목 게이트 v4 = **실제 2000년대 343곡 실측** (2026-08-21 · 옥탑방판 폐기) ─────────
# ⛔ v3까지의 제목 게이트(4~7자·부사 선행형 2+·2인칭 2~3·감정어 2~3)는 옥탑방=AI 니치 채널
#    실측이었고, 그 규칙을 지킨 EP06 1차 제목 8개를 사용자가 "너무 AI 느낌"으로 전량 기각했다.
#    부사 선행 = 실측 0.3%(343곡 중 1곡)인데 옛 게이트는 2개 이상을 **요구**했다 — 80배 역방향.
#    기준 전문 = research\title2000s\_제목규칙.md (원자료 343곡 = _원자료.tsv)
print('\n[제목 게이트 v4 — 실제 2000년대 343곡 실측 기준]')
titles = [s['title'] for s, m, st, _ in rows]
t_len = [len(t.replace(' ', '')) for t in titles]
t_2nd = [t for t in titles if SECOND_P.match(t.split(' ')[0].strip(PUNCT)) or '그대' in t
         or re.search(r'(너|넌|널|네가|니가|당신)', t)]
t_go = [t for t in titles if t.rstrip(PUNCT).endswith(('고', '며', '서'))]
too_short = [t for t, L in zip(titles, t_len) if L < 2]
long8 = [t for t, L in zip(titles, t_len) if L >= 8]

TITLE_ADV2 = ADV + ['나란히', '일부러', '다시', '벌써']   # 제목 전용 — 가사 부사 하한과는 별개 목록
t_adv = [t for t in titles if any(t.startswith(a) for a in TITLE_ADV2)]
t_sarang = [t for t in titles if '사랑' in t]
w1 = [t for t in titles if len(t.split()) == 1]
w3p = [t for t in titles if len(t.split()) >= 3]

JOSA_END = ('에서', '까지', '부터', '처럼', '보다', '에게', '에겐', '으로', '한테', '에', '로', '와', '과', '랑', '도', '만')
VERB_END = ('다', '어', '아', '야', '요', '네', '지', '자', '까', '니', '나', '게', '래', '걸', '봐', '줘', '해')


def kind(t):
    """제목 유형 근사 — 조사 종결을 먼저 본다(「~까지」의 '지'가 종결어미로 오인되지 않게)."""
    w = t.strip(PUNCT)
    if w.endswith(('고', '며', '서')) and len(w.split()) > 1:
        return 'conn'
    if any(w.endswith(j) for j in JOSA_END) and len(w) > 2:
        return 'josa'
    if any(w.endswith(v) for v in VERB_END):
        return 'verb'
    return 'noun'


kinds = [kind(t) for t in titles]
n_noun = kinds.count('noun')
n_verb = kinds.count('verb')
n_josa = kinds.count('josa') + kinds.count('conn')


def shape(t):
    return tuple(w.strip(PUNCT)[-1:] for w in t.split(' ') if w.strip(PUNCT))


dups = []
for a in range(len(titles)):
    for b in range(a + 1, len(titles)):
        sa, sb = shape(titles[a]), shape(titles[b])
        if len(sa) == len(sb) and sa and \
           sum(1 for x, y in zip(sa, sb) if x == y) / len(sa) >= 0.5:
            dups.append('%s ↔ %s' % (titles[a], titles[b]))

t_neg = [t for t in titles if any(w in t for w in TITLE_NEG)]
t_time = [t for t in titles if any(w in t for w in TIMEW)]

for label, got, lo, hi, det in [
        ('1어절 제목', len(w1), 3, 4, str(w1)),                     # 실측 44.5%
        ('3어절 이상 제목', len(w3p), 0, 2, str(w3p)),               # 실측 15.5%+6.2%
        ('명사·명사구형', n_noun, 4, 5, ''),                         # 실측 49.0%
        ('서술완결형', n_verb, 2, 3, ''),                            # 실측 28.0%
        ('조사·연결형', n_josa, 0, 1, ''),                           # 실측 3.2%+4.4%
        ('부사 선행형 제목', len(t_adv), 0, 0, str(t_adv)),           # 🔴 실측 0.3% — AI 티의 정체
        ('2인칭 포함 제목', len(t_2nd), 0, 1, str(t_2nd)),            # 실측 6.9%
        ('「사랑」 포함 제목', len(t_sarang), 0, 2, str(t_sarang)),    # 실측 18.3%
        ('부정·상실어 제목', len(t_neg), 0, 1, str(t_neg)),           # 실측 3.8%
        ('시간대어 제목', len(t_time), 0, 0, str(t_time)),            # 실측 0.0% (343곡 중 0곡)
        ('연결어미(-고) 종결', len(t_go), 0, 1, str(t_go)),
        ('2자 미만 제목', len(too_short), 0, 0, str(too_short)),
        ('8자 이상 제목', len(long8), 0, 1, str(long8)),              # 실측 13.4%
        ('구조 복제 쌍', len(dups), 0, 0, str(dups))]:
    bad = (lo is not None and got < lo) or (hi is not None and got > hi)
    if bad:
        fails += 1
    print('  %-20s %2d  (기준 %s~%s) %s %s' % (label, got,
          lo if lo is not None else '', hi if hi is not None else '',
          'X' if bad else 'ok', det if bad else ''))
print('  (유형 분류는 어미 휴리스틱 근사치 — 경계 사례는 눈으로. 형(型) 5개 = 단일명사·짧은완결문·명사+명사·숫자형·조사종결)')

# ── 결론 ─────────────────────────────────────────────────────────────
print('\n' + '=' * 96)
if fails:
    print(' ❌ 실패 항목 %d개 — **발행 금지.** 가사를 고쳐 통과시킨 뒤 Suno 생성에 들어갈 것.' % fails)
else:
    print(' ✅ 자동 게이트 전 항목 통과.')
print('=' * 96)

print("""
[사람이 눈으로 봐야 하는 것 — 자동 판정 불가. 통과해도 이 3개를 안 보면 EP01 이 반복된다]
  □ 후렴이 **서술어로 끝나는 완결문**인가?  (8곡 중 6곡 이상)
      ⛔ EP01 은 7/8 이 명사구였다 — "먼저 웃는 마음" · "느려진 저녁"
  □ **곡당 사건이 1개** 있는가?  (8곡 중 6곡) 무슨 일이 일어났는지가 없으면 감정이 설 자리가 없다
  □ **화자 배분(2026-08-19 반전)** — 설렘·진행중 100% · 상실 0곡. 8곡을 가르는 축은 정서가 아니라
      **관계의 8단계**(인지→관찰→첫 접점→구실→기다림→동행→자각→문턱). 단계 중복 금지
  □ **가정문이 브릿지에만** 있는가? (자동 검사는 개수만 센다 — 위치는 눈으로)
  □ (발행 전) 제목 8개를 멜론·유튜브에서 검색해 **동명 히트곡** 확인

[읽는 법]
  · '미종%'(미종결 연결행)은 종결어미 사전 기반 **추정치**다. 경계값이면 눈으로 확인할 것.
  · 게이트는 **품질 하한선**이다. 통과했다고 좋은 가사가 되는 게 아니다.
    가사↔조회수 상관은 세 조사 모두 |r|<0.25 였다 (CLAUDE.md §🚨).
""")
sys.exit(1 if fails else 0)
