/* ═══════════════════════════════════════════════════════════════
   ALU OPERATION DEMO — ENHANCED  ·  script.js
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Helpers ────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function toBin8(n) {
  return ((n & 0xFF) >>> 0).toString(2).padStart(8, '0');
}

function toHex(n) {
  return '0x' + ((n & 0xFF) >>> 0).toString(16).toUpperCase().padStart(2, '0');
}

function clamp8(n) { return n & 0xFF; }

function parseHex(str) {
  var v = parseInt(str, 16);
  return isNaN(v) ? 0 : clamp8(v);
}

// ── State ──────────────────────────────────────────────────────
var state = {
  step: 0,       // 0 = idle, 1–5 = pipeline stages
  op: 'ADD',
  valA: 0xA5,
  valB: 0x3C,
  result: null,
  flags: { Z: 0, C: 0, N: 0, V: 0 },
  autoTimer: null
};

var OP_SYMBOLS = {
  ADD: '+', SUB: '−', AND: '&', OR: '|', XOR: '⊕', NOT: '~', SHL: '«', SHR: '»'
};

var STEPS = [
  {
    title: 'READY — CONFIGURE INPUTS',
    desc: 'Set the hexadecimal values for Register A and Register B, choose an ALU operation, then press NEXT to start executing the pipeline.',
    pipeline: -1
  },
  {
    title: 'STEP 1 — INSTRUCTION FETCH (IF)',
    desc: 'The Program Counter points to the instruction. The Control Unit fetches the instruction from memory into the Instruction Register (IR) and increments PC.',
    pipeline: 0
  },
  {
    title: 'STEP 2 — INSTRUCTION DECODE / REGISTER FETCH (ID)',
    desc: 'The Control Unit decodes the opcode and reads the source operands from Register A and Register B into the ALU input latches.',
    pipeline: 1
  },
  {
    title: 'STEP 3 — EXECUTE (EX)',
    desc: 'The ALU receives both operands and performs the requested arithmetic/logic operation. The computation result and status flags are calculated.',
    pipeline: 2
  },
  {
    title: 'STEP 4 — MEMORY / WRITE-BACK (WB)',
    desc: 'The computed result is written back to the Result Register. For memory operations, this stage would access data memory.',
    pipeline: 3
  },
  {
    title: 'STEP 5 — STATUS FLAGS UPDATE',
    desc: 'The status flag register is updated with Zero (Z), Carry (C), Negative (N), and Overflow (V) flags based on the operation result.',
    pipeline: 4
  }
];

// ── Compute ────────────────────────────────────────────────────
function compute(op, a, b) {
  var result, carry = 0, overflow = 0;
  switch (op) {
    case 'ADD':
      result = a + b;
      carry = result > 0xFF ? 1 : 0;
      // Two's complement overflow: both positive, result negative (or vice versa)
      overflow = ((~(a ^ b) & (a ^ result)) & 0x80) ? 1 : 0;
      result = clamp8(result);
      break;
    case 'SUB':
      result = a - b;
      carry = result < 0 ? 1 : 0;
      overflow = (((a ^ b) & (a ^ result)) & 0x80) ? 1 : 0;
      result = clamp8(result);
      break;
    case 'AND':  result = clamp8(a & b); break;
    case 'OR':   result = clamp8(a | b); break;
    case 'XOR':  result = clamp8(a ^ b); break;
    case 'NOT':  result = clamp8(~a); break;
    case 'SHL':  carry = (a >> 7) & 1; result = clamp8(a << 1); break;
    case 'SHR':  carry = a & 1; result = clamp8(a >> 1); break;
    default:     result = 0;
  }
  var zero = result === 0 ? 1 : 0;
  var neg  = (result >> 7) & 1;
  return { value: result, Z: zero, C: carry, N: neg, V: overflow };
}

// ── Bit display ────────────────────────────────────────────────
function renderBits(containerId, n, flash) {
  var bits = toBin8(n).split('');
  var container = el(containerId);
  var spans = container.querySelectorAll('.bit');
  spans.forEach(function(span, i) {
    span.textContent = bits[i];
    if (bits[i] === '1') {
      span.classList.add('one');
    } else {
      span.classList.remove('one');
    }
    if (flash) {
      span.classList.remove('flash');
      void span.offsetWidth; // force reflow
      span.classList.add('flash');
    }
  });
}

function renderResultBits(n, flash) {
  var bits = toBin8(n).split('');
  var container = el('resultBits');
  var spans = container.querySelectorAll('.bit');
  spans.forEach(function(span, i) {
    span.textContent = bits[i];
    span.classList.toggle('one', bits[i] === '1');
    if (flash) {
      span.classList.remove('flash');
      void span.offsetWidth;
      span.classList.add('flash');
    }
  });
}

// ── Packet animation ───────────────────────────────────────────
function sendPackets(containerId, count, cls) {
  var container = el(containerId);
  for (var i = 0; i < (count || 3); i++) {
    (function(delay) {
      setTimeout(function() {
        var p = document.createElement('div');
        p.className = 'packet' + (cls ? ' ' + cls : '');
        container.appendChild(p);
        setTimeout(function() { p.remove(); }, 700);
      }, delay);
    })(i * 160);
  }
}

// ── Pipeline breadcrumb ────────────────────────────────────────
function setPipeline(activeIdx) {
  for (var i = 0; i < 5; i++) {
    var ps = el('ps' + i);
    ps.classList.remove('active', 'done');
    if (i < activeIdx) ps.classList.add('done');
    else if (i === activeIdx) ps.classList.add('active');
  }
}

// ── Dot indicators ─────────────────────────────────────────────
function updateDots(step) {
  document.querySelectorAll('.dot').forEach(function(d, i) {
    d.classList.remove('active', 'done');
    if (i < step) d.classList.add('done');
    else if (i === step) d.classList.add('active');
  });
}

// ── Highlight elements ─────────────────────────────────────────
function setActive(id, on) {
  var e = el(id);
  if (e) e.classList.toggle('active', on);
}
function setLit(id, on) {
  var e = el(id);
  if (e) e.classList.toggle('lit', on);
}

// ── Step info ──────────────────────────────────────────────────
function setStepPanel(step) {
  var s = STEPS[step];
  el('sipStep').textContent = 'STEP ' + step + ' / 5';
  el('sipTitle').textContent = s.title;
  el('sipDesc').textContent = s.desc;
  if (s.pipeline >= 0) setPipeline(s.pipeline);
  updateDots(step);
}

// ── Log ────────────────────────────────────────────────────────
function log(msg, cls) {
  var body = el('logBody');
  var div = document.createElement('div');
  div.className = 'log-entry ' + (cls || 'step');
  var now = new Date();
  var ts = now.getHours().toString().padStart(2,'0') + ':' +
           now.getMinutes().toString().padStart(2,'0') + ':' +
           now.getSeconds().toString().padStart(2,'0') + '.' +
           now.getMilliseconds().toString().padStart(3,'0');
  div.textContent = '[ ' + ts + ' ] ' + msg;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

// ── Draw arrows (SVG) ──────────────────────────────────────────
function drawArrows() {
  var svg = el('arrows');
  // Remove all but defs
  while (svg.children.length > 1) svg.removeChild(svg.lastChild);

  var stage = el('stage');
  var sr = stage.getBoundingClientRect();
  var offX = sr.left + window.scrollX;
  var offY = sr.top + window.scrollY;

  function rel(r) {
    return {
      x: r.left + window.scrollX - offX + r.width / 2,
      y: r.top + window.scrollY - offY + r.height / 2,
      t: r.top + window.scrollY - offY,
      b: r.top + window.scrollY - offY + r.height,
      l: r.left + window.scrollX - offX,
      r: r.left + window.scrollX - offX + r.width
    };
  }

  svg.setAttribute('width', stage.offsetWidth);
  svg.setAttribute('height', stage.offsetHeight);

  var rA   = rel(el('regA').getBoundingClientRect());
  var busA = rel(el('busA').getBoundingClientRect());
  var alu  = rel(el('aluBlock').getBoundingClientRect());
  var rB   = rel(el('regB').getBoundingClientRect());
  var busB = rel(el('busB').getBoundingClientRect());
  var outB = rel(el('outBus').getBoundingClientRect());
  var rr   = rel(el('resultBlock').getBoundingClientRect());
  var flags= rel(el('flagsBlock').getBoundingClientRect());
  var ctrl = rel(el('ctrlBlock').getBoundingClientRect());

  function mk(id, d, dashed) {
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', dashed ? 'arr-dash' : 'arr');
    p.setAttribute('id', 'arrow-' + id);
    p.setAttribute('marker-end', 'url(#ah-dim)');
    svg.appendChild(p);
  }

  // Reg A → Bus A
  mk('ra-ba', 'M'+rA.r+' '+rA.y+' L'+(busA.l)+' '+busA.y);
  // Bus A → ALU
  mk('ba-alu', 'M'+busA.x+' '+busA.b+' L'+alu.l+' '+(alu.y - 20));
  // Reg B → Bus B
  mk('rb-bb', 'M'+rB.l+' '+rB.y+' L'+(busB.r)+' '+busB.y);
  // Bus B → ALU
  mk('bb-alu', 'M'+busB.x+' '+busB.b+' L'+alu.r+' '+(alu.y - 20));
  // ALU → out bus
  mk('alu-ob', 'M'+alu.x+' '+alu.b+' L'+outB.x+' '+outB.t);
  // out bus → result
  mk('ob-rr', 'M'+outB.x+' '+outB.b+' L'+rr.x+' '+rr.t);
  // result → flags (dashed)
  mk('rr-fl', 'M'+rr.x+' '+rr.b+' L'+flags.x+' '+flags.t, true);
  // Ctrl → ALU
  mk('ctrl-alu', 'M'+ctrl.x+' '+ctrl.b+' L'+alu.x+' '+alu.t, true);
}

function litArrow(id, on) {
  var e = el('arrow-' + id);
  if (!e) return;
  e.classList.toggle('lit', on);
  if (on) e.setAttribute('marker-end', 'url(#ah)');
  else e.setAttribute('marker-end', 'url(#ah-dim)');
}

// ── Apply step visuals ─────────────────────────────────────────
function applyStep(step) {
  // Clear all highlights
  ['regA','regB','ctrlBlock','aluBlock','resultBlock','flagsBlock','irBlock'].forEach(function(id) {
    setActive(id, false);
    setLit(id, false);
  });
  ['ra-ba','ba-alu','rb-bb','bb-alu','alu-ob','ob-rr','rr-fl','ctrl-alu'].forEach(function(id) {
    litArrow(id, false);
  });

  el('ctrlBlock').querySelector('.ctrl-signal').textContent = 'READY';
  el('ctrlBlock').classList.remove('active');
  el('aluBlock').classList.remove('computing');

  var res = compute(state.op, state.valA, state.valB);

  if (step === 0) {
    // idle
    resetResultDisplay();
    return;
  }

  if (step >= 1) {
    // Instruction fetch — light up IR
    setLit('irBlock', true);
    log('IF: Instruction [' + state.op + ' A=' + toHex(state.valA) + ' B=' + toHex(state.valB) + '] fetched into IR', 'step');
  }

  if (step >= 2) {
    // Decode + register fetch
    setActive('regA', true);
    setActive('regB', true);
    litArrow('ra-ba', true);
    litArrow('rb-bb', true);
    sendPackets('busAPackets', 3);
    sendPackets('busBPackets', 3);
    el('ctrlBlock').classList.add('active');
    el('ctrlBlock').querySelector('.ctrl-signal').textContent = 'DECODE';
    litArrow('ctrl-alu', true);
    log('ID: Reg A=' + toHex(state.valA) + ' (' + toBin8(state.valA) + ')  Reg B=' + toHex(state.valB) + ' (' + toBin8(state.valB) + ')  Op=' + state.op, 'step');
  }

  if (step >= 3) {
    // Execute
    litArrow('ba-alu', true);
    litArrow('bb-alu', true);
    setActive('aluBlock', true);
    el('aluBlock').classList.add('computing');
    el('ctrlBlock').querySelector('.ctrl-signal').textContent = 'EXECUTE';
    log('EX: ' + toHex(state.valA) + ' ' + OP_SYMBOLS[state.op] + ' ' + toHex(state.valB) + ' = ' + toHex(res.value) + ' (' + res.value + ')', 'step');
  }

  if (step >= 4) {
    // Write-back
    litArrow('alu-ob', true);
    litArrow('ob-rr', true);
    sendPackets('outBusPackets', 4);
    setActive('resultBlock', true);
    el('resultBlock').querySelector('.result-hex').textContent = toHex(res.value);
    el('resultBlock').querySelector('.result-dec').textContent = '(' + res.value + ')';
    renderResultBits(res.value, true);
    el('ctrlBlock').querySelector('.ctrl-signal').textContent = 'WRITE-BACK';
    log('WB: Result ' + toHex(res.value) + ' (' + toBin8(res.value) + ') written to Result Register', 'result');
  }

  if (step >= 5) {
    // Flags
    litArrow('rr-fl', true);
    setActive('flagsBlock', true);
    ['Z','C','N','V'].forEach(function(f) {
      var flagEl = el('flag-' + f);
      var valEl = el('fv-' + f);
      flagEl.classList.remove('set','clr');
      if (res[f]) {
        flagEl.classList.add('set');
        valEl.textContent = '1';
      } else {
        flagEl.classList.add('clr');
        valEl.textContent = '0';
      }
    });
    var flagStr = 'Z='+res.Z+' C='+res.C+' N='+res.N+' V='+res.V;
    log('FLAGS: ' + flagStr, 'flag');
    if (res.Z) log('  ↳ Zero flag SET — result is zero', 'flag');
    if (res.C) log('  ↳ Carry flag SET — result overflowed 8 bits', 'flag');
    if (res.N) log('  ↳ Negative flag SET — bit 7 is 1', 'flag');
    if (res.V) log('  ↳ Overflow flag SET — signed overflow detected', 'flag');
    log('PIPELINE COMPLETE ─────────────────────────────────', 'result');
  }
}

function resetResultDisplay() {
  el('resultBlock').querySelector('.result-hex').textContent = '—';
  el('resultBlock').querySelector('.result-dec').textContent = '—';
  var spans = el('resultBits').querySelectorAll('.bit');
  spans.forEach(function(s) { s.textContent = '?'; s.classList.remove('one','flash'); });
  ['Z','C','N','V'].forEach(function(f) {
    var flagEl = el('flag-' + f);
    var valEl = el('fv-' + f);
    flagEl.classList.remove('set','clr');
    valEl.textContent = '—';
  });
  setPipeline(-1);
}

// ── Sync all input-driven UI ───────────────────────────────────
function syncInputs() {
  var hexA = el('inputA').value.replace(/[^0-9a-fA-F]/g,'').slice(0,2);
  var hexB = el('inputB').value.replace(/[^0-9a-fA-F]/g,'').slice(0,2);
  state.valA = parseHex(hexA || '00');
  state.valB = parseHex(hexB || '00');

  el('prevA').textContent = toBin8(state.valA);
  el('prevB').textContent = toBin8(state.valB);

  el('regAHex').textContent = toHex(state.valA);
  el('regADec').textContent = state.valA;
  el('regBHex').textContent = toHex(state.valB);
  el('regBDec').textContent = state.valB;

  renderBits('regABits', state.valA, false);
  renderBits('regBBits', state.valB, false);

  el('irOp').textContent = state.op;
  el('irFieldA').textContent = 'A: ' + toHex(state.valA);
  el('irFieldB').textContent = 'B: ' + toHex(state.valB);

  // Update ALU op symbol
  el('aluOpSym').textContent = OP_SYMBOLS[state.op] || state.op;

  // Update ops panel
  Object.keys(OP_SYMBOLS).forEach(function(op) {
    var a = el('aop-' + op);
    if (a) a.classList.toggle('active', op === state.op);
  });
}

// ── Navigation ─────────────────────────────────────────────────
function goStep(s) {
  state.step = Math.max(0, Math.min(5, s));
  syncInputs();
  applyStep(state.step);
  setStepPanel(state.step);

  el('btnPrev').disabled = state.step <= 0;
  el('btnNext').disabled = state.step >= 5;
  el('btnNext').textContent = state.step === 0 ? 'START ▶' : (state.step < 5 ? 'NEXT ▶' : 'DONE ✓');
}

function doReset() {
  stopAuto();
  state.step = 0;
  syncInputs();
  resetResultDisplay();
  setStepPanel(0);
  setPipeline(-1);
  updateDots(0);
  el('btnPrev').disabled = true;
  el('btnNext').disabled = false;
  el('btnNext').textContent = 'START ▶';
  drawArrows();
  log('─── RESET ─────────────────────────────────────────', 'init');
}

function stopAuto() {
  if (state.autoTimer) {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
    el('btnAuto').textContent = '▶▶ AUTO';
  }
}

function startAuto() {
  if (state.autoTimer) { stopAuto(); return; }
  if (state.step >= 5) doReset();
  el('btnAuto').textContent = '■ STOP';
  state.autoTimer = setInterval(function() {
    if (state.step >= 5) { stopAuto(); return; }
    goStep(state.step + 1);
  }, 1400);
}

// ── Attach events ──────────────────────────────────────────────
window.addEventListener('load', function() {

  // Hex inputs
  ['inputA','inputB'].forEach(function(id) {
    el(id).addEventListener('input', function() {
      syncInputs();
      if (state.step > 0) doReset();
    });
    el(id).addEventListener('keydown', function(e) {
      if (!/[0-9a-fA-FBackspaceDeleteArrowLeftArrowRight]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    });
  });

  // Op buttons
  el('opButtons').addEventListener('click', function(e) {
    if (e.target.classList.contains('op-btn')) {
      document.querySelectorAll('.op-btn').forEach(function(b) { b.classList.remove('active'); });
      e.target.classList.add('active');
      state.op = e.target.dataset.op;
      syncInputs();
      if (state.step > 0) doReset();
    }
  });

  // Playback
  el('btnNext').addEventListener('click', function() { goStep(state.step + 1); });
  el('btnPrev').addEventListener('click', function() { goStep(state.step - 1); });
  el('btnReset').addEventListener('click', doReset);
  el('btnAuto').addEventListener('click', startAuto);

  // Dot navigation
  document.querySelectorAll('.dot').forEach(function(d) {
    d.addEventListener('click', function() { goStep(parseInt(d.dataset.i)); });
  });

  // Log clear
  el('logClear').addEventListener('click', function() {
    el('logBody').innerHTML = '<div class="log-entry init">[ SYS ] Log cleared.</div>';
  });

  // Init
  syncInputs();
  setStepPanel(0);
  setPipeline(-1);
  updateDots(0);
  el('btnPrev').disabled = true;

  // Draw arrows after layout is stable
  setTimeout(function() { drawArrows(); }, 200);
  window.addEventListener('resize', function() { setTimeout(drawArrows, 100); });

  log('[ SYS ] ALU Demo v2.0 ready. RegA=' + toHex(state.valA) + ' RegB=' + toHex(state.valB) + ' Op=' + state.op, 'init');
});
