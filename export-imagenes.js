/* Wake Up · Exportador de comentarios a imagen (historias IG / tarjeta suelta)
   Se usa igual en encuestas.html y panel_encuestas_familias.html.
   Requiere en la página: <div class="export-menu" id="exportMenu"> con 4 <button data-fmt data-theme>.
   Cada página define su propio openExportMenu(evt, id) (una fila) y exportarTodo(evt) (varias),
   que llaman a wuOpenExportMenu(evt, rowInfo) — rowInfo es {grupo,nombre,estrellas,parrafos}
   o, para exportar todo, {bulk:true, rows:[...]}. */

(function () {
  const PALETTE = {
    cyan: '#5DB4C9',
    magenta: '#F11D8C',
    green: '#3ec463',
    gold: '#f5c842',
    ink: '#080808',
  };

  let pendingRow = null;
  let wired = false;

  function getMenu() {
    return document.getElementById('exportMenu');
  }

  // Siempre queda definida, aunque el menú todavía no esté en el DOM
  // (evita el "wuOpenExportMenu is not defined" si algo cambia el orden de carga).
  window.wuOpenExportMenu = function (evt, rowInfo) {
    const menu = getMenu();
    if (!menu) {
      console.warn('[wakeup export] No se encontró <div id="exportMenu"> en esta página.');
      return;
    }
    evt.stopPropagation();
    pendingRow = rowInfo;
    const btn = evt.currentTarget || evt.target;
    const rect = btn.getBoundingClientRect();
    menu.style.top = (window.scrollY + rect.bottom + 6) + 'px';
    let left = window.scrollX + rect.left;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - 210;
    if (left > maxLeft) left = maxLeft;
    menu.style.left = Math.max(8, left) + 'px';
    menu.classList.add('open');

    if (!wired) {
      wired = true;
      menu.addEventListener('click', onMenuClick);
      document.addEventListener('click', (e) => {
        const m = getMenu();
        if (m && !m.contains(e.target)) m.classList.remove('open');
      });
    }
  };

  function onMenuClick(e) {
    const btn = e.target.closest('button[data-fmt]');
    if (!btn || !pendingRow) return;
    getMenu().classList.remove('open');
    if (pendingRow.bulk) {
      downloadBulk(pendingRow.rows, btn.dataset.fmt, btn.dataset.theme);
    } else {
      buildAndDownload(pendingRow, btn.dataset.fmt, btn.dataset.theme);
    }
  }

  function downloadBulk(rows, fmt, theme) {
    if (!rows || !rows.length) return;
    if (typeof showToast === 'function') {
      showToast(`Descargando ${rows.length} imagen${rows.length === 1 ? '' : 'es'}… revisá los permisos de descarga del navegador si te los pide.`);
    }
    let i = 0;
    (function next() {
      if (i >= rows.length) return;
      buildAndDownload(rows[i], fmt, theme);
      i++;
      setTimeout(next, 450);
    })();
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function starsStr(n) {
    n = Number(n) || 0;
    if (!n) return '';
    return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
  }

  function buildAndDownload(row, fmt, theme) {
    const dark = theme === 'dark';
    const accent = row.grupo === 'egresados' ? PALETTE.cyan : PALETTE.magenta;
    const cardBg = dark ? 'rgba(255,255,255,.07)' : 'rgba(8,8,8,.035)';
    const cardBorder = dark ? 'rgba(255,255,255,.16)' : 'rgba(8,8,8,.10)';
    const textMain = dark ? '#f5f7f7' : '#161818';
    const textMuted = dark ? '#9fb0b4' : '#6b7678';

    const canvas = document.createElement('canvas');
    const isHistoria = fmt === 'historia';
    const W = 1080;
    canvas.width = W;
    const ctx = canvas.getContext('2d');

    // paragraphs to render
    const paras = row.parrafos && row.parrafos.length ? row.parrafos : ['(sin comentario)'];

    if (isHistoria) {
      canvas.height = 1920;
      ctx.fillStyle = dark ? PALETTE.ink : '#ffffff';
      ctx.fillRect(0, 0, W, 1920);

      // soft brand blobs
      const blob = (cx, cy, r, color, alpha) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, hexToRgba(color, alpha));
        g.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, 1920);
      };
      blob(160, 220, 620, PALETTE.cyan, dark ? 0.16 : 0.10);
      blob(940, 1700, 620, PALETTE.magenta, dark ? 0.14 : 0.08);

      drawCard(ctx, {
        x: 84, y: 560, w: W - 168,
        accent, cardBg, cardBorder, textMain, textMuted,
        row, paras, dark,
        pad: 64, maxCardHeight: 900,
        big: true,
      });

      // eyebrow + wordmark
      ctx.textAlign = 'center';
      ctx.fillStyle = accent;
      ctx.font = '700 30px Arial, sans-serif';
      ctx.fillText(row.grupo === 'egresados' ? 'VOZ DE UN EGRESADO' : 'VOZ DE UNA FAMILIA', W / 2, 420);

      ctx.fillStyle = textMain;
      ctx.font = '800 54px Arial, sans-serif';
      ctx.fillText('Wake Up Viajes', W / 2, 1830);
    } else {
      // tarjeta suelta: medida al contenido, fondo transparente alrededor
      const pad = 56;
      const cardW = W - 120;
      ctx.font = '500 40px Arial, sans-serif';
      let totalTextH = 0;
      paras.forEach((p, i) => {
        ctx.font = i === 0 ? '500 40px Arial, sans-serif' : 'italic 400 34px Arial, sans-serif';
        const lines = wrapLines(ctx, p, cardW - pad * 2);
        const lh = i === 0 ? 54 : 46;
        totalTextH += lines.length * lh + (i > 0 ? 30 : 0);
      });
      const footH = 90;
      const cardH = pad * 2 + totalTextH + footH + 40;
      canvas.width = W;
      canvas.height = cardH + 120;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawCard(ctx, {
        x: 60, y: 60, w: cardW,
        accent, cardBg: dark ? '#12181a' : '#ffffff', cardBorder, textMain, textMuted,
        row, paras, dark,
        pad, forcedHeight: cardH,
        shadow: true,
      });
    }

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (row.nombre || 'wakeup').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      a.href = url;
      a.download = `wakeup-${row.grupo}-${fmt}-${theme}-${safeName || 'comentario'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  }

  function hexToRgba(hex, alpha) {
    const v = hex.replace('#', '');
    const r = parseInt(v.substring(0, 2), 16);
    const g = parseInt(v.substring(2, 4), 16);
    const b = parseInt(v.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function drawCard(ctx, opts) {
    const { x, y, w, accent, cardBg, cardBorder, textMain, textMuted, row, paras, pad, shadow, big } = opts;

    const innerW = w - pad * 2;
    const blocks = paras.map((p, i) => {
      ctx.font = i === 0
        ? (big ? '600 46px Arial, sans-serif' : '500 40px Arial, sans-serif')
        : (big ? 'italic 400 38px Arial, sans-serif' : 'italic 400 34px Arial, sans-serif');
      const lines = wrapLines(ctx, p, innerW);
      const lh = i === 0 ? (big ? 60 : 54) : (big ? 50 : 46);
      return { lines, lh };
    });
    let textH = 0;
    blocks.forEach((b, i) => { textH += b.lines.length * b.lh + (i > 0 ? 28 : 0); });

    const footH = 92;
    const cardH = opts.forcedHeight ? opts.forcedHeight : Math.min(opts.maxCardHeight || 99999, pad * 2 + 90 + textH + footH);

    if (shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 18;
      ctx.fillStyle = cardBg;
      roundRect(ctx, x, y, w, cardH, 34);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = cardBg;
      roundRect(ctx, x, y, w, cardH, 34);
      ctx.fill();
    }
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, cardH, 34);
    ctx.stroke();

    // accent rail
    ctx.fillStyle = accent;
    roundRect(ctx, x, y, 8, cardH, 4);
    ctx.fill();

    // quote mark
    ctx.textAlign = 'left';
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.font = `800 ${big ? 96 : 80}px Georgia, serif`;
    ctx.fillText('“', x + pad - 6, y + pad + (big ? 40 : 30));
    ctx.globalAlpha = 1;

    // text
    let cy = y + pad + (big ? 96 : 78);
    blocks.forEach((b, i) => {
      ctx.fillStyle = i === 0 ? textMain : textMuted;
      ctx.font = i === 0
        ? (big ? '600 46px Arial, sans-serif' : '500 40px Arial, sans-serif')
        : (big ? 'italic 400 38px Arial, sans-serif' : 'italic 400 34px Arial, sans-serif');
      b.lines.forEach((line) => {
        ctx.fillText(line, x + pad, cy);
        cy += b.lh;
      });
      cy += i === 0 && blocks.length > 1 ? 28 : 0;
    });

    // footer: name + stars + group pill
    const footY = y + cardH - footH / 2 - 8;
    ctx.font = `700 ${big ? 34 : 30}px Arial, sans-serif`;
    ctx.fillStyle = textMain;
    ctx.fillText(row.nombre || 'Wake Up', x + pad, footY);

    if (row.estrellas) {
      ctx.font = `${big ? 30 : 26}px Arial, sans-serif`;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(starsStr(row.estrellas), x + pad, footY + (big ? 42 : 36));
    }

    ctx.textAlign = 'right';
    ctx.font = `700 ${big ? 24 : 22}px Arial, sans-serif`;
    ctx.fillStyle = accent;
    ctx.fillText(row.grupo === 'egresados' ? 'EGRESADO' : 'FAMILIA', x + w - pad, footY);
    ctx.textAlign = 'left';
  }
})();
