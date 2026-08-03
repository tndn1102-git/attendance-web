// src/statemachine.js 원문을 문자열로 감싼 src/statemachine-src.js 생성.
// 단일 소스(statemachine.js)를 브라우저에도 그대로 서빙하기 위함. 배포 전 실행.
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const srcPath = join(here, '..', 'src', 'statemachine.js');
const outPath = join(here, '..', 'src', 'statemachine-src.js');

const raw = readFileSync(srcPath, 'utf8');
// 백틱/역슬래시/${} 를 안전하게 이스케이프해 템플릿 리터럴에 담는다.
const esc = raw.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const out = '// AUTO-GENERATED from statemachine.js by scripts/gen-sm.mjs — 직접 수정 금지\n' +
  'export const STATEMACHINE_JS = `' + esc + '`;\n';
writeFileSync(outPath, out);
console.log('generated', outPath, '(' + raw.length + ' bytes source)');
