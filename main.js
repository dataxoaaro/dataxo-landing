const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Agent trace: each line is [stage, segments], a segment is [cssClass, text] */
const TRACE = [
    [0, [['t-label', 'request   '], ['', 'handle incoming supplier invoice INV-2847']]],
    [0, [['t-label', 'plan      '], ['', '1  fetch document']]],
    [0, [['', '          2  extract fields']]],
    [0, [['', '          3  match to purchase order']]],
    [0, [['', '          4  post to ERP, checkpoint after each step']]],
    [0, [['', '']]],
    [1, [['t-label', 'tool      '], ['', 'fetch_document(id="INV-2847")']]],
    [1, [['t-ok', '          ok'], ['t-dim', ' · PDF, 2 pages']]],
    [1, [['t-label', 'tool      '], ['', 'extract_fields(doc)']]],
    [1, [['t-dim', '          supplier   '], ['', 'Nordic Steel Oy']]],
    [1, [['t-dim', '          total      '], ['', '12 440,00 EUR']]],
    [1, [['t-dim', '          due        '], ['', '2026-09-09']]],
    [1, [['t-label', 'tool      '], ['', 'match_purchase_order("Nordic Steel Oy")']]],
    [1, [['t-ok', '          ok'], ['t-dim', ' · matched PO-1093']]],
    [1, [['', '']]],
    [2, [['t-label', 'check     '], ['', 'invoice total against PO-1093']]],
    [2, [['t-warn', '          12 440,00 differs from PO total 11 940,00']]],
    [2, [['t-warn', '          flag'], ['t-dim', ' · mismatch on line 3']]],
    [2, [['', '']]],
    [3, [['t-label', 'retry     '], ['', 're-extracting line 3 with table parser']]],
    [3, [['', '          qty 40, was read as 44']]],
    [3, [['', '          corrected total 11 940,00 EUR']]],
    [3, [['t-label', 'check     '], ['t-ok', 'totals reconcile · ok']]],
    [3, [['', '']]],
    [4, [['t-label', 'tool      '], ['', 'post_to_erp(invoice, po="PO-1093")']]],
    [4, [['t-ok', '          ok'], ['t-dim', ' · posted, ref 8812']]],
    [4, [['t-label', 'audit     '], ['', '4 tool calls · 1 self-correction · full log retained']]],
    [4, [['t-ok', 'done      invoice posted and reconciled']]]
];

const lineLength = (segments) => segments.reduce((n, s) => n + s[1].length, 0);
const TOTAL_CHARS = TRACE.reduce((n, line) => n + lineLength(line[1]) + 1, 0);

function renderTrace(charBudget, withCursor) {
    let remaining = charBudget;
    let html = '';
    let stage = 0;
    for (const [lineStage, segments] of TRACE) {
        if (remaining <= 0) break;
        stage = lineStage;
        for (const [cls, text] of segments) {
            if (remaining <= 0) break;
            const shown = text.slice(0, remaining);
            remaining -= text.length;
            html += cls ? `<span class="${cls}">${shown}</span>` : shown;
        }
        if (remaining > 0) {
            html += '\n';
            remaining -= 1;
        }
    }
    if (withCursor && charBudget < TOTAL_CHARS) {
        html += '<span class="cursor"></span>';
    }
    return { html, stage };
}

function initTrace() {
    const track = document.getElementById('traceTrack');
    const body = document.getElementById('terminalBody');
    const captions = Array.from(document.querySelectorAll('.trace-caption'));
    if (!track || !body) return () => {};

    if (reducedMotion) {
        body.innerHTML = renderTrace(TOTAL_CHARS, false).html;
        captions.forEach((c) => c.classList.add('active'));
        return () => {};
    }

    let lastBudget = -1;
    return () => {
        const rect = track.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        const raw = scrollable > 0 ? -rect.top / scrollable : 0;
        const progress = Math.min(1, Math.max(0, (raw - 0.04) / 0.86));
        const budget = Math.round(progress * TOTAL_CHARS);
        if (budget === lastBudget) return;
        lastBudget = budget;

        const { html, stage } = renderTrace(budget, true);
        body.innerHTML = html;
        body.scrollTop = body.scrollHeight;
        const activeStage = budget === 0 ? 0 : stage;
        captions.forEach((c) => {
            c.classList.toggle('active', Number(c.dataset.stage) === activeStage);
        });
    };
}

function initNav() {
    const nav = document.getElementById('topnav');
    const hero = document.querySelector('.hero');
    return () => {
        const threshold = hero.offsetHeight - nav.offsetHeight - 8;
        nav.classList.toggle('scrolled', window.scrollY > threshold);
    };
}

/* The hero skill line collapses to one cycling word. The markup ships the
   full list, so no-JS and reduced-motion readers still see every skill. */
function initKinetic() {
    const host = document.getElementById('heroSkills');
    if (!host || reducedMotion) return;
    const words = Array.from(host.querySelectorAll('span')).map((s) => s.textContent.trim());
    if (words.length < 2) return;

    host.innerHTML = '<span class="kinetic-word"></span>';
    const word = host.firstElementChild;
    word.textContent = words[0];

    let i = 0;
    setInterval(() => {
        word.classList.add('out');
        setTimeout(() => {
            i = (i + 1) % words.length;
            word.textContent = words[i];
            word.classList.remove('out');
        }, 260);
    }, 1500);
}

function initClaims() {
    if (reducedMotion) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            entry.target.classList.toggle('in-focus', entry.isIntersecting);
        });
    }, { rootMargin: '-30% 0px -30% 0px' });
    document.querySelectorAll('.claim').forEach((el) => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
    initClaims();
    initKinetic();

    const frameTasks = [initNav(), initTrace()];
    let ticking = false;
    const onFrame = () => {
        frameTasks.forEach((task) => task());
        ticking = false;
    };
    const requestFrame = () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(onFrame);
        }
    };

    window.addEventListener('scroll', requestFrame, { passive: true });
    window.addEventListener('resize', requestFrame, { passive: true });
    onFrame();
});
