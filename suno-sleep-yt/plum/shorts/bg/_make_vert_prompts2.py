# -*- coding: utf-8 -*-
r"""
쇼츠 세로 배경 2차 — 2026-09-02. **쇼츠 1편 = 고유 배경 1장** 규칙(사용자 지시 "중복 배경은 안 돼").

편당 세로 배경 1장을 3편이 공유하던 구조를 폐기한다. 기존 와이드는 편당 1편만 남기고,
나머지 2편은 같은 씬을 **다른 구도**로 재구성한다(close = 입구 클로즈업 / inside = 실내에서 바깥 조망).
컨셉·건축은 그 편 본편 배경(img2img 원본)을 그대로 상속하므로 정합은 깨지지 않는다.

  node auto_gemini_bg.js --image plum/ep06/bg/bg_ep06_final.png \
       --prompt-file plum/shorts/bg/ep06_close_vert.txt --out plum/shorts/bg/ep06_close_vert.png --no-prefix
  (ep06/ep07/ep08 × close/inside = 6장. 소스는 각 편 bg_epNN_final.png)

✦ 워터마크 = 생성본 아래 ~10%(1024 기준 103px)를 잘라 *_final.png 로 저장(기존 관행 그대로).
"""
import io, os

HERE = os.path.dirname(os.path.abspath(__file__))

COMMON_TAIL = (
    "Same matte opaque gouache medium: clean simple shapes, crisp edges, very little shading, a limited "
    "pastel palette, subtle cold-press paper texture, visible brush-laid flat washes. Bright airy high-key "
    "light, low saturation pastel tones, deep plum purple used as the single accent colour. Completely empty "
    "of people. No utility poles, no overhead wires. No text anywhere except the small wall sign. "
    "Not photorealistic, no 3D render, no glossy highlights. Not a flat vector cartoon, no thick outlines. "
    "Full bleed, filling the entire vertical rectangular frame edge to edge, no border, no margin, no vignette."
)

P = {}

# ── EP06 트로피컬 라운지 ──────────────────────────────────────────────
P['ep06_close_vert'] = (
    "Repaint this exact same place as a tall vertical 9:16 portrait composition (1080x1920), but move the "
    "camera much closer, straight in front of the open entrance bay of the same cream resort lounge. "
    "The wide opening now fills most of the frame: the warmly lit shaded interior with the long stone counter, "
    "the row of rattan chairs, and soft pendant lights inside, the warm pale timber louvres running above the "
    "opening, the same small sign reading \"plum music\" on the wall beside it, and the cream-and-grey cat "
    "sitting on the paving just in front of the entrance. A slim slice of the deep roof overhang and sky at "
    "the top, sunlit paving with long soft palm shadows at the bottom, a glimpse of turquoise sea through the "
    "interior opening. Keep every material and colour of this building exactly the same, only the framing "
    "changes. " + COMMON_TAIL
)

P['ep06_inside_vert'] = (
    "Repaint this exact same place as a tall vertical 9:16 portrait composition (1080x1920), but from just "
    "inside the same cream resort lounge, looking out through the tall open entrance toward the light. "
    "In the shaded foreground: the end of the long stone counter and one or two rattan chairs, rendered in "
    "soft cool shadow tones. Through the bright opening: the sunlit paving, the tall palms laying long soft "
    "shadows, the stone planter with the monstera, and the turquoise sea and clear sky beyond, with the "
    "cream-and-grey cat sitting in the sunlit doorway. The small sign reading \"plum music\" visible on the "
    "wall by the opening. Keep every material and colour of this building exactly the same, only the "
    "viewpoint changes. " + COMMON_TAIL
)

# ── EP07 반사 연못 위 원형 유리 파빌리온 ─────────────────────────────
P['ep07_close_vert'] = (
    "Repaint this exact same place as a tall vertical 9:16 portrait composition (1080x1920), but move the "
    "camera much closer, straight in front of the central bay of the same round glass pavilion, standing on "
    "the stone causeway. The bronze-framed glass doors folded fully back now fill most of the frame, showing "
    "the warmly lit interior with the curved stone counter, the row of wooden stools and the pendant lights. "
    "The same small sign reading \"plum music\" beside the opening, the curved glass walls falling away to "
    "each side, a slim slice of the thin timber fascia and sky at the top, and the still water of the "
    "reflecting pond with the pavilion's warm reflection at the bottom. The cream-and-grey cat sits on the "
    "causeway by a rattan chair. Keep every material and colour of this building exactly the same, only the "
    "framing changes. " + COMMON_TAIL
)

P['ep07_inside_vert'] = (
    "Repaint this exact same place as a tall vertical 9:16 portrait composition (1080x1920), but from just "
    "inside the same round glass pavilion, looking out through the folded-back bronze-framed doors across the "
    "shallow reflecting pond. In the soft foreground: the curved stone counter edge and two wooden stools, a "
    "pendant light glowing near the top of the frame. Through the opening: the stone causeway with the rattan "
    "chairs and potted olive trees, the still pond mirroring the sky, and the turquoise sea and clear horizon "
    "beyond, with the cream-and-grey cat sitting on the causeway in the light. Keep every material and colour "
    "of this building exactly the same, only the viewpoint changes. " + COMMON_TAIL
)

# ── EP08 절벽 캔틸레버 파빌리온 ──────────────────────────────────────
P['ep08_close_vert'] = (
    "Repaint this exact same place as a tall vertical 9:16 portrait composition (1080x1920), but move the "
    "camera much closer, straight in front of the open folding glass doors of the same low cafe pavilion on "
    "the cliff edge. The doorway now fills most of the frame, showing the warmly lit interior with the long "
    "stone counter, the row of pale wooden stools and the pendant lights, the warm pale stone walls around the "
    "opening, and the same small sign reading \"plum music\" beside it. A slim slice of the flat roof and sky "
    "at the top; at the bottom, the stone terrace with a rattan chair and the slim glass balustrade, with the "
    "turquoise sea far below beyond it. The cream-and-grey cat sits on the terrace by the doorway. Keep every "
    "material and colour of this building exactly the same, only the framing changes. " + COMMON_TAIL
)

P['ep08_inside_vert'] = (
    "Repaint this exact same place as a tall vertical 9:16 portrait composition (1080x1920), but from just "
    "inside the same cliff-edge cafe pavilion, looking out through the wide-open folding glass doors to the "
    "sea. In the soft foreground: the end of the long stone counter and two pale wooden stools, a pendant "
    "light glowing near the top of the frame. Through the opening: the sunlit stone terrace with rattan "
    "chairs, the slim glass balustrade on the cliff edge, one wind-shaped pine to the side, and the vast "
    "turquoise sea and clear horizon filling the view far below, with the cream-and-grey cat sitting on the "
    "sunlit terrace. Keep every material and colour of this building exactly the same, only the viewpoint "
    "changes. " + COMMON_TAIL
)

for k, v in P.items():
    io.open(os.path.join(HERE, k + '.txt'), 'w', encoding='utf-8').write(v + '\n')
    print('%-18s %4d자' % (k, len(v)))
