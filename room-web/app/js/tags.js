// 札（その地点で見える物の名前）と説明カード。札は DOM で、3D の点を画面へ写して置く。
import * as THREE from 'three';
import {linkUrl} from './data.js';

const $ = (id) => document.getElementById(id);

function makeTagEl(tag, onOpen) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'tag';
  el.setAttribute('aria-pressed', 'false');
  const b = document.createElement('b'); b.textContent = tag.title ?? tag.id;
  el.append(b);
  if (tag.line) { const s = document.createElement('span'); s.textContent = tag.line; el.append(s); }
  el.append(document.createElement('i'));
  el.addEventListener('click', (e) => { e.stopPropagation(); onOpen(tag.id); });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.style.display = 'none';
  $('tags').append(el);
  return el;
}

export function createTags(data, camera) {
  let openId = null;
  const card = $('card');
  const open = (id) => {
    const t = data.tags.find((x) => x.id === id);
    if (!t) return;
    openId = id;
    $('card-title').textContent = t.title ?? t.id;
    $('card-line').textContent = t.line ?? '';
    $('card-text').textContent = t.card ?? '';
    const a = $('card-link');
    a.hidden = !t.link;
    if (t.link) a.href = linkUrl(t.link);
    $('card-land').hidden = !(t.link && document.body.classList.contains('phone'));
    card.hidden = false;
    document.body.classList.add('carded');
    items.forEach((it) => it.el.setAttribute('aria-pressed', String(it.tag.id === id)));
  };
  const close = () => {
    openId = null; card.hidden = true;
    document.body.classList.remove('carded');
    items.forEach((it) => it.el.setAttribute('aria-pressed', 'false'));
  };
  card.querySelector('.close').addEventListener('click', close);
  card.addEventListener('pointerdown', (e) => e.stopPropagation());
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  const items = data.tags.map((tag) => ({tag, el: makeTagEl(tag, open)}));
  const v = new THREE.Vector3();
  const camDir = new THREE.Vector3();

  // station: 札を出す地点の id（null なら全部隠す）
  const update = (station, hidden = false) => {
    camera.getWorldDirection(camDir);
    const W = innerWidth, H = innerHeight, placed = [];
    const vis = items.filter((it) => !hidden && station && it.tag.stations.includes(station));
    items.forEach((it) => { if (!vis.includes(it)) it.el.style.display = 'none'; });
    const shown = [];
    for (const it of vis) {
      v.copy(it.tag.v).sub(camera.position);
      if (v.dot(camDir) < 0.2) { it.el.style.display = 'none'; continue; }
      v.copy(it.tag.v).project(camera);
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
      if (x < 8 || x > W - 8 || y < 40 || y > H - 40) { it.el.style.display = 'none'; continue; }
      it.el.style.display = '';
      shown.push({it, x, y});
    }
    // 画面の板（説明・ボタン・カード）の下に潜る札は出さない
    const ui = ['info', 'tools', 'chapters', 'hint', 'note', 'card', 'tourbar']
      .map((id) => document.getElementById(id))
      .filter((e) => e && !e.hidden && e.getClientRects().length > 0)   // 固定配置は offsetParent が null になるため
      .map((e) => e.getBoundingClientRect());
    // 重なったら上へずらす（下の札から順に）
    shown.sort((a, b) => b.y - a.y);
    for (const s of shown) {
      const w = s.it.el.offsetWidth, h = s.it.el.offsetHeight;
      let lift = 0;
      const box = () => ({l: s.x - w / 2, r: s.x + w / 2, t: s.y - 17 - h - lift, b: s.y - 17 - lift});
      for (let k = 0; k < 6; k++) {
        const bx = box();
        const hit = placed.find((p) => bx.l < p.r && bx.r > p.l && bx.t < p.b && bx.b > p.t);
        if (!hit) break;
        lift += bx.b - hit.t + 4;
      }
      const bx = box();
      if (ui.some((r) => bx.l < r.right && bx.r > r.left && bx.t < r.bottom && bx.b + 22 > r.top)) {
        s.it.el.style.display = 'none'; continue;
      }
      // 画面の左右からはみ出さない
      const dx = Math.max(8 - bx.l, 0) - Math.max(bx.r - (W - 8), 0);
      placed.push({l: bx.l + dx, r: bx.r + dx, t: bx.t, b: bx.b});
      s.it.el.style.left = `${s.x + dx}px`;
      s.it.el.style.top = `${s.y}px`;
      s.it.el.style.setProperty('--lift', `${lift}px`);
      s.it.el.style.setProperty('--dx', `${-dx}px`);
    }
  };
  return {open, close, update, get openId() { return openId; }};
}
