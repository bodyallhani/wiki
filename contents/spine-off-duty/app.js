/* All play, sharing and preferences stay client-side. No third-party SDKs. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = globalThis.BodyallEngine;
  const canvas = $('game'), ctx = canvas.getContext('2d'), arena = $('arena');
  if (!E || !ctx) {
    $('start-label').textContent = '게임을 실행할 수 없어요';
    $('start-note').textContent = '브라우저를 업데이트하고 다시 접속해주세요.';
    return;
  }
  const sprite = document.querySelector('.mascot');
  const INK = '#142f2b', TEAL = '#087668', ORANGE = '#ff6946', PAPER = '#fffdf5', YELLOW = '#ffd465';
  const CANONICAL = 'https://wiki.body-all.co.kr/contents/spine-off-duty/';
  const STORAGE = 'bodyall-off-duty-v1';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fmt = n => Math.floor(n).toLocaleString('ko-KR');
  let saved = {};
  try { const value = JSON.parse(localStorage.getItem(STORAGE) || '{}'); if (value && typeof value === 'object') saved = value; } catch { /* Private mode or full storage: game remains playable. */ }
  let best = Number.isFinite(saved.best) && saved.best >= 0 ? Math.min(999999, Math.floor(saved.best)) : 0;
  let sound = saved.sound === true;
  let reduced = typeof saved.reduced === 'boolean' ? saved.reduced : !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let game = null, result = null, running = false, frameId = 0, previousFrame = 0;
  let mode = 'home', seed = freshSeed(), countdownElapsed = 0, lastCount = 3;
  let keyboard = 0, held = 0, dragging = false, pointerId = null;
  let particles = [], floaters = [], visualTime = 0, shake = 0, bannerUntil = 0, toastUntil = 0;
  let audio = null, soundReady = false, ready = false, modalTrigger = null;
  let pendingResume = false, hudTick = 0;
  const querySeed = new URLSearchParams(location.search).get('challenge');
  if (E.validSeed(querySeed)) { seed = querySeed; $('challenge-note').hidden = false; }
  const titles = ['알림 지옥', '끝나지 않는 회의', '퇴근 전에 이것만'];
  const jokes = { hit: ['커피는 죄가 없는데…', '이건 제 업무가 아닌데요.', '방금 퇴근이 멀어졌어요.'], break: ['드디어 의자와 별거.', '잠깐의 여유, 확실한 보너스.', '몸도 쉬는 틈 챙기는 중.'], near: ['아슬아슬! 칼퇴 각.', '그 업무, 살짝 비켜갑니다.'] };

  function freshSeed() {
    const bytes = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
    else bytes[0] = (Date.now() ^ Math.floor(Math.random() * 1e8)) >>> 0;
    return 'v1-' + bytes[0].toString(36);
  }
  function persist() { try { localStorage.setItem(STORAGE, JSON.stringify({ best, sound, reduced })); } catch { /* Optional storage only. */ } }
  function track(event, extra = {}) {
    // An integration hook, NOT an analytics collector. Never include habit answers.
    window.dispatchEvent(new CustomEvent('bodyall:game-event', { detail: { event, game_version: E.VERSION, ...extra } }));
  }
  function updateSettings() {
    $('sound').textContent = sound ? '♪ 소리 켜짐' : '♪ 소리 꺼짐';
    $('sound').setAttribute('aria-pressed', String(sound));
    $('motion').setAttribute('aria-pressed', String(reduced));
    $('motion').textContent = reduced ? '효과 줄임 ✓' : '효과 줄이기';
    document.documentElement.classList.toggle('reduced-motion', reduced);
    $('best-score').replaceChildren(document.createTextNode(fmt(best)), Object.assign(document.createElement('small'), { textContent: '점' }));
  }
  function unlockAudio() {
    if (!sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audio) audio = new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      soundReady = true;
    } catch { soundReady = false; }
  }
  function beep(kind) {
    if (!sound || !audio || !soundReady || audio.state !== 'running') return;
    const notes = { count: [420], start: [420, 640, 860], break: [660, 880, 1100], near: [780, 940], hit: [170, 110], phase: [320, 420, 560], clear: [520, 650, 780, 1040], end: [340, 250, 170] }[kind] || [550];
    notes.forEach((freq, i) => {
      const o = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + i * .08;
      o.type = kind === 'hit' ? 'triangle' : 'sine'; o.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.075, at + .008); gain.gain.exponentialRampToValueAtTime(.001, at + .14);
      o.connect(gain); gain.connect(audio.destination); o.start(at); o.stop(at + .16);
      o.onended = () => { o.disconnect(); gain.disconnect(); };
    });
  }
  function openModal(dialog) {
    modalTrigger = document.activeElement;
    if (!dialog.open) dialog.showModal();
  }
  function closeAll() { document.querySelectorAll('dialog[open]').forEach(d => d.close()); }
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => {
      if (dialog.id === 'check-dialog') {
        document.querySelectorAll('[name=habit]').forEach(input => { input.checked = false; }); updateAdvice();
      }
      if (pendingResume && !document.querySelector('dialog[open]')) { pendingResume = false; /* Remain paused until explicit resume. */ }
      if (dialog.id === 'result-dialog' && mode === 'result' && !document.querySelector('dialog[open]')) home();
      else if (modalTrigger?.isConnected) modalTrigger.focus({ preventScroll: true });
    });
  });
  $('how-button').addEventListener('click', () => openModal($('how-dialog')));
  $('info-button').addEventListener('click', () => { if (mode === 'playing' || mode === 'countdown') { pauseGame(); pendingResume = true; } openModal($('info-dialog')); });
  $('check-button').addEventListener('click', () => { openModal($('check-dialog')); track('body_check_open'); });
  $('sound').addEventListener('click', () => { sound = !sound; unlockAudio(); updateSettings(); persist(); if (sound) beep('near'); });
  $('motion').addEventListener('click', () => { reduced = !reduced; particles = []; shake = 0; updateSettings(); persist(); });
  $('start').addEventListener('click', () => startRound(seed));
  $('retry').addEventListener('click', () => startRound(seed));
  $('new-game').addEventListener('click', () => { seed = freshSeed(); $('challenge-note').hidden = true; startRound(seed); });
  $('pause').addEventListener('click', pauseGame);
  $('resume').addEventListener('click', resumeGame);
  $('quit').addEventListener('click', home);

  function startRound(challenge) {
    if (!ready || !E.validSeed(challenge)) return false;
    mode = 'countdown'; closeAll(); unlockAudio(); game = new E.Game(challenge); result = null;
    keyboard = held = 0; pressed.clear(); dragging = false; pointerId = null; particles = []; floaters = []; shake = 0;
    countdownElapsed = 0; lastCount = 3; visualTime = 0; bannerUntil = 0; toastUntil = 0;
    arena.dataset.view = 'play'; $('start-screen').hidden = true; $('pause-screen').hidden = true;
    $('countdown-screen').hidden = false; $('countdown').textContent = '3'; $('game-toast').classList.remove('visible'); $('stage-banner').hidden = true;
    $('pause').disabled = false; $('left').disabled = $('right').disabled = true;
    $('pause').focus({ preventScroll: true }); updateHUD(); resize(); ensureFrame(); beep('count');
    track('game_start'); return true;
  }
  function home() {
    mode = 'home'; if (game?.state === 'playing') game.pause();
    keyboard = held = 0; pressed.clear(); dragging = false; pointerId = null; particles = []; floaters = [];
    $('start-screen').hidden = false; $('countdown-screen').hidden = $('pause-screen').hidden = true;
    $('stage-banner').hidden = true; $('game-toast').classList.remove('visible');
    $('pause').disabled = $('left').disabled = $('right').disabled = true;
    arena.dataset.view = 'home'; game = null; updateHUD(); resize(); stopFrame();
    $('start').focus({ preventScroll: true });
  }
  function pauseGame() {
    if (mode !== 'playing' && mode !== 'countdown') return false;
    mode = mode === 'countdown' ? 'countdown-paused' : 'paused'; game?.pause();
    $('pause-screen').hidden = false; $('countdown-screen').hidden = true;
    $('left').disabled = $('right').disabled = true; keyboard = held = 0; pressed.clear(); dragging = false;
    stopFrame(); $('resume').focus({ preventScroll: true }); return true;
  }
  function resumeGame() {
    if (!['paused', 'countdown-paused'].includes(mode)) return false;
    const countdown = mode === 'countdown-paused'; mode = countdown ? 'countdown' : 'playing';
    game?.resume(); unlockAudio(); $('pause-screen').hidden = true; $('countdown-screen').hidden = !countdown;
    $('left').disabled = $('right').disabled = countdown; $('pause').focus({ preventScroll: true }); ensureFrame(); return true;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  window.addEventListener('blur', () => { keyboard = held = 0; dragging = false; pauseGame(); });

  const keyLeft = new Set(['ArrowLeft', 'a', 'A']), keyRight = new Set(['ArrowRight', 'd', 'D']);
  const pressed = new Set();
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (['playing', 'countdown', 'paused', 'countdown-paused'].includes(mode) && ['Escape', 'p', 'P'].includes(e.key)) {
      e.preventDefault(); if (e.repeat) return; mode.includes('paused') ? resumeGame() : pauseGame(); return;
    }
    if (mode !== 'playing') return;
    if (keyLeft.has(e.key) || keyRight.has(e.key)) { e.preventDefault(); pressed.add(e.key); updateKeys(); }
  });
  document.addEventListener('keyup', e => { pressed.delete(e.key); updateKeys(); });
  function updateKeys() { keyboard = (Array.from(pressed).some(k => keyRight.has(k)) ? 1 : 0) - (Array.from(pressed).some(k => keyLeft.has(k)) ? 1 : 0); }
  window.addEventListener('blur', () => pressed.clear());
  function targetFromPointer(e) { const r = canvas.getBoundingClientRect(); game?.setTarget((e.clientX - r.left) / r.width * E.W); }
  canvas.addEventListener('pointerdown', e => { if (mode !== 'playing') return; e.preventDefault(); dragging = true; pointerId = e.pointerId; canvas.setPointerCapture(e.pointerId); targetFromPointer(e); });
  canvas.addEventListener('pointermove', e => { if (dragging && e.pointerId === pointerId && mode === 'playing') { e.preventDefault(); targetFromPointer(e); } });
  const releasePointer = e => { if (e.pointerId === pointerId) { dragging = false; pointerId = null; } };
  canvas.addEventListener('pointerup', releasePointer); canvas.addEventListener('pointercancel', releasePointer); canvas.addEventListener('lostpointercapture', releasePointer);
  [['left', -1], ['right', 1]].forEach(([id, direction]) => {
    const button = $(id);
    button.addEventListener('pointerdown', e => { if (mode !== 'playing') return; e.preventDefault(); held = direction; button.setPointerCapture(e.pointerId); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(ev, () => { held = 0; });
    button.addEventListener('keydown', e => { if (mode === 'playing' && [' ', 'Enter'].includes(e.key)) { e.preventDefault(); held = direction; } });
    button.addEventListener('keyup', () => { held = 0; }); button.addEventListener('blur', () => { held = 0; });
  });

  function ensureFrame() { if (!running) { running = true; previousFrame = performance.now(); frameId = requestAnimationFrame(frame); } }
  function stopFrame() { running = false; cancelAnimationFrame(frameId); }
  function frame(now) {
    if (!running) return;
    const delta = clamp((now - previousFrame) / 1000, 0, .1); previousFrame = now; visualTime += delta;
    if (mode === 'countdown') {
      countdownElapsed += delta; const value = Math.max(1, Math.ceil(3 - countdownElapsed));
      if (value !== lastCount) { lastCount = value; $('countdown').textContent = String(value); beep('count'); }
      if (countdownElapsed >= 3) { mode = 'playing'; $('countdown-screen').hidden = true; $('left').disabled = $('right').disabled = false; showPhase(0); toast('좌우로 움직이세요 · 주황색 피하기 / 초록색 받기', 4); beep('start'); }
    }
    if (mode === 'playing') {
      const direction = held || keyboard;
      if (direction) game.setTarget(game.target + direction * 340 * delta);
      for (const event of game.advance(delta)) handleEvent(event);
      hudTick += delta; if (hudTick > .06 || mode === 'result') { updateHUD(); hudTick = 0; }
    }
    particles.forEach(p => { p.life -= delta; p.x += p.vx * delta; p.y += p.vy * delta; p.vy += 230 * delta; }); particles = particles.filter(p => p.life > 0);
    floaters.forEach(p => { p.life -= delta; p.y -= 28 * delta; }); floaters = floaters.filter(p => p.life > 0);
    shake = Math.max(0, shake - delta * 22);
    if (bannerUntil < visualTime) $('stage-banner').hidden = true;
    if (toastUntil < visualTime) $('game-toast').classList.remove('visible');
    draw();
    if (mode === 'playing' || mode === 'countdown') frameId = requestAnimationFrame(frame); else running = false;
  }
  function updateHUD() {
    const left = game ? Math.ceil(60 - game.time) : 60;
    $('time').replaceChildren(document.createTextNode(String(left)), Object.assign(document.createElement('small'), { textContent: '초' }));
    $('score').textContent = String(game?.score || 0).padStart(4, '0');
    const cups = game ? game.cups : 3; $('cups').textContent = '● '.repeat(Math.max(0, cups)) + '○ '.repeat(Math.max(0, 3 - cups)); $('cups').setAttribute('aria-label', `커피 ${cups}잔 남음`);
    const fatigue = Math.round(game?.fatigue ?? 12); $('fatigue-fill').style.width = fatigue + '%'; $('fatigue-fill').style.background = fatigue > 75 ? ORANGE : TEAL;
    $('fatigue-value').textContent = fatigue + '%'; $('fatigue-meter').setAttribute('aria-valuenow', String(fatigue));
  }
  function showPhase(phase) { $('stage-caption').textContent = `ROUND 0${phase + 1}${phase === 2 ? ' · FINAL BOSS' : ''}`; $('stage-title').textContent = titles[phase]; $('stage-banner').hidden = false; bannerUntil = visualTime + 2.5; }
  function toast(message, seconds = 1.8) { $('game-toast').textContent = message; $('game-toast').classList.add('visible'); toastUntil = visualTime + seconds; }
  function burst(x, y, color, count) {
    if (reduced) return;
    for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - .5) * 220, vy: -70 - Math.random() * 140, life: .5 + Math.random() * .5, color, size: 3 + Math.random() * 4 });
  }
  function handleEvent(event) {
    if (event.type === 'phase') { showPhase(event.phase); beep('phase'); return; }
    if (event.type === 'end') { finishRound(); return; }
    const joke = jokes[event.type];
    if (event.type === 'hit') { shake = reduced ? 0 : 7; burst(event.x, event.y, ORANGE, 14); toast(joke[(game.hits - 1) % joke.length]); beep('hit'); }
    if (event.type === 'break') { burst(event.x, event.y, TEAL, 18); floaters.push({ x: event.x, y: event.y - 45, life: 1.1, label: `+${event.points} · 피로 −25`, color: TEAL }); toast(joke[(game.breaks - 1) % joke.length]); beep('break'); }
    if (event.type === 'near') { floaters.push({ x: event.x, y: event.y - 75, life: 1, label: '아슬아슬 +75', color: '#9e350c' }); toast(joke[(game.nearMisses - 1) % joke.length]); beep('near'); }
  }

  function rounded(g, x, y, w, h, r = 7) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function card(x, y, w, h, fill, stroke = INK) { rounded(ctx, x, y, w, h); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.7; ctx.stroke(); }
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(E.W * ratio); canvas.height = Math.round(E.H * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw();
  }
  function draw() {
    if (!ctx) return;
    const W = E.W, H = E.H, phase = game?.phase || 0;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = phase === 2 ? '#f3e8c9' : '#e5eee2'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake && !reduced) ctx.translate(Math.sin(visualTime * 51) * shake, Math.cos(visualTime * 43) * shake * .5);
    // Abstract play lanes, not an anatomical or physical office simulation.
    ctx.lineWidth = 1; ctx.strokeStyle = '#91ab9855'; ctx.setLineDash([3, 9]);
    for (const x of [64, 152, 240, 328, 416]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 66); ctx.stroke(); }
    ctx.setLineDash([]); ctx.fillStyle = '#cbdfd0'; ctx.fillRect(0, H - 75, W, 75);
    ctx.strokeStyle = '#789b87'; ctx.beginPath(); ctx.moveTo(0, H - 75); ctx.lineTo(W, H - 75); ctx.stroke();
    ctx.fillStyle = '#6c8874'; ctx.font = '600 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('←   좌우로 드래그해서 의자를 움직이세요   →', W / 2, H - 40);
    if (game) {
      ctx.fillStyle = '#739783'; ctx.font = '800 65px sans-serif'; ctx.globalAlpha = .09;
      ctx.fillText(String(Math.ceil(60 - game.time)).padStart(2, '0'), W / 2, 198); ctx.globalAlpha = 1;
      for (const item of game.items) {
        if (item.at > game.time) {
          const isBreak = item.kind === 'break'; const alpha = reduced ? .8 : .55 + Math.sin(visualTime * 6) * .18;
          ctx.globalAlpha = alpha; ctx.fillStyle = isBreak ? TEAL : '#b63b20'; ctx.font = '800 17px sans-serif'; ctx.fillText(isBreak ? '+' : '!', item.x, 25); ctx.globalAlpha = 1; continue;
        }
        const good = item.kind === 'break'; const w = good ? 79 : 85;
        ctx.save(); ctx.translate(item.x, item.y);
        if (!reduced) ctx.rotate(Math.sin(item.id + visualTime * 2) * .025);
        card(-w / 2 + 2, -19, w, 42, '#142f2b22', '#142f2b00');
        card(-w / 2, -22, w, 42, good ? TEAL : ORANGE);
        ctx.fillStyle = good ? PAPER : INK; ctx.font = '800 12px sans-serif'; ctx.fillText(item.label, 0, -2);
        ctx.font = '600 9px sans-serif'; ctx.fillText(good ? '피로 −25' : '업무 도착!', 0, 12);
        ctx.restore();
      }
    }
    const x = game?.x ?? W / 2, y = E.PLAYER_Y;
    ctx.fillStyle = '#142f2b16'; ctx.beginPath(); ctx.ellipse(x, y + 55, 48, 9, 0, 0, Math.PI * 2); ctx.fill();
    if (game?.invincible > 0) { ctx.strokeStyle = ORANGE; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.ellipse(x, y + 52, 52, 13, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    ctx.save(); ctx.translate(x, y + 43); ctx.rotate(reduced ? 0 : game?.tilt || 0);
    if (sprite.complete && sprite.naturalWidth) ctx.drawImage(sprite, -79, -139, 158, 158);
    ctx.restore();
    // Explicit marker makes the collision lane easy to understand.
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(x - 5, y + 72); ctx.lineTo(x + 5, y + 72); ctx.lineTo(x, y + 65); ctx.fill();
    for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalAlpha = 1;
    for (const p of floaters) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.font = '800 15px sans-serif'; ctx.strokeStyle = PAPER; ctx.lineWidth = 4; ctx.strokeText(p.label, clamp(p.x, 95, W - 95), p.y); ctx.fillStyle = p.color; ctx.fillText(p.label, clamp(p.x, 95, W - 95), p.y); }
    ctx.globalAlpha = 1; ctx.restore();
  }
  window.addEventListener('resize', resize, { passive: true });

  function resultProfile(s) {
    if (s.reason === 'clear') return { title: s.cups === 3 ? '정시퇴근 수호자' : '우여곡절 칼퇴러', copy: s.cups === 3 ? '커피도, 퇴근도 지켜냈습니다. 결재 완료!' : '조금 쏟았지만 괜찮아요. 오늘 업무는 여기까지.', stamp: '퇴근 승인' };
    if (s.reason === 'overload') return { title: '회의실 붙박이', copy: '쉬는 틈도 업무의 일부예요. 다음 판엔 챙겨볼까요?', stamp: '휴식 안건 상정' };
    if (s.seconds >= 40) return { title: '퇴근 5분 전 희생자', copy: '거의 다 왔는데… “이것만”의 벽은 높았습니다.', stamp: '퇴근 결재 반려' };
    if (s.seconds >= 15) return { title: '알림에 영혼 털린 자', copy: '읽지 않은 업무보다, 식어버린 커피가 더 아프다.', stamp: '커피 수습 중' };
    return { title: '아직 출근 적응 중', copy: '커피는 쏟아도 괜찮아요. 다음 판엔 알림을 피해보세요!', stamp: '재도전 환영' };
  }
  function finishRound() {
    mode = 'result'; keyboard = held = 0; dragging = false;
    result = game.snapshot(); const profile = resultProfile(result), isBest = result.score > best;
    if (isBest) { best = result.score; persist(); updateSettings(); }
    $('result-title').textContent = profile.title; $('result-copy').textContent = profile.copy; $('result-stamp').textContent = profile.stamp;
    $('result-score').textContent = fmt(result.score); $('result-time').textContent = result.seconds + '초'; $('result-breaks').textContent = result.breaks + '번'; $('result-near').textContent = result.nearMisses + '번';
    $('new-record').hidden = !isBest; $('share-status').textContent = ''; $('share-fallback').hidden = true;
    $('pause').disabled = $('left').disabled = $('right').disabled = true; $('stage-banner').hidden = true;
    beep(result.reason === 'clear' ? 'clear' : 'end'); updateHUD(); openModal($('result-dialog')); $('result-dialog').scrollTop = 0;
    track('game_complete', { score: result.score, seconds: result.seconds, outcome: result.reason });
  }
  function challengeUrl() {
    const url = new URL(CANONICAL);
    url.searchParams.set('challenge', result?.seed || seed); return url.toString();
  }
  $('share').addEventListener('click', async () => {
    if (!result) return;
    const profile = resultProfile(result), url = challengeUrl();
    const text = `나의 퇴근력 ${fmt(result.score)}점! 「${profile.title}」\n척추야, 퇴근하자! 같은 패턴으로 도전해볼래요?\n바디올한의원의 60초 게임 · 건강 진단 아님`;
    if (navigator.share) {
      try { await navigator.share({ title: '척추야, 퇴근하자! | 바디올', text, url }); $('share-status').textContent = '도전장을 공유했어요.'; track('challenge_share', { method: 'native' }); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(`${text}\n${url}`); $('share-status').textContent = '기록과 도전 링크를 복사했어요. 친구에게 붙여넣으세요.'; track('challenge_share', { method: 'clipboard' });
    } catch { $('share-fallback').hidden = false; $('share-url').value = url; $('share-url').focus(); $('share-url').select(); $('share-status').textContent = '도전 링크를 직접 복사해주세요.'; }
  });
  $('save-card').addEventListener('click', async () => {
    if (!result) return;
    const button = $('save-card'); button.disabled = true;
    try {
      const c = document.createElement('canvas'); c.width = 720; c.height = 960;
      const g = c.getContext('2d'), p = resultProfile(result);
      g.fillStyle = INK; g.fillRect(0, 0, 720, 960); rounded(g, 26, 26, 668, 908, 20); g.fillStyle = PAPER; g.fill();
      g.fillStyle = TEAL; g.fillRect(27, 27, 666, 104); g.fillStyle = PAPER; g.font = '800 25px sans-serif'; g.textAlign = 'left'; g.fillText('bodyall®  바디올한의원', 62, 89);
      g.textAlign = 'center'; g.fillStyle = INK; g.font = '900 46px sans-serif'; g.fillText('척추야, 퇴근하자!', 360, 200);
      g.font = '700 27px sans-serif'; g.fillText(p.title, 360, 250);
      if (sprite.complete && sprite.naturalWidth) g.drawImage(sprite, 232, 273, 256, 256);
      g.fillStyle = TEAL; g.font = '900 92px sans-serif'; g.fillText(fmt(result.score), 360, 616);
      g.fillStyle = INK; g.font = '700 19px sans-serif'; g.fillText('퇴근력 POINTS', 360, 650);
      g.font = '600 22px sans-serif'; g.fillText(`${result.seconds}초 생존   ·   쉬는 틈 ${result.breaks}번`, 360, 707);
      g.strokeStyle = '#92a899'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(65, 748); g.lineTo(655, 748); g.stroke(); g.setLineDash([]);
      g.font = '600 20px sans-serif'; g.fillText('게임은 가볍게. 내 몸은 한 번 더 돌아보기.', 360, 798);
      g.font = '400 16px sans-serif'; g.fillText('게임 기록이며 실제 건강 상태·척추 정렬을 뜻하지 않습니다.', 360, 834);
      g.font = '600 16px sans-serif'; g.fillText('wiki.body-all.co.kr/contents/spine-off-duty/', 360, 882);
      const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not export card');
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `bodyall-off-duty-${result.score}.png`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      $('share-status').textContent = '기록 카드 저장을 요청했어요. 새 화면에 열리면 이미지를 길게 눌러 저장하세요.'; track('result_card_export');
    } catch { $('share-status').textContent = '카드 저장을 지원하지 않는 환경입니다. 도전 링크 공유를 이용해주세요.'; }
    finally { button.disabled = false; }
  });

  function updateAdvice() {
    const selected = new Set(Array.from(document.querySelectorAll('[name=habit]:checked'), i => i.value));
    if (selected.has('symptom')) $('check-advice').textContent = '불편함이 반복되거나 일상을 방해한다면, 자세 탓으로만 넘기지 말고 원인을 평가받아보세요. 증상·움직임·진찰 결과에 따라 필요한 관리나 치료가 달라집니다.';
    else if (selected.has('screen') || selected.has('still')) $('check-advice').textContent = '화면을 편하게 볼 수 있도록 환경을 조정하고, 일하는 중간에 자세를 바꾸거나 움직일 기회를 챙겨보세요. 지금 선택만으로 척추가 틀어졌거나 치료가 필요하다고 판단하지는 않습니다.';
    else $('check-advice').textContent = '자세의 겉모습만으로 척추 상태를 단정할 수는 없어요. 몸의 느낌과 일상 속 움직임도 함께 돌아보세요.';
  }
  document.querySelectorAll('[name=habit]').forEach(input => input.addEventListener('change', updateAdvice));
  document.querySelectorAll('[data-track]').forEach(a => a.addEventListener('click', () => track('clinic_link_click', { destination: a.dataset.track })));

  // Progressive enhancement. Unsupported browsers simply use the visible UI.
  const modelContext = document.modelContext;
  if (modelContext?.registerTool) {
    const lifetime = new AbortController();
    const register = tool => { try { Promise.resolve(modelContext.registerTool(tool, { signal: lifetime.signal })).catch(() => {}); } catch { /* Experimental API. */ } };
    register({ name: 'read_off_duty_game', description: 'Read this game state and device-local best score. Does not diagnose health or expose lifestyle answers.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute(input) { if (!input || typeof input !== 'object' || Object.keys(input).length) throw new Error('Expected an empty object'); return { mode, best, game: game?.snapshot() || null }; } });
    register({ name: 'start_off_duty_round', description: 'Start a 60-second game from the home or result screen, using the currently selected challenge pattern. Does not replace an active round.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false }, execute(input) { if (!input || typeof input !== 'object' || Object.keys(input).length) throw new Error('Expected an empty object'); if (!['home', 'result'].includes(mode)) throw new Error('A round is already active'); if (!startRound(seed)) throw new Error('Game assets are not ready'); return { mode, seed }; } });
    window.addEventListener('pagehide', () => lifetime.abort(), { once: true });
  }
  function onReady() { if (ready) return; if (!ctx || !sprite.naturalWidth) return; ready = true; $('start').disabled = false; $('start-label').textContent = '정시 퇴근 도전!'; resize(); }
  sprite.addEventListener('load', onReady);
  function assetError() { $('start-label').textContent = '그림을 불러오지 못했어요'; $('start-note').textContent = '연결을 확인하고 새로고침해주세요.'; }
  sprite.addEventListener('error', assetError);
  arena.dataset.view = 'home'; updateSettings(); resize();
  if (sprite.complete && sprite.naturalWidth) onReady();
  else if (sprite.complete) assetError();
})();
