/* User-Agent 파서 (의존성 없음) — hidden-stats lib/ua.js 계승
   목적: 손님이 어떤 기기·OS·브라우저로 들어왔는지, 특히 QR을 카카오톡·네이버앱 같은
   "인앱 브라우저"로 열었는지 식별한다. 인앱 브라우저는 센서 권한·WebGL·전체화면 동작이
   정식 브라우저와 달라 "화면이 잘린다·멈춘다"의 흔한 원인이다.
   ※ UA 문자열은 개인을 식별하지 않는 기기 환경 정보다. 원문은 세션 1행에만 300자 이내로 저장. */

var INAPP = [
  [/NAVER\(inapp/i, "네이버앱"],
  [/\bNAVER\b/i, "네이버앱"],
  [/KAKAOTALK/i, "카카오톡"],
  [/kakaostory/i, "카카오스토리"],
  [/DaumApps|\bDaum\b/i, "다음앱"],
  [/Instagram/i, "인스타그램"],
  [/FBAN|FBAV|FB_IAB|FBIOS|FBDV/i, "페이스북"],
  [/Line\//i, "라인"],
  [/Snapchat/i, "스냅챗"],
  [/musical_ly|Bytedance|TikTok|trill/i, "틱톡"],
  [/BAND\//i, "밴드"],
  [/Twitter|TwitterAndroid/i, "트위터/X"],
  [/Threads/i, "스레드"],
  [/WeChat|MicroMessenger/i, "위챗"],
  [/;wv\)/i, "안드로이드 웹뷰"],
];

function detectBrowser(ua) {
  var m;
  if ((m = ua.match(/EdgA?\/([\d.]+)/))) return ["Edge", m[1]];
  if ((m = ua.match(/SamsungBrowser\/([\d.]+)/))) return ["삼성인터넷", m[1]];
  if ((m = ua.match(/Whale\/([\d.]+)/))) return ["네이버 웨일", m[1]];
  if ((m = ua.match(/OPR\/([\d.]+)/)) || (m = ua.match(/Opera.*Version\/([\d.]+)/))) return ["Opera", m[1]];
  if ((m = ua.match(/CriOS\/([\d.]+)/))) return ["Chrome(iOS)", m[1]];
  if ((m = ua.match(/FxiOS\/([\d.]+)/))) return ["Firefox(iOS)", m[1]];
  if ((m = ua.match(/Firefox\/([\d.]+)/))) return ["Firefox", m[1]];
  if ((m = ua.match(/Chrome\/([\d.]+)/))) return ["Chrome", m[1]];
  if (/Safari/.test(ua) && (m = ua.match(/Version\/([\d.]+)/))) return ["Safari", m[1]];
  if (/Safari/.test(ua)) return ["Safari", ""];
  return ["기타", ""];
}

function detectOS(ua) {
  var m;
  if ((m = ua.match(/(?:iPhone|iPad|iPod).*?OS (\d+[_.]\d+(?:[_.]\d+)?)/))) return ["iOS", m[1].replace(/_/g, ".")];
  if (/iPhone|iPad|iPod/.test(ua)) return ["iOS", ""];
  if (/Macintosh/.test(ua) && /Mobile/.test(ua)) return ["iPadOS", ""];
  if ((m = ua.match(/Android (\d+(?:\.\d+)?)/))) return ["Android", m[1]];
  if (/Android/.test(ua)) return ["Android", ""];
  if ((m = ua.match(/Windows NT ([\d.]+)/))) return ["Windows", m[1]];
  if ((m = ua.match(/Mac OS X (\d+[_.]\d+(?:[_.]\d+)?)/))) return ["macOS", m[1].replace(/_/g, ".")];
  return ["기타", ""];
}

function detectDevice(ua) {
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPod/.test(ua)) return "iPod";
  // "Android 13; SM-S911N Build" → SM-S911N
  var m = ua.match(/Android [\d.]+;\s*(?:[a-z]{2}-[a-z]{2};\s*)?([^;)]+?)(?:\s+Build|\))/i);
  if (m) {
    var d = m[1].trim().slice(0, 40);
    if (/^K$/.test(d)) return "Android(모델 비공개)"; // Chrome 110+ UA 축약
    return d;
  }
  if (/Windows/.test(ua)) return "PC(Windows)";
  if (/Macintosh/.test(ua)) return "Mac";
  return "";
}

function detectInApp(ua) {
  for (var i = 0; i < INAPP.length; i++) if (INAPP[i][0].test(ua)) return INAPP[i][1];
  return null;
}

export function parseUA(ua) {
  ua = String(ua || "");
  var os = detectOS(ua);
  var inapp = detectInApp(ua);
  var browser = inapp ? [inapp, ""] : detectBrowser(ua);
  return {
    os: os[0],
    os_ver: os[1] || null,
    browser: browser[0],
    browser_ver: browser[1] || null,
    device: detectDevice(ua) || null,
    inapp: inapp,
    is_mobile: /Mobi|Android|iPhone|iPad|iPod|Tablet/i.test(ua),
  };
}
