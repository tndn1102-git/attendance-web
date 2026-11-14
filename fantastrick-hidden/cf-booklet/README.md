# 1호점 설정집 단독 배포 (Cloudflare Workers 정적 자산)

- 원본: `../production/story.html` + `../production/assets/booklet/`
- 갱신: 원본을 고친 뒤 `public/` 로 다시 복사(story.html → public/index.html) 하고 `npx wrangler deploy`
- 나중에 1호점 히든페이지(가비아)와 합칠 예정
