const open=()=>new Promise(r=>{const w=new WebSocket('ws://127.0.0.1:8080');w._rx=[];w.addEventListener('message',e=>w._rx.push(JSON.parse(e.data)));w.addEventListener('open',()=>r(w));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.error('  ✗',m));};
// 가짜 폰: __snsctl__ 받으면 상태 켜고 __status__로 보고
let sns=false,dm=false;
const phone=await open(); phone.send(JSON.stringify({type:'master'}));
phone.addEventListener('message',e=>{const d=JSON.parse(e.data); if(d.type==='update'&&d.slaveID==='__snsctl__'){const p=d.updates[0].pin; if(p===1)sns=true; if(p===2)dm=true;}});
const viewer=await open(); viewer.send(JSON.stringify({type:'master'})); await wait(200);
// 뷰어 → SNS 활성화
viewer.send(JSON.stringify({type:'simPin',slaveID:'__snsctl__',arduinoID:'ctl',pin:1,state:'on'})); await wait(200);
ok(sns===true,'뷰어 → 폰 SNS 활성화 도달');
viewer.send(JSON.stringify({type:'simPin',slaveID:'__snsctl__',arduinoID:'ctl',pin:2,state:'on'})); await wait(200);
ok(dm===true,'뷰어 → 폰 DM 활성화 도달');
// 폰 → 상태 보고 → 뷰어 수신
const v0=viewer._rx.length;
const bits=(sns?1:0)+(dm?2:0);
phone.send(JSON.stringify({type:'simPin',slaveID:'__status__',arduinoID:'snsdm',pin:bits,state:'on'})); await wait(200);
const got=viewer._rx.slice(v0).find(m=>m.type==='update'&&m.slaveID==='__status__');
ok(got&&got.updates[0].pin===3,'폰 → 뷰어 상태보고(SNS+DM=3) 도달');
console.log(fail===0?('✅ SNS/DM 왕복 검증 통과 ('+pass+'/3)'):'❌ 실패');
process.exit(fail?1:0);
