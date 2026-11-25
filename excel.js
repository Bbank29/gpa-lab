/* =========================================================
   ส่งออกแบบประเมินเป็นไฟล์ Excel (.xlsx) — ใช้ในหน้าแอดมิน แท็บ "ความคิดเห็น"
   สร้างไฟล์ในเบราว์เซอร์เลย ไม่ต้องลงไลบรารีเพิ่ม และใช้ได้ทั้งโหมดฐานข้อมูลและโหมดตัวอย่าง
   ได้ 2 ชีต:
     1. สรุป        : จำนวนผู้ประเมิน, คะแนนเฉลี่ย, จำนวนและร้อยละของแต่ละระดับดาว
     2. ความคิดเห็น : ทุกแถวในตาราง feedback (ลำดับ, วันเวลา, คะแนน, ดาว, ความคิดเห็น)
   เรียกใช้: GpaExcel.exportFeedback(items)  (items = [{ stars, comment, created_at }, ...])
   ========================================================= */

window.GpaExcel = (() => {

  /* ---------- 1. ไฟล์ ZIP (xlsx คือไฟล์ zip ที่ข้างในเป็น xml) ---------- */

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // files = [{ name, text }] → Blob ของไฟล์ zip (เก็บแบบไม่บีบอัด Excel เปิดได้ปกติ)
  function zip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    files.forEach(f => {
      const name = enc.encode(f.name);
      const data = enc.encode(f.text);
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);   // ลายเซ็นหัวไฟล์
      local.setUint16(4, 20, true);           // เวอร์ชันที่ต้องใช้
      local.setUint16(6, 0x0800, true);       // ชื่อไฟล์เป็น UTF-8
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      parts.push(local, name, data);

      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, data.length, true);
      cen.setUint32(24, data.length, true);
      cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(cen, name);

      offset += 30 + name.length + data.length;
    });

    const centralSize = central.reduce((a, p) => a + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    return new Blob([...parts, ...central, end],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------- 2. หน้าตาเซลล์ (ฟอนต์ สี เส้นขอบ) ---------- */

  const FONT = 'Tahoma';   // มีทั้ง Windows และ Mac และแสดงภาษาไทยได้
  const BLUE = '1458A8';   // สีเดียวกับหัวข้อในหน้าแอดมิน

  // ลำดับต้องตรงกับเลข s="..." ที่ใช้ในชีต (ดู S ด้านล่าง)
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2">
  <numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/>
  <numFmt numFmtId="165" formatCode="0.0"/>
</numFmts>
<fonts count="7">
  <font><sz val="11"/><color rgb="FF333333"/><name val="${FONT}"/></font>
  <font><b/><sz val="16"/><color rgb="FF${BLUE}"/><name val="${FONT}"/></font>
  <font><sz val="10"/><color rgb="FF7F8FA6"/><name val="${FONT}"/></font>
  <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="${FONT}"/></font>
  <font><sz val="13"/><color rgb="FFE8A600"/><name val="${FONT}"/></font>
  <font><b/><sz val="11"/><color rgb="FF333333"/><name val="${FONT}"/></font>
  <font><b/><sz val="18"/><color rgb="FF${BLUE}"/><name val="${FONT}"/></font>
</fonts>
<fills count="5">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF${BLUE}"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF3F8FE"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFEEF6FD"/></patternFill></fill>
</fills>
<borders count="2">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border>
    <left style="thin"><color rgb="FFD3E2F2"/></left><right style="thin"><color rgb="FFD3E2F2"/></right>
    <top style="thin"><color rgb="FFD3E2F2"/></top><bottom style="thin"><color rgb="FFD3E2F2"/></bottom><diagonal/>
  </border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="19">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  ${rowStyles(0)}
  ${rowStyles(3)}
  <xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
  <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="9" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="165" fontId="6" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  // แถวข้อมูล 5 แบบ (ลำดับ, วันเวลา, คะแนน, ดาว, ความคิดเห็น) — fill 0 = แถวขาว, fill 3 = แถวฟ้าอ่อนสลับ
  function rowStyles(fill) {
    const base = `fillId="${fill}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"`;
    return [
      `<xf numFmtId="0" fontId="0" ${base}><alignment horizontal="center" vertical="center"/></xf>`,
      `<xf numFmtId="164" fontId="0" ${base} applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>`,
      `<xf numFmtId="0" fontId="5" ${base}><alignment horizontal="center" vertical="center"/></xf>`,
      `<xf numFmtId="0" fontId="4" ${base}><alignment horizontal="center" vertical="center"/></xf>`,
      `<xf numFmtId="0" fontId="0" ${base}><alignment vertical="center" wrapText="1"/></xf>`,
    ].join('');
  }

  // เลขสไตล์ (ตำแหน่งใน cellXfs)
  const S = {
    title: 1, sub: 2, head: 3,
    row: [[4, 5, 6, 7, 8], [9, 10, 11, 12, 13]],   // [แถวขาว, แถวสลับ][คอลัมน์]
    label: 14, num: 15, pct: 16, avg: 17, big: 18,
  };

  /* ---------- 3. ตัวช่วยเขียนชีต ---------- */

  const COLS = 'ABCDEFGHIJ';

  function esc(v) {
    return String(v)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')   // ตัวอักษรควบคุมที่ xml ไม่รับ
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // cell(ตำแหน่ง, ค่า, สไตล์) — ตัวเลขเก็บเป็นตัวเลข (เรียง/คำนวณได้), ข้อความเก็บเป็นข้อความ
  function cell(ref, v, s) {
    if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${s}"/>`;
    if (typeof v === 'number') return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }

  function row(r, cells, height) {
    const ht = height ? ` ht="${height}" customHeight="1"` : '';
    return `<row r="${r}"${ht}>${cells.join('')}</row>`;
  }

  function sheet({ widths, rows, merges = [], freezeRow = 0, filter = '' }) {
    const pane = freezeRow
      ? `<pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/>`
      : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.join('')}</sheetData>
${filter ? `<autoFilter ref="${filter}"/>` : ''}
${merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="portrait" fitToHeight="0"/>
</worksheet>`;
  }

  /* ---------- 4. วันเวลา ---------- */

  // ฐานข้อมูลเก็บ "2026-11-19 10:23:44" (เวลาเครื่องเซิร์ฟเวอร์) ส่วนโหมดตัวอย่างเก็บเป็นตัวเลขเวลา
  function toDate(v) {
    const d = typeof v === 'number' ? new Date(v) : new Date(String(v).replace(' ', 'T'));
    return isNaN(d) ? null : d;
  }

  // Excel นับวันจาก 30/12/1899 — ใช้เลขนี้ Excel จะรู้ว่าเป็นวันที่ เรียงและกรองตามวันได้
  function excelDate(d) {
    const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
    return Math.round(((utc - Date.UTC(1899, 11, 30)) / 864e5) * 1e6) / 1e6;
  }

  const pad = n => String(n).padStart(2, '0');

  /* ---------- 5. สร้างไฟล์แบบประเมิน ---------- */

  function buildFeedback(items) {
    const now = new Date();
    const stamp = `ส่งออกเมื่อ ${now.toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}`;
    const list = items
      .map(c => ({ stars: Math.min(5, Math.max(1, +c.stars || 0)), comment: (c.comment || '').trim(), when: toDate(c.created_at) }))
      .sort((a, b) => (b.when || 0) - (a.when || 0));   // ล่าสุดอยู่บน เหมือนหน้าแอดมิน

    // ---- ชีต 1: สรุป ----
    const counts = [0, 0, 0, 0, 0, 0];
    list.forEach(c => counts[c.stars]++);
    const total = list.length;
    const avg = total ? list.reduce((a, c) => a + c.stars, 0) / total : 0;
    const withComment = list.filter(c => c.comment).length;

    const sum = [
      row(1, [cell('A1', 'สรุปแบบประเมินความพึงพอใจ', S.title)], 30),
      row(2, [cell('A2', stamp, S.sub)]),
      row(4, [cell('A4', 'จำนวนผู้ประเมิน', S.label), cell('B4', total, S.big), cell('C4', 'คน', S.num)], 30),
      row(5, [cell('A5', 'คะแนนเฉลี่ย (เต็ม 5)', S.label), cell('B5', total ? Math.round(avg * 10) / 10 : '–', total ? S.avg : S.big),
        cell('C5', total ? '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg)) : '', S.row[0][3])], 30),
      row(6, [cell('A6', 'เขียนความคิดเห็น', S.label), cell('B6', withComment, S.big), cell('C6', 'คน', S.num)], 30),
      row(8, ['ระดับ', 'ดาว', 'จำนวน (คน)', 'ร้อยละ'].map((h, i) => cell(`${COLS[i]}8`, h, S.head)), 26),
    ];
    for (let star = 5, r = 9; star >= 1; star--, r++) {
      sum.push(row(r, [
        cell(`A${r}`, `${star} ดาว`, S.num),
        cell(`B${r}`, '★'.repeat(star) + '☆'.repeat(5 - star), S.row[0][3]),
        cell(`C${r}`, counts[star], S.num),
        cell(`D${r}`, total ? counts[star] / total : 0, S.pct),
      ], 22));
    }

    // ---- ชีต 2: ความคิดเห็นทั้งหมด ----
    const HEAD = 4;   // แถวหัวตาราง
    const det = [
      row(1, [cell('A1', 'รายการแบบประเมินทั้งหมด', S.title)], 30),
      row(2, [cell('A2', `${stamp} · ทั้งหมด ${total.toLocaleString('th-TH')} รายการ (ล่าสุดอยู่บน)`, S.sub)]),
      row(HEAD, ['ลำดับ', 'วันที่ - เวลา', 'คะแนน', 'ดาว', 'ความคิดเห็น'].map((h, i) => cell(`${COLS[i]}${HEAD}`, h, S.head)), 26),
    ];
    list.forEach((c, i) => {
      const r = HEAD + 1 + i;
      const st = S.row[i % 2];
      const text = c.comment || '–';
      // ความสูงแถวตามความยาวข้อความ (คอลัมน์ความคิดเห็นกว้างประมาณ 60 ตัวอักษร)
      const lines = text.split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length / 60)), 0);
      det.push(row(r, [
        cell(`A${r}`, i + 1, st[0]),
        c.when ? cell(`B${r}`, excelDate(c.when), st[1]) : cell(`B${r}`, '–', st[0]),
        cell(`C${r}`, c.stars, st[2]),
        cell(`D${r}`, '★'.repeat(c.stars) + '☆'.repeat(5 - c.stars), st[3]),
        cell(`E${r}`, text, st[4]),
      ], Math.max(22, lines * 17 + 6)));
    });
    const last = HEAD + Math.max(1, list.length);

    const SHEETS = ['สรุป', 'ความคิดเห็น'];
    return zip([
      { name: '[Content_Types].xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>` },
      { name: '_rels/.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
      { name: 'xl/workbook.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView activeTab="1"/></bookViews>
<sheets>${SHEETS.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">'${SHEETS[1]}'!$A$${HEAD}:$E$${last}</definedName></definedNames>
</workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
      { name: 'xl/styles.xml', text: STYLES },
      { name: 'xl/worksheets/sheet1.xml', text: sheet({ widths: [24, 18, 14, 12], rows: sum, merges: ['A1:D1', 'A2:D2'] }) },
      { name: 'xl/worksheets/sheet2.xml', text: sheet({
        widths: [8, 19, 9, 13, 62], rows: det, merges: ['A1:E1', 'A2:E2'],
        freezeRow: HEAD, filter: `A${HEAD}:E${last}`,
      }) },
    ]);
  }

  // สร้างไฟล์แล้วให้เบราว์เซอร์ดาวน์โหลด ชื่อไฟล์เช่น แบบประเมิน_2026-11-19_1430.xlsx
  function exportFeedback(items) {
    const blob = buildFeedback(items);
    const d = new Date();
    const name = `แบบประเมิน_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.xlsx`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return name;
  }

  return { exportFeedback, buildFeedback };
})();
