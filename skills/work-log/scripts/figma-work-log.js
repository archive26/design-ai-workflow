// work-log 스킬용 use_figma 스크립트
// 아래 INPUT 값만 바꿔서 실행한다. (오토레이아웃 없음, Noto Sans KR, 편집 가능한 텍스트)

const INPUT = {
  pageId: '',                   // 기록할 페이지 id (필수, 사용자에게 받은 링크에서 추출. 예: '159:530')
  date: '11/24',                // 제목 날짜 → "11/24 작업 기록"
  items: [                      // 실제로 한 일 (사용자 문구 그대로)
    '한 일 1',
    '한 일 2',
  ],
  memo: [                       // 하단 메모 1~2줄
    '오늘은 ~까지 진행.',
  ],
};

if (!INPUT.pageId) return { error: 'pageId 없음 → 사용자에게 기록할 피그마 페이지 링크를 받는다' };
const page = await figma.getNodeByIdAsync(INPUT.pageId);
if (!page || page.type !== 'PAGE') return { error: `${INPUT.pageId}는 페이지가 아님 (type: ${page && page.type}) → 이 노드가 속한 페이지 id로 다시 실행` };
await figma.setCurrentPageAsync(page);
const F = 'Noto Sans KR';
for (const s of ['Regular', 'Medium', 'Black']) await figma.loadFontAsync({ family: F, style: s });

const W = 6600, P = 240;
const title = `${INPUT.date} 작업 기록`;

// 같은 제목이 이미 있으면 새로 만들지 않는다 (수정은 기존 프레임을 직접 고친다)
const same = page.children.find(n => n.name === title);
if (same) return { exists: same.id, note: '같은 날짜 기록이 이미 있음 → 기존 프레임 수정 여부를 사용자에게 확인' };

// 위치 계산
const logs = page.children.filter(n => n.type === 'FRAME' && /^\d{1,2}\/\d{1,2} 작업 기록$/.test(n.name));
let X, Y;
if (logs.length) {
  const last = logs.reduce((a, b) => (a.y + a.height > b.y + b.height ? a : b));
  X = last.x; Y = last.y + last.height + 200;
} else {
  const right = page.children.reduce((m, n) => Math.max(m, n.x + n.width), 0);
  X = right + 400; Y = 0;
}

const hex = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const solid = h => [{ type: 'SOLID', color: hex(h) }];

const root = figma.createFrame();
root.name = title; root.fills = solid('#FFFFFF');
page.appendChild(root); root.x = X; root.y = Y; root.resize(W, 1000);

function wrap(str, size, style, maxW) {
  const t = figma.createText(); t.fontName = { family: F, style }; t.fontSize = size; t.textAutoResize = 'WIDTH_AND_HEIGHT';
  const lines = []; let cur = '';
  for (const w of str.split(' ')) {
    const c = cur ? cur + ' ' + w : w; t.characters = c;
    if (t.width > maxW - 8 && cur) { lines.push(cur); cur = w; } else cur = c;
  }
  lines.push(cur); t.remove(); return lines.join(' ');
}
function text(str, o) {
  const t = figma.createText(); t.fontName = { family: F, style: o.style || 'Regular' }; t.fontSize = o.size;
  t.fills = solid(o.color || '#13203A'); t.lineHeight = { unit: 'PERCENT', value: o.lh || 150 };
  root.appendChild(t);
  if (o.w) { t.characters = wrap(str, o.size, o.style || 'Regular', o.w); t.textAutoResize = 'HEIGHT'; t.resize(o.w, t.height); }
  else { t.textAutoResize = 'WIDTH_AND_HEIGHT'; t.characters = str; }
  t.x = o.x; t.y = o.y; t.name = o.name; return t;
}

text(title, { size: 150, style: 'Black', x: P, y: 220, name: '제목', lh: 130 });
let y = 520;
for (const s of INPUT.items) {
  const d = figma.createEllipse(); d.name = '글머리'; d.fills = solid('#13203A');
  root.appendChild(d); d.resize(22, 22); d.x = P + 6; d.y = y + 49;
  const t = text(s, { size: 80, x: P + 80, y, w: W - P * 2 - 80, name: '항목' });
  y += t.height + 44;
}
y += 76;
const line = figma.createRectangle(); line.name = '구분선'; line.fills = solid('#E4E7EC');
root.appendChild(line); line.resize(W - P * 2, 4); line.x = P; line.y = y;
y += 64;
const memo = text(INPUT.memo.join(' '), { size: 64, style: 'Medium', color: '#5B6478', x: P, y, w: W - P * 2, name: '하단 메모' });
root.resize(W, memo.y + memo.height + 220);

// 겹침 확인: 겹치면 만든 프레임을 지우고 알린다
const clash = page.children.filter(n => n !== root &&
  n.x < root.x + root.width && n.x + n.width > root.x &&
  n.y < root.y + root.height && n.y + n.height > root.y).map(n => `${n.id} ${n.name}`);
if (clash.length) { root.remove(); return { clash, tried: [X, Y], note: '겹침 → 사용자에게 위치 확인' }; }

return { frameId: root.id, pos: [root.x, root.y], size: [root.width, root.height], children: root.children.length };
