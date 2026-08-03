// v140 이 참조하는 이미지가 실제로 있는지 + v139 와 단계별 이미지가 같은지 대조
import fs from 'node:fs';

const OLD = fs.readFileSync('D:/test3/hint-viewer/phone-patch/deploy-bgfix/app.js', 'utf8');
const NEW = fs.readFileSync('D:/test3/hint-viewer/phone-patch/app.v140.js', 'utf8');
const have = new Set(fs.readdirSync('D:/test3/hint-phone/assets/phone-img'));

const names = s => (s.match(/(mission|details|location|inprogress)[0-9][\w.-]*\.png/g) || []);

// 1) 없는 파일 참조
const missing = [...new Set(names(NEW))].filter(n => !have.has(n));
console.log('없는 이미지 참조:', missing.length ? missing : '없음');

// 2) v139 에 쓰이던 이미지가 v140 에서 빠졌는지 (단계 누락 탐지)
const oldSet = new Set(names(OLD)), newSet = new Set(names(NEW));
const dropped = [...oldSet].filter(n => !newSet.has(n)).sort();
const added   = [...newSet].filter(n => !oldSet.has(n)).sort();
console.log('v139 에만 있던 이미지 :', dropped.length ? dropped : '없음');
console.log('v140 에서 새로 생긴 것 :', added.length ? added : '없음');
process.exit(missing.length || dropped.length || added.length ? 1 : 0);
