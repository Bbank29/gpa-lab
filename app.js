/* =========================================================
   โปรแกรมทดลองคำนวณเกรดเฉลี่ยสะสม (GPA) — การทำงานทั้งหมด
   ลำดับ: ตั้งค่า → รายวิชา → คำนวณ GPA → ป๊อปอัป
          → คำอธิบาย CAX/CGX → ตัวนับผู้เข้าใช้งาน → แบบประเมิน → หน้าแอดมิน → เริ่มทำงาน
   ========================================================= */

(() => {

  /* ---------- 1. ตั้งค่า ---------- */

  // สีประจำแต่ละวิชา (แถบซ้าย, พื้นการ์ด) วนใช้ตามลำดับที่กดเพิ่ม
  const COURSE_COLORS = [
    ['#2f7de1', '#eef5fe'],  // ฟ้า
    ['#18a058', '#ecf9f2'],  // เขียว
    ['#f08c00', '#fff6e8'],  // ส้ม
    ['#8b5cf6', '#f4f0fe'],  // ม่วง
    ['#e8507a', '#fdeff3'],  // ชมพู
    ['#0ea5a5', '#e9f8f8'],  // เขียวอมฟ้า
    ['#d4a017', '#fdf8e6'],  // เหลือง
    ['#ef6a3a', '#fef1ec'],  // แสด
  ];

  // ค่าเกรด
  const SCALE = { 'A': 4, 'B+': 3.5, 'B': 3, 'C+': 2.5, 'C': 2, 'D+': 1.5, 'D': 1, 'F': 0 };

  // ตัวนับผู้เข้าใช้งานและแบบประเมิน เก็บที่บริการฟรี abacus (ไม่ต้องมีฐานข้อมูลเอง)
  // ดูผลแบบประเมินได้ที่ https://abacus.jasoncameron.dev/get/sdu-gpa-lab-v3/rating-1 ถึง rating-5
  const COUNTER_URL = 'https://abacus.jasoncameron.dev';
  const COUNTER_NS = 'sdu-gpa-lab-v3';

  // ตอนทดสอบผ่าน localhost จะแค่แสดงยอด ไม่นับเพิ่ม
  const LIVE = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  const $ = id => document.getElementById(id);
  const rows = $('rows');
  let toastTimer;
  let lastFocus = null;
  let visitCount = null;
  let colorIndex = 0;


  /* ---------- 2. รายวิชา ---------- */

  // ช่องที่รับเฉพาะจำนวนเต็ม (หน่วยกิต)
  function intOnly(el) {
    el.addEventListener('keydown', e => {
      if (['.', ',', 'e', 'E', '-', '+'].includes(e.key)) e.preventDefault();
    });
    el.addEventListener('input', () => {
      // ตัดให้ไม่เกิน maxlength ด้วย เพราะคีย์บอร์ดมือถือบางรุ่นไม่สนใจ maxlength
      const v = el.value.replace(/[^0-9]/g, '').slice(0, el.maxLength > 0 ? el.maxLength : undefined);
      if (v !== el.value) el.value = v;
    });
  }

  const gradeOptions = Object.keys(SCALE).map(g => `<option value="${g}">${g}</option>`).join('');

  const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>`;

  function makeRow() {
    const row = document.createElement('div');
    row.className = 'course';

    // ให้สีประจำวิชา (สีติดวิชาไว้ ลบวิชาอื่นแล้วสีไม่เลื่อน)
    const [color, bg] = COURSE_COLORS[colorIndex++ % COURSE_COLORS.length];
    row.style.setProperty('--c', color);
    row.style.setProperty('--bg', bg);

    row.innerHTML = `
      <div class="c-num"><span><small>วิชาที่ </small><b></b></span></div>
      <div class="c-code"><input class="field code" aria-label="รหัสวิชา" placeholder="รหัสวิชา"></div>
      <div class="c-name"><input class="field name" aria-label="ชื่อวิชา" placeholder="ชื่อวิชา"></div>
      <div class="c-cred"><input class="field credits" aria-label="หน่วยกิต" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" placeholder="หน่วยกิต"></div>
      <div class="c-grade"><select class="field grade" aria-label="เกรด"><option value="">เลือกเกรด</option>${gradeOptions}</select></div>
      <div class="c-del"><button class="del" type="button" aria-label="ลบรายวิชา" title="ลบรายวิชา">${TRASH_ICON}</button></div>`;

    // หน่วยกิตพิมพ์ได้เลขเดียว (0–9)
    intOnly(row.querySelector('.credits'));

    // ช่องเกรดที่ยังไม่ได้เลือก ให้ตัวอักษรจาง
    const grade = row.querySelector('.grade');
    const paintGrade = () => grade.classList.toggle('unset', !grade.value);
    paintGrade();
    grade.addEventListener('change', paintGrade);

    row.addEventListener('input', calc);
    row.addEventListener('change', calc);
    // กรอกช่องที่เคยถูกเตือนแล้ว เอากรอบแดงออก
    row.addEventListener('input', e => e.target.classList.remove('need'));
    row.addEventListener('change', e => e.target.classList.remove('need'));
    row.querySelector('.del').addEventListener('click', () => {
      row.remove();
      updateCount();
      calc();
    });

    rows.appendChild(row);
    updateCount();
    calc();
  }

  function updateCount() {
    const n = rows.children.length;
    // เลขลำดับวิชา 1, 2, 3… เรียงใหม่ทุกครั้งที่เพิ่ม/ลบ
    [...rows.children].forEach((r, i) => { r.querySelector('.c-num b').textContent = i + 1; });
    $('count').textContent = n ? `${n} วิชา` : '';
    $('empty').hidden = n > 0;
  }


  /* ---------- 3. คำนวณ GPA ---------- */

  function num(id) {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) && v >= 0 ? v : null;
  }

  function fmt(v) {
    return Number.isFinite(v) ? v.toFixed(2) : '–';
  }

  function calc() {
    const cax = num('cax');
    const cgx = num('cgx');

    // รวมเฉพาะวิชาที่กรอกหน่วยกิตและเลือกเกรดครบ
    let credits = 0, points = 0, courseCount = 0;
    for (const r of rows.children) {
      const c = parseInt(r.querySelector('.credits').value, 10);
      const g = r.querySelector('.grade').value;
      if (Number.isFinite(c) && c > 0 && g in SCALE) {
        credits += c;
        points += c * SCALE[g];
        courseCount++;
      }
    }

    const filled = cax !== null && cgx !== null;
    const old = filled && cax > 0 ? cgx / cax : null;   // นักศึกษาที่ยังไม่มีเกรด (CAX = 0) ยังไม่มี GPA เดิม

    // GPA ใหม่ขึ้นเมื่อกรอก CAX/CGX แล้ว (ใส่ 0 ได้) และมีอย่างน้อย 1 วิชาที่กรอกครบ
    const ready = filled && courseCount > 0;
    const newVal = ready ? (cgx + points) / (cax + credits) : null;

    $('oldGpa').textContent = fmt(old);
    $('newGpa').textContent = fmt(newVal);

    // เทียบกับ GPA เดิม: สูงขึ้น = เขียว, ลดลง = แดง
    const diff = ready && old !== null ? Math.round((newVal - old) * 100) / 100 : null;
    const box = $('newGpa').parentElement;
    box.classList.toggle('up', diff > 0);
    box.classList.toggle('down', diff < 0);
    box.classList.toggle('lit', ready);   // มีตัวเลข GPA ใหม่แล้ว: กล่องนี้ขยายเด่นขึ้น
    maybeInvite(ready);                    // ชวนประเมินเมื่อเห็นผลแล้วหยุดใช้งาน 15 วินาที (ส่วนที่ 8.1)
    $('newDelta').textContent =
      diff === null ? '' : diff > 0 ? `▲ เพิ่มขึ้น ${diff.toFixed(2)}` : diff < 0 ? `▼ ลดลง ${Math.abs(diff).toFixed(2)}` : 'เท่าเดิม';
    $('sCax').textContent = ready ? String(cax + credits) : '–';
    $('sCgx').textContent = ready ? fmt(cgx + points) : '–';
    $('sCaxOld').textContent = ready ? `(เดิม ${cax} +${credits})` : '';
    $('sCgxOld').textContent = ready ? `(เดิม ${fmt(cgx)} +${fmt(points)})` : '';

    $('announce').textContent =
      !filled ? 'กรอก CAX และ CGX ก่อนคำนวณ (นักศึกษาที่ยังไม่มีเกรด ใส่ 0)'
      : ready ? `GPA เดิม ${fmt(old)} · GPA ใหม่ ${fmt(newVal)} ${$('newDelta').textContent}`
      : `GPA เดิม ${fmt(old)} · เพิ่มรายวิชาพร้อมหน่วยกิตและเกรดเพื่อดู GPA ใหม่`;
  }


  /* ---------- 4. ป๊อปอัปและข้อความแจ้งเตือน ---------- */

  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
  }

  function openModal(id) {
    lastFocus = document.activeElement;
    const m = $(id);
    m.hidden = false;
    m.querySelector('.dialog-close').focus();
  }

  function closeModal(m) {
    m.hidden = true;
    m.classList.remove('auto');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ปิดเมื่อกดพื้นหลัง หรือปุ่มที่มี data-close
  // ยกเว้นแบบประเมินที่เด้งเอง (.auto): ต้องกดส่งแบบประเมินก่อนถึงจะหายไป
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => {
      if (m.classList.contains('auto')) return;
      if (e.target === m || e.target.closest('[data-close]')) closeModal(m);
    });
  });

  // ปิดด้วยปุ่ม Esc
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal-backdrop')].find(m => !m.hidden);
    if (open && !open.classList.contains('auto')) closeModal(open);
  });


  /* ---------- 5. คำอธิบาย CAX / CGX ---------- */

  // ภาพตัวอย่างหน้าผลการเรียน + กรอบแดงรอบคอลัมน์ CAX / CGX และแถบเหลืองที่บรรทัดล่างสุด
  // ตำแหน่งกรอบเป็น % ของภาพ จึงตรงทุกขนาดจอ (เขียนติดกันบรรทัดเดียว เพราะกล่องข้อความเว้นบรรทัดตามช่องว่าง)
  // วงเฉพาะคอลัมน์ของปุ่มที่กด: กด CAX วง CAX, กด CGX วง CGX
  const HELP_COL = { cax: { left: 67.9, value: '21.00' }, cgx: { left: 82.6, value: '75.00' } };
  const helpImg = which => {
    const c = HELP_COL[which], name = which.toUpperCase();
    return '<div class="help-shot">'
      + `<img class="help-img" src="images/cax-cgx.jpg" alt="ตัวอย่างหน้าผลการเรียน กรอบแดงที่คอลัมน์ ${name} บรรทัดล่างสุดคือ ${c.value}">`
      + `<span class="last" style="left:${c.left + 0.5}%;width:13.4%"></span>`
      + `<span class="mark" style="left:${c.left}%;width:14.4%"><b>${name}</b></span>`
      + '</div><small class="help-cap">แถบสีเหลือง = ตัวเลขที่ต้องกรอก</small>';
  };

  const HELP = {
    cax: {
      title: 'CAX คืออะไร?',
      body: `<b>CAX</b> = จำนวนหน่วยกิตสะสมทั้งหมดที่ได้รับการประเมินผลแล้ว (เฉพาะวิชาที่มีเกรด A–F)

<b>ดูจากไหน:</b> ระบบทะเบียน → เมนู “ผลการเรียน” → คอลัมน์ <b>CAX</b> ใช้<b>ตัวเลขบรรทัดล่างสุด</b> (กรอบแดงในภาพ)

<b>ใส่อะไร:</b> ตามภาพคือ <b>21</b> (พิมพ์ 21 หรือ 21.00 ก็ได้)

<b>นักศึกษาที่ยังไม่มีเกรด:</b> ใส่ 0${helpImg('cax')}`,
    },
    cgx: {
      title: 'CGX คืออะไร?',
      body: `<b>CGX</b> = คะแนนสะสมทั้งหมด คือผลรวมของ (หน่วยกิต × ค่าเกรด) ทุกวิชาที่เรียนมา

<b>ดูจากไหน:</b> หน้า “ผลการเรียน” เดียวกับ CAX → คอลัมน์ <b>CGX</b> ใช้<b>ตัวเลขบรรทัดล่างสุด</b> (กรอบแดงในภาพ)

<b>ใส่อะไร:</b> ตามภาพคือ <b>75.00</b>

<b>ตรวจสอบ:</b> CGX ÷ CAX ต้องเท่ากับเกรดเฉลี่ยสะสม เช่น 75.00 ÷ 21 = 3.57

<b>นักศึกษาที่ยังไม่มีเกรด:</b> ใส่ 0${helpImg('cgx')}`,
    },
  };

  document.querySelectorAll('.explain').forEach(btn => {
    btn.addEventListener('click', () => {
      const h = HELP[btn.dataset.help];
      $('helpTitle').textContent = h.title;
      $('helpBody').innerHTML = h.body;
      openModal('helpModal');
    });
  });


  /* ---------- 6. ตัวนับผู้เข้าใช้งาน (นับทุกครั้งที่เปิดหน้า) ---------- */

  fetch(`${COUNTER_URL}/${LIVE ? 'hit' : 'get'}/${COUNTER_NS}/visits`)
    .then(r => r.json())
    .then(d => {
      visitCount = Number.isFinite(d.value) ? d.value : 0;
      $('visitN').textContent = visitCount.toLocaleString('th-TH');
    })
    .catch(() => {});


  /* ---------- 7. แบบประเมินความพึงพอใจ ---------- */
  // ส่งดาว + ความคิดเห็นผ่าน backend (ส่วนที่ 8): มีเซิร์ฟเวอร์ = บันทึกลงฐานข้อมูล, ไม่มี = โหมดตัวอย่าง

  const RATE_TEXT = {
    1: '1 ดาว – ต้องปรับปรุง',
    2: '2 ดาว – พอใช้',
    3: '3 ดาว – ปานกลาง',
    4: '4 ดาว – ดีมาก',
    5: '5 ดาว – ยอดเยี่ยม',
  };

  const STAR_ICON = `<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;

  let rating = 0;
  const votes = [0, 0, 0, 0, 0, 0]; // votes[ดาว] = จำนวนคน

  // คะแนนเฉลี่ยสะสม = รวม (ดาว × จำนวนคนที่ให้) ÷ จำนวนคนทั้งหมด
  function showAverage() {
    const n = votes.reduce((a, b) => a + b, 0);
    const sum = votes.reduce((a, v, star) => a + v * star, 0);
    $('avgN').textContent = n ? (sum / n).toFixed(1) : '–';
    $('avgCount').textContent = n ? `(${n.toLocaleString('th-TH')} คน)` : '(ยังไม่มีผู้ประเมิน)';
  }

  function paintStars() {
    document.querySelectorAll('.star').forEach(b => b.classList.toggle('on', +b.dataset.s <= rating));
    $('rateLabel').textContent = rating ? RATE_TEXT[rating] : 'แตะดาวเพื่อให้คะแนน (1 - 5)';
  }

  // สร้างดาว 5 ดวง
  $('stars').innerHTML = [1, 2, 3, 4, 5]
    .map(s => `<button class="star" type="button" data-s="${s}" aria-label="${s} ดาว">${STAR_ICON}</button>`)
    .join('');

  document.querySelectorAll('.star').forEach(b => {
    b.addEventListener('click', () => {
      rating = +b.dataset.s;
      paintStars();
    });
  });

  $('rateText').addEventListener('input', () => {
    $('rateCount').textContent = `${$('rateText').value.length}/300`;
  });

  $('openRate').addEventListener('click', () => openModal('rateModal'));

  $('rateSend').addEventListener('click', () => {
    if (!rating) {
      toast('กรุณาเลือกคะแนน (1-5 ดาว) ก่อนส่งครับ');
      return;
    }

    backend.submit(rating, $('rateText').value.trim());
    votes[rating]++;
    showAverage();
    markRated();

    closeModal($('rateModal'));
    rating = 0;
    $('rateText').value = '';
    $('rateCount').textContent = '0/300';
    paintStars();
    toast('ขอบคุณสำหรับการประเมินครับ');
  });

  // คะแนนสะสมของทุกระดับดาวโหลดตอนเริ่มทำงาน (ส่วนที่ 9) หลังรู้ว่ามีเซิร์ฟเวอร์หรือไม่


  /* ---------- 8. ระบบผู้ดูแล ---------- */
  // มี 2 โหมด เลือกเองอัตโนมัติตอนเปิดเว็บ
  //   ฐานข้อมูล: เปิดผ่านเซิร์ฟเวอร์ PHP (โฟลเดอร์ api/) ข้อมูลอยู่ใน data/gpa_lab.db (SQLite)
  //   ตัวอย่าง : เปิดไฟล์เดี่ยว ๆ ไม่มีเซิร์ฟเวอร์ ข้อมูลอยู่ใน localStorage ของเครื่องนี้ (ไม่ปลอดภัย ใช้นำเสนอ)
  // สลับหน้าด้วย #admin ท้ายลิงก์ ปุ่มย้อนกลับของมือถือจึงพากลับหน้าคำนวณได้

  function showView() {
    const admin = location.hash === '#admin';
    $('mainView').hidden = admin;
    $('adminView').hidden = !admin;
    document.body.classList.toggle('admin-mode', admin);
    scrollTo(0, 0);
  }

  let openedFromMain = false;
  window.addEventListener('hashchange', showView);
  $('openAdmin').addEventListener('click', () => {
    openedFromMain = true;
    location.hash = 'admin';
  });
  $('backHome').addEventListener('click', () => {
    if (openedFromMain) history.back();
    else location.hash = '';
  });

  $('passToggle').addEventListener('click', () => {
    const pass = $('adminPass');
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    $('passToggle').textContent = show ? 'ซ่อน' : 'แสดง';
  });

  const LEVEL_NAME = { super: 'ซุปเปอร์แอดมิน', admin: 'แอดมินทั่วไป' };
  const API_ERRORS = {
    wrong_login: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
    username_taken: 'ชื่อผู้ใช้นี้มีอยู่แล้ว',
    bad_username: 'ชื่อผู้ใช้ใช้ a-z 0-9 _ . - ได้ 3–20 ตัว',
    missing_fields: 'กรอกข้อมูลให้ครบ (รหัสผ่านอย่างน้อย 4 ตัว)',
    short_password: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัว',
    wrong_password: 'รหัสผ่านเดิมไม่ถูกต้อง',
    unauthorized: 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่',
    forbidden: 'ไม่มีสิทธิ์ทำรายการนี้',
  };
  const errText = code => API_ERRORS[code] || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';

  // ---- โหมดฐานข้อมูล: เรียก API ฝั่งเซิร์ฟเวอร์ ----
  async function api(file, data, query = '') {
    const opt = { credentials: 'same-origin' };
    if (data) {
      opt.method = 'POST';
      opt.headers = { 'Content-Type': 'application/json' };
      opt.body = JSON.stringify(data);
    }
    const res = await fetch(`api/${file}.php${query}`, opt);
    return res.json();
  }

  const serverBackend = {
    mode: 'server',
    async current() { return (await api('auth')).user; },
    async login(username, password) {
      const r = await api('auth', { action: 'login', username, password });
      return r.user ? { me: r.user } : { error: r.error };
    },
    async logout() { await api('auth', { action: 'logout' }); },
    async counts() { return (await api('feedback')).counts; },
    submit(stars, comment) { api('feedback', { stars, comment }).catch(() => {}); },
    async comments() { return (await api('feedback', null, '?list=1')).items || []; },
    async admins() { return (await api('admins')).items || []; },
    async addAdmin(a) { return (await api('admins', { action: 'add', ...a })).error; },
    async updateAdmin(id, a) { return (await api('admins', { action: 'update', id, ...a })).error; },
    async deleteAdmin(id) { return (await api('admins', { action: 'delete', id })).error; },
    async updateMe(fields) {
      const r = await api('admins', { action: 'me', ...fields });
      return r.user ? { me: r.user } : { error: r.error };
    },
  };

  // ---- โหมดตัวอย่าง: เก็บในเครื่องนี้ (บางเบราว์เซอร์ห้ามใช้ localStorage จึงมีสำรองในหน่วยความจำ) ----
  const STORE_KEY = 'gpaAdminDemo';
  let memoryStore = null;

  function defaultStore() {
    return {
      admins: [
        { id: 1, username: 'superadmin', pass: '1234', display_name: 'ผู้ดูแลหลัก', role: 'super' },
        { id: 2, username: 'admin1', pass: '1234', display_name: 'แอดมิน 1', role: 'admin' },
      ],
      comments: [
        { stars: 5, comment: 'ใช้ง่ายมาก คำนวณเร็ว ชอบที่มีภาพบอกว่า CAX อยู่ตรงไหน', created_at: Date.now() - 86400000, sample: true },
        { stars: 4, comment: 'อยากให้มีปุ่มล้างข้อมูลทั้งหมด', created_at: Date.now() - 2 * 86400000, sample: true },
      ],
    };
  }
  function loadStore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && Array.isArray(s.admins) && Array.isArray(s.comments) && s.admins.every(a => a.id && a.username)) return s;
    } catch (e) { /* ใช้ค่าเริ่มต้น */ }
    return memoryStore || (memoryStore = defaultStore());
  }
  function saveStore(s) {
    memoryStore = s;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* เก็บในหน่วยความจำอย่างเดียว */ }
  }
  const publicAdmin = a => ({ id: a.id, username: a.username, display_name: a.display_name, role: a.role });
  let demoMe = null;

  const demoBackend = {
    mode: 'demo',
    async current() { return demoMe; },
    async login(username, password) {
      const a = loadStore().admins.find(x => x.username === username && x.pass === password);
      if (!a) return { error: 'wrong_login' };
      demoMe = publicAdmin(a);
      return { me: demoMe };
    },
    async logout() { demoMe = null; },
    // ดาวในโหมดตัวอย่างนับรวมกันที่ abacus (ทุกเครื่องเห็นตรงกัน)
    async counts() {
      const c = {};
      await Promise.all([1, 2, 3, 4, 5].map(star =>
        fetch(`${COUNTER_URL}/get/${COUNTER_NS}/rating-${star}`)
          .then(r => r.json())
          .then(d => { c[star] = Number.isFinite(d.value) ? d.value : 0; })
          .catch(() => { c[star] = 0; })));
      return c;
    },
    submit(stars, comment) {
      if (LIVE) fetch(`${COUNTER_URL}/hit/${COUNTER_NS}/rating-${stars}`).catch(() => {});
      if (comment) {
        const s = loadStore();
        s.comments.unshift({ stars, comment, created_at: Date.now() });
        saveStore(s);
      }
    },
    async comments() { return loadStore().comments; },
    async admins() { return loadStore().admins; },
    async addAdmin({ display_name, username, password }) {
      const s = loadStore();
      if (!display_name || password.length < 4) return 'missing_fields';
      if (!/^[a-z0-9_.-]{3,20}$/.test(username)) return 'bad_username';
      if (s.admins.some(a => a.username === username)) return 'username_taken';
      s.admins.push({ id: Math.max(...s.admins.map(a => a.id)) + 1, username, pass: password, display_name, role: 'admin' });
      saveStore(s);
    },
    async updateAdmin(id, { display_name, password }) {
      if (!display_name) return 'missing_fields';
      if (password && password.length < 4) return 'short_password';
      const s = loadStore();
      const a = s.admins.find(x => x.id === id);
      a.display_name = display_name;
      if (password) a.pass = password;
      saveStore(s);
    },
    async deleteAdmin(id) {
      const s = loadStore();
      s.admins = s.admins.filter(x => x.id !== id || x.role === 'super');
      saveStore(s);
    },
    async updateMe(fields) {
      const s = loadStore();
      const mine = s.admins.find(x => x.id === demoMe.id);
      if ('display_name' in fields) {
        if (!fields.display_name) return { error: 'missing_fields' };
        mine.display_name = fields.display_name;
      }
      if ('new_password' in fields) {
        if (fields.old_password !== mine.pass) return { error: 'wrong_password' };
        if (fields.new_password.length < 4) return { error: 'short_password' };
        mine.pass = fields.new_password;
      }
      saveStore(s);
      demoMe = publicAdmin(mine);
      return { me: demoMe };
    },
  };

  let backend = demoBackend;

  // ตรวจว่ามีเซิร์ฟเวอร์ PHP + ฐานข้อมูลไหม (เปิดไฟล์เดี่ยว ๆ จะเรียกไม่ได้ = ใช้โหมดตัวอย่าง)
  async function detectBackend() {
    try {
      const r = await fetch('api/auth.php', { credentials: 'same-origin' });
      const d = await r.json();
      if ('user' in d) backend = serverBackend;
    } catch (e) { /* ไม่มีเซิร์ฟเวอร์ */ }
    $('apMode').hidden = backend !== serverBackend;   // แถบเขียวขึ้นเฉพาะตอนต่อฐานข้อมูลได้
  }

  async function loadVotes() {
    const c = await backend.counts().catch(() => null);
    if (c) for (let star = 1; star <= 5; star++) votes[star] = +c[star] || 0;
    showAverage();
  }

  // ---- หน้าจอแอดมิน ----
  let me = null;   // แอดมินที่เข้าสู่ระบบอยู่

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function showPanel(on) {
    $('adminPanel').hidden = !on;
    document.querySelector('.login-card').hidden = on;
    if (on) renderPanel();
  }

  function renderPanel() {
    const isSuper = me.role === 'super';
    const who = $('apWho');
    who.textContent = `${me.display_name} (${me.username})`;
    who.appendChild(el('span', 'ap-badge' + (isSuper ? ' super' : ''), LEVEL_NAME[me.role]));
    document.querySelector('[data-tab="admins"]').hidden = !isSuper;
    // แอดมินทั่วไปเปลี่ยนชื่อและรหัสเองไม่ได้ (ไม่เห็นเมนูบัญชีของฉัน) ต้องให้ซุปเปอร์แอดมินแก้ให้
    document.querySelector('[data-tab="account"]').hidden = !isSuper;
    $('apMyName').value = me.display_name;
    renderDash();
    renderComments();
    if (isSuper) renderAdmins();
  }

  function switchTab(tab) {
    document.querySelectorAll('#apTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll('.ap-pane').forEach(p => { p.hidden = p.dataset.pane !== tab; });
    if (tab === 'dash') loadVotes().then(renderDash);
    if (tab === 'comments') renderComments();
  }

  function renderDash() {
    const n = votes.reduce((a, b) => a + b, 0);
    const sum = votes.reduce((a, v, star) => a + v * star, 0);
    $('apVisits').textContent = visitCount === null ? '–' : visitCount.toLocaleString('th-TH');
    $('apAvg').textContent = n ? (sum / n).toFixed(1) : '–';
    $('apVotes').textContent = n.toLocaleString('th-TH');
    const bars = $('apBars');
    bars.textContent = '';
    for (let star = 5; star >= 1; star--) {
      const row = el('div', 'ap-bar');
      row.appendChild(el('span', '', `${star} ดาว`));
      const track = el('i');
      const fill = el('b');
      fill.style.width = n ? `${(votes[star] / n) * 100}%` : '0';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('span', '', String(votes[star])));
      bars.appendChild(row);
    }
  }

  // วันเวลาจากฐานข้อมูลเป็นข้อความ "2026-11-19 10:23:44" ส่วนโหมดตัวอย่างเป็นตัวเลขเวลา
  function fmtWhen(v) {
    const d = typeof v === 'number' ? new Date(v) : new Date(String(v).replace(' ', 'T'));
    return isNaN(d) ? String(v) : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  }

  async function renderComments() {
    const list = $('apComments');
    const items = (await backend.comments().catch(() => [])).filter(c => c.comment);
    list.textContent = '';
    if (!items.length) {
      list.appendChild(el('li', 'ap-empty', 'ยังไม่มีความคิดเห็น'));
      return;
    }
    items.forEach(c => {
      const li = el('li');
      li.appendChild(el('span', 'stars-txt', '★'.repeat(c.stars) + '☆'.repeat(5 - c.stars)));
      li.appendChild(el('div', '', c.comment));
      li.appendChild(el('small', '', fmtWhen(c.created_at) + (c.sample ? ' · ข้อความตัวอย่าง' : '')));
      list.appendChild(li);
    });
  }

  async function renderAdmins() {
    const list = $('apAdmins');
    const admins = await backend.admins().catch(() => []);
    const showPass = backend.mode === 'demo';   // ฐานข้อมูลจริงเก็บรหัสแบบเข้ารหัส จึงดูรหัสเดิมไม่ได้
    list.textContent = '';
    admins.forEach(a => {
      const li = el('li');
      const info = el('div');
      info.appendChild(el('b', '', a.display_name));
      info.appendChild(el('small', '', `${a.username} · ${LEVEL_NAME[a.role]}`));
      li.appendChild(info);
      if (a.role === 'super') {
        list.appendChild(li);
        return;
      }
      if (showPass) info.appendChild(el('small', 'ap-pass', `รหัสผ่าน: ${a.pass}`));

      const actions = el('div', 'ap-actions');
      const edit = el('button', 'ap-edit', 'แก้ไข');
      const del = el('button', 'ap-del', 'ลบ');
      edit.type = del.type = 'button';
      actions.append(edit, del);
      li.appendChild(actions);

      // ช่องแก้ชื่อ/ตั้งรหัสใหม่ (ซ่อนไว้ กด "แก้ไข" ถึงจะโผล่)
      const row = el('div', 'ap-passrow');
      row.hidden = true;
      const nameIn = el('input', 'field');
      nameIn.type = 'text';
      nameIn.value = a.display_name;
      nameIn.placeholder = 'ชื่อที่แสดง';
      const passIn = el('input', 'field');
      passIn.type = 'text';
      passIn.value = showPass ? a.pass : '';
      passIn.placeholder = showPass ? 'รหัสผ่าน (อย่างน้อย 4 ตัว)' : 'ตั้งรหัสใหม่ (เว้นว่าง = ใช้รหัสเดิม)';
      passIn.autocomplete = 'off';
      const save = el('button', 'ap-edit', 'บันทึก');
      save.type = 'button';
      row.append(nameIn, passIn, save);
      li.appendChild(row);

      edit.addEventListener('click', () => {
        row.hidden = !row.hidden;
        if (!row.hidden) nameIn.focus();
      });
      save.addEventListener('click', async () => {
        const err = await backend.updateAdmin(a.id, { display_name: nameIn.value.trim(), password: passIn.value });
        if (err) return toast(errText(err));
        renderAdmins();
        toast(`บันทึกข้อมูลของ ${nameIn.value.trim()} แล้ว`);
      });
      del.addEventListener('click', async () => {
        if (!confirm(`ลบแอดมิน "${a.display_name}" ?`)) return;
        const err = await backend.deleteAdmin(a.id);
        if (err) return toast(errText(err));
        renderAdmins();
        toast('ลบแอดมินแล้ว');
      });
      list.appendChild(li);
    });
  }

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const username = $('adminUser').value.trim().toLowerCase();
    const password = $('adminPass').value;
    $('adminPass').value = '';
    const r = await backend.login(username, password).catch(() => ({ error: '' }));
    if (r.error !== undefined) return toast(errText(r.error));
    me = r.me;
    switchTab('dash');
    showPanel(true);
    toast(`ยินดีต้อนรับ ${me.display_name}`);
  });

  $('apLogout').addEventListener('click', async () => {
    await backend.logout().catch(() => {});
    me = null;
    $('adminUser').value = '';
    showPanel(false);
    toast('ออกจากระบบแล้ว');
  });

  document.querySelectorAll('#apTabs button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // ดาวน์โหลดแบบประเมินทั้งหมด (ดาว + ความคิดเห็น + วันเวลา) เป็นไฟล์ Excel — ตัวสร้างไฟล์อยู่ที่ js/excel.js
  $('apExport').addEventListener('click', async () => {
    const btn = $('apExport');
    btn.disabled = true;
    try {
      const items = await backend.comments();
      if (!items.length) { toast('ยังไม่มีแบบประเมินให้ดาวน์โหลด'); return; }
      const name = window.GpaExcel.exportFeedback(items);
      toast(`ดาวน์โหลดแล้ว: ${name}`);
    } catch (e) {
      toast('ดาวน์โหลดไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      btn.disabled = false;
    }
  });

  // ซุปเปอร์แอดมินเพิ่มแอดมินทั่วไป (ไม่จำกัดจำนวน): กดปุ่ม "+ เพิ่มแอดมิน" แล้วกรอกในป๊อปอัป
  $('apAddOpen').addEventListener('click', () => {
    if (!me || me.role !== 'super') return;
    $('apAddForm').reset();
    openModal('addAdminModal');
    $('apNewName').focus();
  });

  $('apAddForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!me || me.role !== 'super') return;
    const err = await backend.addAdmin({
      display_name: $('apNewName').value.trim(),
      username: $('apNewUser').value.trim().toLowerCase(),
      password: $('apNewPass').value,
    });
    if (err) return toast(errText(err));
    const name = $('apNewName').value.trim();
    $('apAddForm').reset();
    closeModal($('addAdminModal'));
    renderAdmins();
    toast(`เพิ่มแอดมิน ${name} แล้ว`);
  });

  // ซุปเปอร์แอดมินเปลี่ยนชื่อที่แสดงของตัวเอง
  $('apNameForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (me.role !== 'super') return;
    const r = await backend.updateMe({ display_name: $('apMyName').value.trim() });
    if (r.error) return toast(errText(r.error));
    me = r.me;
    renderPanel();
    toast('บันทึกชื่อแล้ว');
  });

  // ซุปเปอร์แอดมินเปลี่ยนรหัสผ่านของตัวเอง
  $('apPassForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (me.role !== 'super') return;
    const [oldP, p1, p2] = ['apOldPass', 'apNewPass1', 'apNewPass2'].map(id => $(id).value);
    if (p1 !== p2) return toast('ยืนยันรหัสผ่านไม่ตรงกัน');
    const r = await backend.updateMe({ old_password: oldP, new_password: p1 });
    if (r.error) return toast(errText(r.error));
    me = r.me;
    $('apPassForm').reset();
    toast('เปลี่ยนรหัสผ่านแล้ว');
  });


  /* ---------- 8.1 แบบประเมินเด้งเอง: เปิดเว็บ 1 รอบ = ต้องประเมิน 1 ครั้ง ---------- */
  // เมื่อมี GPA ใหม่แล้ว และผู้ใช้หยุดใช้งานครบ 15 วินาที แบบประเมินเด้งขึ้นเอง ปิดไม่ได้จนกว่าจะส่ง
  // ทุกครั้งที่พิมพ์ คลิก เลือกเกรด กดเพิ่มวิชา หรือเลื่อนหน้า จะนับเวลาใหม่จาก 0 (ยังใช้งานอยู่ = ไม่เด้ง)
  // เด้งครั้งเดียวต่อการเปิดเว็บ 1 รอบ (คำนวณต่อหรือเพิ่มวิชาอีกก็ไม่เด้งซ้ำ) รีเฟรชเว็บแล้วเริ่มนับใหม่
  // ถ้ากดประเมินเองก่อน รอบนั้นก็ไม่เด้งแล้ว

  const RATE_IDLE_MS = 15000;   // ต้องหยุดใช้งานนานเท่านี้ (มิลลิวินาที) แบบประเมินถึงจะเด้ง

  let inviteTimer = null;
  let invited = false;

  function markRated() {
    invited = true;
    clearTimeout(inviteTimer);
  }

  // มีการใช้งานหน้าเว็บ: ถ้ากำลังนับรออยู่ ให้เริ่มนับ 15 วินาทีใหม่
  // (capture: true เพื่อจับการเลื่อนในกล่องรายวิชาด้วย ไม่ใช่แค่เลื่อนทั้งหน้า)
  ['input', 'change', 'click', 'keydown', 'pointerdown', 'touchstart', 'wheel', 'scroll'].forEach(type => {
    document.addEventListener(type, () => {
      if (!inviteTimer || invited) return;
      clearTimeout(inviteTimer);
      inviteTimer = setTimeout(popRating, RATE_IDLE_MS);
    }, { capture: true, passive: true });
  });

  function popRating() {
    // ถ้ามีป๊อปอัปอื่นเปิดอยู่ หรืออยู่หน้าแอดมิน ให้รอแล้วลองใหม่ทุก 2 วินาที
    const anyOpen = [...document.querySelectorAll('.modal-backdrop')].some(m => !m.hidden);
    if (anyOpen || location.hash === '#admin') {
      inviteTimer = setTimeout(popRating, 2000);
      return;
    }
    invited = true;
    $('rateModal').classList.add('auto');   // เด้งเอง: ไม่มีปุ่ม ×
    openModal('rateModal');
  }

  // เรียกจาก calc() ทุกครั้ง: เริ่มนับเมื่อ GPA ใหม่ขึ้นครั้งแรก (หลังจากนั้นการใช้งานจะรีเซ็ตเวลาเอง)
  function maybeInvite(ready) {
    if (!ready || invited || inviteTimer) return;
    inviteTimer = setTimeout(popRating, RATE_IDLE_MS);
  }


  /* ---------- 9. เริ่มทำงาน ---------- */

  // CAX ในระบบทะเบียนแสดงเป็น 21.00 จึงรับจุดทศนิยมได้ (เดิมจุดถูกตัด ทำให้ 21.00 กลายเป็น 2100)
  $('cax').addEventListener('input', calc);
  $('cgx').addEventListener('input', calc);

  // วิชาที่ยังกรอกหน่วยกิตหรือเลือกเกรดไม่ครบ (คืนค่าวิชาแรกที่ยังไม่ครบ)
  function firstIncomplete() {
    for (const r of rows.children) {
      const credits = r.querySelector('.credits');
      const grade = r.querySelector('.grade');
      const missing = [];
      if (!(parseInt(credits.value, 10) > 0)) missing.push(credits);
      if (!grade.value) missing.push(grade);
      if (missing.length) return { row: r, missing };
    }
    return null;
  }

  $('add').addEventListener('click', () => {
    // ต้องกรอกหน่วยกิตและเลือกเกรดของทุกวิชาให้ครบก่อน ถึงจะเพิ่มวิชาใหม่ได้
    const todo = firstIncomplete();
    if (todo) {
      const num = todo.row.querySelector('.c-num b').textContent;
      todo.missing.forEach(f => {
        f.classList.remove('need');
        void f.offsetWidth;   // เริ่มแอนิเมชันสั่นใหม่
        f.classList.add('need');
      });
      todo.row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      todo.missing[0].focus();
      const what = todo.missing.map(f => (f.classList.contains('credits') ? 'หน่วยกิต' : 'เกรด')).join('และ');
      toast(`กรอก${what}ของวิชาที่ ${num} ให้ครบก่อน`);
      return;
    }
    makeRow();
    rows.scrollTop = rows.scrollHeight;   // เลื่อนลงไปที่วิชาที่เพิ่งเพิ่ม
    rows.lastElementChild.querySelector('.code').focus();
    toast('เพิ่มรายวิชาแล้ว');
  });

  $('openNotice').addEventListener('click', () => openModal('noticeModal'));

  updateCount();
  calc();
  showAverage();
  showView();
  detectBackend().then(loadVotes);   // มีฐานข้อมูล → ใช้ฐานข้อมูล / ไม่มี → โหมดตัวอย่าง
  if (location.hash !== '#admin') openModal('noticeModal'); // เด้งเกณฑ์ผลการเรียนตอนเปิดหน้า

})();
