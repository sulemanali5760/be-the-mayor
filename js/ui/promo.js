// Shareable promotion card, BitLife-style: drawn on a canvas so it can be saved as a PNG.
export function drawPromo(canvas, d) {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = '#1E2226'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#F5B400'; g.fillRect(0, 0, W, 18); g.fillRect(0, H - 18, W, 18);
  g.textAlign = 'center';
  const text = (s, y, font, color = '#F4F2ED') => { g.font = font; g.fillStyle = color; g.fillText(String(s), W / 2, y, W - 120); };
  text('BE THE MAYOR', 120, '700 40px "Barlow Semi Condensed", sans-serif', '#F5B400');
  text('PROMOTED', 300, '160px "Saira Stencil One", Impact, sans-serif');
  text(d.name, 440, '700 72px "Barlow Semi Condensed", sans-serif');
  text(`${d.from}  →  ${d.to}`, 540, '600 56px "Barlow Semi Condensed", sans-serif', '#F5B400');
  text(`${d.town} · day ${d.day}`, 620, '500 40px Barlow, sans-serif', '#B9B6AE');
  const stats = [['€' + d.money, 'money'], [d.rep + ' ★', 'reputation'], [d.jobs, 'jobs done']];
  stats.forEach(([v, l], i) => {
    const x = W / 2 + (i - 1) * 320;
    g.font = '700 80px "Barlow Semi Condensed", sans-serif'; g.fillStyle = '#F4F2ED'; g.fillText(String(v), x, 800, 300);
    g.font = '500 34px Barlow, sans-serif'; g.fillStyle = '#B9B6AE'; g.fillText(l, x, 850, 300);
  });
  if (d.moment) {
    text('Funniest moment', 990, '700 34px "Barlow Semi Condensed", sans-serif', '#F5B400');
    wrap(g, `“${d.moment}”`, W / 2, 1060, W - 200, 56, '500 44px Barlow, sans-serif');
  }
  text('Next stop: the town council', 1270, '600 40px "Barlow Semi Condensed", sans-serif', '#B9B6AE');
}

function wrap(g, s, x, y, max, lh, font) {
  g.font = font; g.fillStyle = '#F4F2ED';
  let line = '', n = 0;
  for (const w of s.split(' ')) {
    if (g.measureText(line + w).width > max && line) { g.fillText(line.trim(), x, y + lh * n++); line = ''; if (n === 3) return; }
    line += w + ' ';
  }
  g.fillText(line.trim(), x, y + lh * n);
}

export function downloadPng(canvas, name) {
  const a = document.createElement('a');
  a.download = name;
  a.href = canvas.toDataURL('image/png');
  a.click();
}
