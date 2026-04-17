
/*!
 * MDRenderer.js — Self-contained Markdown renderer
 * Automatically loads: KaTeX (math) + highlight.js (code syntax) + mermaid.js (diagrams)
 *
 * Usage:
 *   MDRenderer().load('host-id', markdownString)   → Promise
 *   MDRenderer().load(domElement, markdownString)  → Promise
 *   const html = MDRenderer().toHTML(markdownString) → string (sync)
 *
 * Custom XML blocks supported inside markdown:
 *
 *   <flashcard>
 *     <title>Term</title>
 *     <content>Definition text</content>
 *   </flashcard>
 *
 *   <analogy>
 *     <title>Topic Name</title>
 *     <content>The analogy text here.</content>
 *   </analogy>
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MDRenderer = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {

    /* ══════════════════════════════════════════════════════════════════
       §1  DEPENDENCY LOADER
    ══════════════════════════════════════════════════════════════════ */

    var _depsPromise = null;

    var DEPS = [
        {
            name: 'KaTeX CSS', kind: 'css',
            href: 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css',
            test: function () { return typeof katex !== 'undefined' || !!document.querySelector('link[href*="katex"]'); }
        },
        {
            name: 'KaTeX JS', kind: 'js',
            src: 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js',
            test: function () { return typeof katex !== 'undefined'; }
        },
        {
            name: 'highlight.js CSS', kind: 'css-dual',
            hrefLight: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css',
            hrefDark: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css',
            test: function () { return !!document.querySelector('link[data-md-hljs]'); }
        },
        {
            name: 'highlight.js JS', kind: 'js',
            src: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
            test: function () { return typeof hljs !== 'undefined'; }
        },
        {
            name: 'Mermaid JS', kind: 'js',
            src: 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js',
            test: function () { return typeof mermaid !== 'undefined'; }
        }
    ];

    function _injectCSS(href, media, dataAttr) {
        if (document.querySelector('link[href="' + href + '"]')) return;
        var link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = href;
        if (media) link.media = media;
        if (dataAttr) link.setAttribute('data-md-hljs', dataAttr);
        document.head.appendChild(link);
    }

    function _injectDualThemeCSS(hrefLight, hrefDark) {
        if (document.querySelector('link[data-md-hljs]')) return;
        _injectCSS(hrefLight, '(prefers-color-scheme: light)', 'light');
        _injectCSS(hrefDark, '(prefers-color-scheme: dark)', 'dark');
    }

    function _injectJS(src) {
        return new Promise(function (resolve) {
            if (document.querySelector('script[src="' + src + '"]')) {
                var tries = 0;
                var poll = setInterval(function () {
                    tries++;
                    if (DEPS.find(function (d) { return d.src === src; }).test() || tries > 50) {
                        clearInterval(poll); resolve();
                    }
                }, 50);
                return;
            }
            var s = document.createElement('script');
            s.src = src; s.async = false;
            s.onload = resolve;
            s.onerror = function () {
                console.warn('[MDRenderer] Could not load: ' + src + ' — feature will degrade gracefully.');
                resolve();
            };
            document.head.appendChild(s);
        });
    }

    function _loadAllDeps() {
        if (_depsPromise) return _depsPromise;
        var tasks = [];
        DEPS.forEach(function (dep) {
            if (dep.test()) return;
            if (dep.kind === 'css') { _injectCSS(dep.href); }
            else if (dep.kind === 'css-dual') { _injectDualThemeCSS(dep.hrefLight, dep.hrefDark); }
            else { tasks.push(_injectJS(dep.src)); }
        });
        _depsPromise = tasks.length ? Promise.all(tasks) : Promise.resolve();
        return _depsPromise;
    }

    /* ══════════════════════════════════════════════════════════════════
       §2  HELPERS
    ══════════════════════════════════════════════════════════════════ */

    function slugify(text) {
        return text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    var EMOJI = {
        smile: '😊', laugh: '😂', wink: '😉', heart: '❤️', thumbsup: '👍', thumbsdown: '👎',
        fire: '🔥', star: '⭐', check: '✅', x: '❌', warning: '⚠️', info: 'ℹ️', rocket: '🚀',
        tada: '🎉', clap: '👏', eyes: '👀', bulb: '💡', zap: '⚡', ok: '🆗', cool: '😎',
        thinking: '🤔', sob: '😭', wave: '👋', point_right: '👉', point_left: '👈',
        100: '💯', muscle: '💪', party: '🥳', robot: '🤖', computer: '💻',
    };

    /* ══════════════════════════════════════════════════════════════════
       §3  MATH  (KaTeX when loaded, fallback spans for MathJax)
    ══════════════════════════════════════════════════════════════════ */

    function _inlineMath(expr) {
        if (typeof katex !== 'undefined') {
            try { return katex.renderToString(expr, { throwOnError: false }); } catch (e) { }
        }
        return '<span class="md-math-inline">\\(' + escapeHtml(expr) + '\\)</span>';
    }

    function _blockMath(expr) {
        if (typeof katex !== 'undefined') {
            try {
                return '<div class="md-math-block">'
                    + katex.renderToString(expr.trim(), { throwOnError: false, displayMode: true })
                    + '</div>';
            } catch (e) { }
        }
        return '<div class="md-math-block">\\[' + escapeHtml(expr) + '\\]</div>';
    }

    function _triggerMathJax(el) {
        if (typeof MathJax !== 'undefined') {
            if (MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(console.error);
            else if (MathJax.Hub) MathJax.Hub.Queue(['Typeset', MathJax.Hub, el]);
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       §3.5  MERMAID RENDERING
       Pan/zoom card with no title label. Node width is handled by
       injecting a wider nodeSpacing and wrapping SVG to 'width:auto'.
    ══════════════════════════════════════════════════════════════════ */

    var _mermaidStylesInjected = false;

    function _injectMermaidStyles() {
        if (_mermaidStylesInjected || typeof document === 'undefined') return;
        if (document.getElementById('md-mermaid-styles')) return;

        var s = document.createElement('style');
        s.id = 'md-mermaid-styles';
        s.textContent = [
            /* ── light tokens ── */
            '.md-mermaid-card{',
            '  --mmc-bg:#ffffff;--mmc-bg-canvas:#fafaf8;--mmc-border:#e6e4de;',
            '  --mmc-border-mid:#c8c6c0;--mmc-fg:#242424;--mmc-fg-muted:#6b6b6b;',
            '  --mmc-fg-faint:#9a9a98;--mmc-badge-bg:#f0ede6;--mmc-badge-fg:#6b6b6b;',
            '  --mmc-btn-bg:#f5f4f0;--mmc-btn-hover:#eceae4;--mmc-btn-fg:#6b6b6b;',
            '  --mmc-btn-fg-hover:#242424;--mmc-overlay-bg:rgba(247,247,245,0.92);',
            '}',
            /* ── dark tokens ── */
            '@media(prefers-color-scheme:dark){.md-mermaid-card{',
            '  --mmc-bg:#1c1c1a;--mmc-bg-canvas:#181816;--mmc-border:#2e2e2c;',
            '  --mmc-border-mid:#3e3e3c;--mmc-fg:#e6e6e4;--mmc-fg-muted:#999896;',
            '  --mmc-fg-faint:#555553;--mmc-badge-bg:#2a2a28;--mmc-badge-fg:#888886;',
            '  --mmc-btn-bg:#242422;--mmc-btn-hover:#2e2e2c;--mmc-btn-fg:#888886;',
            '  --mmc-btn-fg-hover:#e6e6e4;--mmc-overlay-bg:rgba(17,17,16,0.92);',
            '}}',
            /* ── card shell — max-width + centered ── */
            '.md-mermaid-card{background:var(--mmc-bg);border:1px solid var(--mmc-border);border-radius:16px;overflow:hidden;font-family:"Source Serif 4",Georgia,serif;max-width:720px;margin-left:auto;margin-right:auto;}',
            /* ── header — badge only, no title span ── */
            '.md-mermaid-header{display:flex;align-items:center;justify-content:space-between;padding:.85rem 1.1rem .8rem;border-bottom:1px solid var(--mmc-border);background:var(--mmc-bg);gap:.6rem;}',
            '.md-mermaid-header-left{display:flex;align-items:center;gap:.55rem;}',
            '.md-mermaid-badge{display:inline-flex;align-items:center;gap:.35rem;background:var(--mmc-badge-bg);border:1px solid var(--mmc-border);border-radius:999px;padding:.22rem .7rem;font-family:"JetBrains Mono",monospace;font-size:.65rem;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:var(--mmc-badge-fg);}',
            /* ── mobile: stack header ── */
            '@media(max-width:520px){.md-mermaid-header{flex-wrap:wrap;padding:.75rem .9rem .7rem;}.md-mermaid-header-left{flex:0 0 100%;width:100%;}.md-mermaid-toolbar{flex:0 0 100%;justify-content:flex-start;padding-left:.05rem;}}',
            /* ── toolbar ── */
            '.md-mermaid-toolbar{display:flex;align-items:center;gap:.3rem;}',
            '.md-mermaid-tool-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;border:1px solid transparent;background:var(--mmc-btn-bg);color:var(--mmc-btn-fg);cursor:pointer;transition:background .15s,color .15s,border-color .15s;}',
            '.md-mermaid-tool-btn:hover{background:var(--mmc-btn-hover);color:var(--mmc-btn-fg-hover);border-color:var(--mmc-border-mid);}',
            '.md-mermaid-tool-btn svg{display:block;}',
            '.md-mermaid-tool-divider{width:1px;height:18px;background:var(--mmc-border);margin:0 .15rem;}',
            /* ── diagram canvas ── */
            '.md-mermaid-canvas{background:var(--mmc-bg-canvas);overflow:hidden;position:relative;cursor:grab;min-height:200px;}',
            '.md-mermaid-canvas.md-mermaid-panning{cursor:grabbing;}',
            '.md-mermaid-inner{transform-origin:0 0;will-change:transform;display:flex;align-items:center;justify-content:center;padding:1.5rem;min-width:100%;min-height:100%;}',
            /* FIX: allow SVG to be its natural width — prevents text clipping in nodes */
            '.md-mermaid-inner svg{max-width:none!important;width:auto!important;height:auto;display:block;}',
            /* ── loading state ── */
            '.md-mermaid-loading{display:flex;align-items:center;justify-content:center;gap:.6rem;padding:3rem 1rem;font-family:"Inter",sans-serif;font-size:.82rem;color:var(--mmc-fg-faint);}',
            '.md-mermaid-loading-spin{width:16px;height:16px;border:2px solid var(--mmc-border-mid);border-top-color:var(--mmc-fg-muted);border-radius:50%;animation:md-mermaid-spin .6s linear infinite;}',
            '@keyframes md-mermaid-spin{to{transform:rotate(360deg);}}',
            /* ── error state ── */
            '.md-mermaid-error{margin:1rem;padding:.85rem 1rem;border-radius:10px;border:1px solid #cc4444;background:#fff4f4;}',
            '.md-mermaid-error-label{font-family:"JetBrains Mono",monospace;font-size:.67rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#9b2222;margin-bottom:.35rem;}',
            '.md-mermaid-error-msg{font-family:"Inter",sans-serif;font-size:.85rem;line-height:1.55;color:#9b2222;}',
            /* ── download dropdown ── */
            '.md-mermaid-dl-wrap{position:relative;display:inline-flex;flex-shrink:0;}',
            '.md-mermaid-dl-menu{position:absolute;top:calc(100% + 6px);right:0;min-width:130px;background:var(--mmc-bg);border:1px solid var(--mmc-border-mid);border-radius:10px;padding:.3rem;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.10),0 1px 4px rgba(0,0,0,.06);}',
            '@media(prefers-color-scheme:dark){.md-mermaid-dl-menu{box-shadow:0 4px 20px rgba(0,0,0,.45),0 1px 6px rgba(0,0,0,.3);}}',
            '.md-mermaid-dl-item{display:flex;align-items:center;gap:.55rem;padding:.48rem .65rem;border-radius:7px;font-family:"Inter",system-ui,sans-serif;font-size:.82rem;font-weight:500;color:var(--mmc-fg-muted);cursor:pointer;transition:background .12s,color .12s;user-select:none;white-space:nowrap;}',
            '.md-mermaid-dl-item:hover{background:var(--mmc-btn-hover);color:var(--mmc-btn-fg-hover);}',
            '.md-mermaid-dl-item svg{flex-shrink:0;}',
            '.md-mermaid-dl-label-sub{font-family:"JetBrains Mono",monospace;font-size:.62rem;color:var(--mmc-fg-faint);margin-left:auto;letter-spacing:.03em;}',
            /* ── fullscreen overlay — overrides card max-width/radius/overflow ── */
            '.md-mermaid-fullscreen-overlay{position:fixed;inset:0;z-index:99999;background:var(--mmc-bg-canvas);display:flex;flex-direction:column;max-width:none!important;width:100vw!important;height:100vh!important;border-radius:0!important;overflow:hidden;border:none!important;margin:0!important;}',
            '.md-mermaid-fs-header{display:flex;align-items:center;justify-content:space-between;padding:.8rem 1.1rem;border-bottom:1px solid var(--mmc-border);background:var(--mmc-bg);flex-shrink:0;}',
            '.md-mermaid-fs-title{font-family:"Inter",sans-serif;font-size:.9rem;font-weight:600;color:var(--mmc-fg);}',
            '.md-mermaid-fs-canvas{flex:1;overflow:hidden;position:relative;cursor:grab;}',
            '.md-mermaid-fs-canvas.md-mermaid-panning{cursor:grabbing;}',
            '.md-mermaid-fs-inner{transform-origin:0 0;will-change:transform;display:flex;align-items:center;justify-content:center;width:100%;height:100%;}',
            '.md-mermaid-fs-inner svg{max-width:none!important;width:auto!important;height:auto;display:block;}',
            '.md-mermaid-fs-toolbar{display:flex;align-items:center;gap:.4rem;position:absolute;bottom:1rem;left:50%;transform:translateX(-50%);background:var(--mmc-bg);border:1px solid var(--mmc-border);border-radius:999px;padding:.4rem .65rem;}',
            '.md-mermaid-fs-zoom-label{font-family:"JetBrains Mono",monospace;font-size:.72rem;color:var(--mmc-fg-faint);min-width:3.5ch;text-align:center;}',
        ].join('\n');
        document.head.appendChild(s);
        _mermaidStylesInjected = true;
    }

    function _isDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function _renderMermaidDiagram(placeholderEl, definition) {
        _injectMermaidStyles();

        if (typeof mermaid === 'undefined') {
            placeholderEl.innerHTML = '<div class="md-mermaid-error"><div class="md-mermaid-error-label">Mermaid not loaded</div><div class="md-mermaid-error-msg">The mermaid.js library failed to load from CDN.</div></div>';
            return Promise.reject(new Error('Mermaid not loaded'));
        }

        var uid = 'md-mermaid-' + Math.random().toString(36).slice(2, 9);
        var isDark = _isDarkMode();

        // Card — header has badge only (no title span per request)
        var card = document.createElement('div');
        card.className = 'md-mermaid-card';
        card.innerHTML = [
            '<div class="md-mermaid-header">',
            '  <div class="md-mermaid-header-left">',
            '    <span class="md-mermaid-badge">Diagram</span>',
            '  </div>',
            '  <div class="md-mermaid-toolbar">',
            '    <button class="md-mermaid-tool-btn md-mermaid-zoom-out" title="Zoom out">',
            '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
            '    </button>',
            '    <button class="md-mermaid-tool-btn md-mermaid-zoom-in" title="Zoom in">',
            '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
            '    </button>',
            '    <button class="md-mermaid-tool-btn md-mermaid-reset" title="Reset view">',
            '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>',
            '    </button>',
            '    <span class="md-mermaid-tool-divider"></span>',
            '    <div class="md-mermaid-dl-wrap" id="' + uid + '_dlwrap">',
            '      <button class="md-mermaid-tool-btn md-mermaid-download" id="' + uid + '_dlbtn" title="Download">',
            '        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
            '      </button>',
            '    </div>',
            '    <button class="md-mermaid-tool-btn md-mermaid-expand" id="' + uid + '_expand" title="Fullscreen">',
            '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
            '    </button>',
            '  </div>',
            '</div>',
            '<div class="md-mermaid-canvas" id="' + uid + '_canvas" style="height:320px">',
            '  <div class="md-mermaid-inner" id="' + uid + '_inner">',
            '    <div class="md-mermaid-loading">',
            '      <span class="md-mermaid-loading-spin"></span> Loading diagram…',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');

        placeholderEl.innerHTML = '';
        placeholderEl.appendChild(card);

        var canvas = card.querySelector('#' + uid + '_canvas');
        var inner = card.querySelector('#' + uid + '_inner');

        // Pan/zoom
        var scale = 1, ox = 0, oy = 0;
        var panning = false, startX = 0, startY = 0, startOx = 0, startOy = 0;
        var MIN = 0.2, MAX = 4;

        function applyTransform() {
            inner.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + scale + ')';
        }
        function zoom(delta) {
            scale = Math.min(MAX, Math.max(MIN, scale * delta));
            applyTransform();
        }

        canvas.addEventListener('wheel', function (e) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 0.91); }, { passive: false });
        canvas.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            panning = true; startX = e.clientX; startY = e.clientY; startOx = ox; startOy = oy;
            canvas.classList.add('md-mermaid-panning');
        });
        window.addEventListener('mousemove', function (e) {
            if (!panning) return;
            ox = startOx + e.clientX - startX; oy = startOy + e.clientY - startY;
            applyTransform();
        });
        window.addEventListener('mouseup', function () { panning = false; canvas.classList.remove('md-mermaid-panning'); });

        card.querySelector('.md-mermaid-zoom-in').addEventListener('click', function () { zoom(1.25); });
        card.querySelector('.md-mermaid-zoom-out').addEventListener('click', function () { zoom(0.8); });
        card.querySelector('.md-mermaid-reset').addEventListener('click', function () { scale = 1; ox = 0; oy = 0; applyTransform(); });

        // Download menu
        card.querySelector('#' + uid + '_dlbtn').addEventListener('click', function (e) {
            e.stopPropagation();
            var existing = card.querySelector('#' + uid + '_dlmenu');
            if (existing) { existing.remove(); return; }
            var wrap = card.querySelector('#' + uid + '_dlwrap');
            var menu = document.createElement('div');
            menu.className = 'md-mermaid-dl-menu'; menu.id = uid + '_dlmenu';
            menu.innerHTML = [
                '<div class="md-mermaid-dl-item" id="' + uid + '_dl_svg">',
                '  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
                '  Download SVG <span class="md-mermaid-dl-label-sub">vector</span>',
                '</div>',
                '<div class="md-mermaid-dl-item" id="' + uid + '_dl_png">',
                '  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
                '  Download PNG <span class="md-mermaid-dl-label-sub">2× retina</span>',
                '</div>'
            ].join('');
            wrap.appendChild(menu);
            menu.querySelector('#' + uid + '_dl_svg').addEventListener('click', function () { menu.remove(); _downloadSVG(inner, wrap.querySelector('#' + uid + '_dlbtn')); });
            menu.querySelector('#' + uid + '_dl_png').addEventListener('click', function () { menu.remove(); _downloadPNG(inner, wrap.querySelector('#' + uid + '_dlbtn')); });
            var outside = function (e) { if (!wrap.contains(e.target)) { menu.remove(); document.removeEventListener('click', outside); } };
            setTimeout(function () { document.addEventListener('click', outside); }, 0);
        });

        // Fullscreen
        card.querySelector('#' + uid + '_expand').addEventListener('click', function () { _openFullscreen(uid, definition, isDark); });

        // Mermaid config — wider node spacing prevents text clipping
        mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'loose',
            fontFamily: '"Inter", "Source Serif 4", sans-serif',
            flowchart: { nodeSpacing: 50, rankSpacing: 60, htmlLabels: true, padding: 18 },
            sequence: { actorMargin: 60, messageMargin: 40 },
        });

        const originalError = console.error;
        console.error = function () { };

        return mermaid.render(uid + '_svg', definition)
            .then(function (result) {
                // restore
                console.error = originalError;

                inner.innerHTML = result.svg;

                var svg = inner.querySelector('svg');

                if (svg) {
                    // Keep natural SVG dimensions so labels are never clipped
                    svg.removeAttribute('width');
                    svg.removeAttribute('height');
                    // Compute canvas height from rendered bounding box
                    requestAnimationFrame(function () {
                        var bbox = svg.getBoundingClientRect();
                        var h = Math.min(Math.max((bbox.height || 240) + 80, 200), 800);
                        canvas.style.height = h + 'px';
                    });
                }
            })
            .catch(function (err) {
                console.error = originalError;

                inner.innerHTML = [
                    '<div class="md-mermaid-error">',
                    '  <div class="md-mermaid-error-label">Diagram unavailable</div>',
                    '  <div class="md-mermaid-error-msg">This diagram could not be loaded.</div>',
                    '</div>'
                ].join('');
            });
    }

    function _cloneSVG(innerEl) {
        var svgEl = innerEl.querySelector('svg');
        if (!svgEl) return null;
        var clone = svgEl.cloneNode(true);
        var bbox = svgEl.getBoundingClientRect();
        if (bbox.width) clone.setAttribute('width', Math.round(bbox.width));
        if (bbox.height) clone.setAttribute('height', Math.round(bbox.height));
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return { clone: clone, W: Math.round(bbox.width || 800), H: Math.round(bbox.height || 600) };
    }

    function _flashOK(btn, prevHTML) {
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        btn.style.color = '#3a9c3a';
        setTimeout(function () { btn.innerHTML = prevHTML; btn.style.color = ''; btn.disabled = false; }, 1400);
    }

    function _triggerDownload(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
    }

    function _downloadSVG(innerEl, btn) {
        var res = _cloneSVG(innerEl); if (!res) return;
        var prev = btn.innerHTML; btn.disabled = true;
        _triggerDownload(new Blob([new XMLSerializer().serializeToString(res.clone)], { type: 'image/svg+xml;charset=utf-8' }), 'diagram.svg');
        _flashOK(btn, prev);
    }

    function _downloadPNG(innerEl, btn) {
        var res = _cloneSVG(innerEl); if (!res) return;
        var prev = btn.innerHTML; btn.disabled = true;
        var SCALE = 2;
        var styleText = '';
        document.querySelectorAll('style').forEach(function (s) { styleText += s.textContent + '\n'; });
        styleText = styleText.replace(/@font-face\s*\{[^}]*src:[^}]*url\(["']?https?:[^)]+["']?\)[^}]*\}/gi, '');
        var styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleEl.textContent = styleText;
        res.clone.insertBefore(styleEl, res.clone.firstChild);
        var svgStr = new XMLSerializer().serializeToString(res.clone);
        var dataURI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
        var img = new Image();
        img.onload = function () {
            var canvas = document.createElement('canvas');
            canvas.width = res.W * SCALE; canvas.height = res.H * SCALE;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(SCALE, SCALE); ctx.drawImage(img, 0, 0, res.W, res.H);
            try {
                canvas.toBlob(function (blob) { _triggerDownload(blob, 'diagram.png'); _flashOK(btn, prev); }, 'image/png');
            } catch (e) {
                var svgBlob = new Blob([new XMLSerializer().serializeToString(res.clone)], { type: 'image/svg+xml;charset=utf-8' });
                _triggerDownload(svgBlob, 'diagram.svg'); _flashOK(btn, prev);
            }
        };
        img.onerror = function () { btn.disabled = false; };
        img.src = dataURI;
    }

    function _openFullscreen(uid, definition, isDark) {
        var overlay = document.createElement('div');
        overlay.className = 'md-mermaid-card md-mermaid-fullscreen-overlay';
        overlay.innerHTML = [
            '<div class="md-mermaid-fs-header">',
            '  <span class="md-mermaid-fs-title">Diagram</span>',
            '  <button class="md-mermaid-tool-btn" id="' + uid + '_close" title="Close">',
            '    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            '  </button>',
            '</div>',
            '<div class="md-mermaid-fs-canvas" id="' + uid + '_fscanvas">',
            '  <div class="md-mermaid-fs-inner" id="' + uid + '_fsinner">',
            '    <div class="md-mermaid-loading"><span class="md-mermaid-loading-spin"></span> Rendering…</div>',
            '  </div>',
            '  <div class="md-mermaid-fs-toolbar">',
            '    <button class="md-mermaid-tool-btn" id="' + uid + '_fszout" title="Zoom out"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>',
            '    <span class="md-mermaid-fs-zoom-label" id="' + uid + '_fszlbl">100%</span>',
            '    <button class="md-mermaid-tool-btn" id="' + uid + '_fszin" title="Zoom in"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>',
            '    <span style="width:1px;height:16px;background:var(--mmc-border);margin:0 .2rem"></span>',
            '    <button class="md-mermaid-tool-btn" id="' + uid + '_fsreset" title="Reset"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg></button>',
            '  </div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);

        var fsCanvas = overlay.querySelector('#' + uid + '_fscanvas');
        var fsInner = overlay.querySelector('#' + uid + '_fsinner');
        var fsScale = 1, fsOx = 0, fsOy = 0;
        var fsPanning = false, fsStartX = 0, fsStartY = 0, fsStartOx = 0, fsStartOy = 0;

        function fsApplyTransform() { fsInner.style.transform = 'translate(' + fsOx + 'px,' + fsOy + 'px) scale(' + fsScale + ')'; }
        function fsZoom(delta) {
            fsScale = Math.min(4, Math.max(0.2, fsScale * delta));
            fsApplyTransform();
            var lbl = overlay.querySelector('#' + uid + '_fszlbl');
            if (lbl) lbl.textContent = Math.round(fsScale * 100) + '%';
        }

        fsCanvas.addEventListener('wheel', function (e) { e.preventDefault(); fsZoom(e.deltaY < 0 ? 1.1 : 0.91); }, { passive: false });
        fsCanvas.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            fsPanning = true; fsStartX = e.clientX; fsStartY = e.clientY; fsStartOx = fsOx; fsStartOy = fsOy;
            fsCanvas.classList.add('md-mermaid-panning');
        });
        window.addEventListener('mousemove', function (e) {
            if (!fsPanning) return;
            fsOx = fsStartOx + e.clientX - fsStartX; fsOy = fsStartOy + e.clientY - fsStartY;
            fsApplyTransform();
        });
        window.addEventListener('mouseup', function () { fsPanning = false; fsCanvas.classList.remove('md-mermaid-panning'); });

        overlay.querySelector('#' + uid + '_fszin').addEventListener('click', function () { fsZoom(1.25); });
        overlay.querySelector('#' + uid + '_fszout').addEventListener('click', function () { fsZoom(0.8); });
        overlay.querySelector('#' + uid + '_fsreset').addEventListener('click', function () { fsScale = 1; fsOx = 0; fsOy = 0; fsApplyTransform(); });
        overlay.querySelector('#' + uid + '_close').addEventListener('click', function () {
            overlay.style.transition = 'opacity .18s,transform .18s';
            overlay.style.opacity = '0'; overlay.style.transform = 'scale(.98)';
            setTimeout(function () { overlay.remove(); }, 200);
        });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { overlay.querySelector('#' + uid + '_close').click(); document.removeEventListener('keydown', esc); }
        });

        mermaid.initialize({
            startOnLoad: false, suppressErrorRendering: true, theme: isDark ? 'dark' : 'default', securityLevel: 'loose',
            fontFamily: '"Inter","Source Serif 4",sans-serif',
            flowchart: { nodeSpacing: 50, rankSpacing: 60, htmlLabels: true, padding: 18 },
        });
        mermaid.render(uid + '_fs_svg', definition).then(function (result) {
            fsInner.innerHTML = result.svg;
            var svg = fsInner.querySelector('svg');
            if (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); }
        }).catch(function () { });
    }

    function _renderAllMermaidDiagrams(el) {
        var placeholders = el.querySelectorAll('.md-mermaid-placeholder');
        if (!placeholders.length) return Promise.resolve();
        var promises = [];
        placeholders.forEach(function (ph) {
            var def = ph.getAttribute('data-md-mermaid');
            if (def) promises.push(_renderMermaidDiagram(ph, def));
        });
        return Promise.all(promises);
    }

    /* ══════════════════════════════════════════════════════════════════
       §3.6  ANALOGY CALLOUT COMPONENT  (integrated from cpa.js)
    ══════════════════════════════════════════════════════════════════ */

    var _acStylesInjected = false;

    function _injectAnalogyStyles() {
        if (_acStylesInjected || document.getElementById('ac-styles')) return;
        var s = document.createElement('style');
        s.id = 'ac-styles';
        s.textContent = `
        .ac-callout{--ac-bg:#ffffff;--ac-border:#e6e4de;--ac-fg:#242424;--ac-fg-muted:#6b6b6b;--ac-fg-faint:#9a9a98;--ac-badge-bg:#f0ede6;--ac-badge-fg:#6b6b6b;--ac-icon-bg:#f5f4f0;--ac-icon-stroke:#242424;--ac-rule:#e6e4de;--ac-quote-mark:#e0ddd6;}
        @media(prefers-color-scheme:dark){.ac-callout{--ac-bg:#1c1c1a;--ac-border:#2e2e2c;--ac-fg:#e6e6e4;--ac-fg-muted:#999896;--ac-fg-faint:#555553;--ac-badge-bg:#2a2a28;--ac-badge-fg:#888886;--ac-icon-bg:#242422;--ac-icon-stroke:#e6e6e4;--ac-rule:#2e2e2c;--ac-quote-mark:#2e2e2c;}}
        .ac-callout{background:var(--ac-bg);border:1px solid var(--ac-border);border-radius:16px;padding:1.75rem 2rem 1.85rem;font-family:'Source Serif 4',Georgia,serif;position:relative;overflow:hidden;margin:1.5em auto;max-width:600px;width:100%;box-sizing:border-box;}
        .ac-callout::before{content:'\u201C';position:absolute;top:-.35rem;right:1.5rem;font-family:'Playfair Display',Georgia,serif;font-size:7rem;font-weight:800;line-height:1;color:var(--ac-quote-mark);pointer-events:none;user-select:none;z-index:0;}
        .ac-header{display:flex;align-items:center;gap:.85rem;margin-bottom:1.15rem;position:relative;z-index:1;}
        .ac-icon{width:40px;height:40px;border-radius:50%;background:var(--ac-icon-bg);border:1px solid var(--ac-border);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .ac-icon svg{display:block;}
        .ac-header-text{display:flex;flex-direction:column;gap:.18rem;}
        .ac-eyebrow{font-family:'JetBrains Mono',monospace;font-size:.66rem;font-weight:500;letter-spacing:.09em;text-transform:uppercase;color:var(--ac-fg-faint);}
        .ac-topic{font-family:'Playfair Display',Georgia,serif;font-size:1.15rem;font-weight:700;color:var(--ac-fg);line-height:1.25;letter-spacing:-.015em;}
        .ac-rule{border:none;border-top:1px solid var(--ac-rule);margin:0 0 1.1rem;position:relative;z-index:1;}
        .ac-body{font-family:'Source Serif 4',Georgia,serif;font-size:1.05rem;line-height:1.75;color:var(--ac-fg-muted);font-style:italic;position:relative;z-index:1;margin:0;}
        .ac-body strong{font-style:normal;font-weight:600;color:var(--ac-fg);}
        .ac-callout{animation:ac-enter .35s cubic-bezier(.22,1,.36,1) both;}
        @keyframes ac-enter{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        `;
        document.head.appendChild(s);
        _acStylesInjected = true;
    }

    function _svgBulb() {
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ac-icon-stroke)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6-.4.3-.7.7-.7 1.2V17H9v-.8c0-.5-.3-.9-.7-1.2A7 7 0 0 1 12 2z"/></svg>';
    }

    function _highlightAnalogyTerms(text, topic) {
        var terms = topic.split(/\s+/).filter(function (w) { return w.length > 3; });
        if (!terms.length) return text;
        var pattern = new RegExp('\\b(' + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\b', 'gi');
        return text.replace(pattern, '<strong>$1</strong>');
    }

    function _renderAnalogyCallout(el, topic, content) {
        _injectAnalogyStyles();
        var callout = document.createElement('div');
        callout.className = 'ac-callout';
        callout.innerHTML =
            '<div class="ac-header">' +
            '  <div class="ac-icon">' + _svgBulb() + '</div>' +
            '  <div class="ac-header-text">' +
            '    <span class="ac-eyebrow">Analogy</span>' +
            '    <span class="ac-topic">' + escapeHtml(topic) + '</span>' +
            '  </div>' +
            '</div>' +
            '<hr class="ac-rule">' +
            '<p class="ac-body">' + _highlightAnalogyTerms(content, topic) + '</p>';
        el.appendChild(callout);
    }

    /* ══════════════════════════════════════════════════════════════════
       §3.7  FLASHCARD COMPONENT  (integrated from cpa.js)
    ══════════════════════════════════════════════════════════════════ */

    var _fcStylesInjected = false;

    function _injectFlashcardStyles() {
        if (_fcStylesInjected || document.getElementById('fc-styles')) return;
        var s = document.createElement('style');
        s.id = 'fc-styles';
        s.textContent = `
        .fc-wrap{--fc-bg:#ffffff;--fc-bg-back:#f5f4f0;--fc-border:#e6e4de;--fc-border-mid:#c8c6c0;--fc-fg:#242424;--fc-fg-muted:#6b6b6b;--fc-fg-faint:#9a9a98;--fc-badge-bg:#f0ede6;--fc-badge-fg:#6b6b6b;--fc-btn-bg:#242424;--fc-btn-fg:#ffffff;--fc-btn-hover:#3a3a3a;--fc-hint-fg:#b0aea8;--fc-front-label:#9a9a98;--fc-back-label:#6b6b6b;--fc-shine:rgba(255,255,255,0.06);}
        @media(prefers-color-scheme:dark){.fc-wrap{--fc-bg:#1c1c1a;--fc-bg-back:#242422;--fc-border:#2e2e2c;--fc-border-mid:#3e3e3c;--fc-fg:#e6e6e4;--fc-fg-muted:#999896;--fc-fg-faint:#666664;--fc-badge-bg:#2a2a28;--fc-badge-fg:#888886;--fc-btn-bg:#e6e6e4;--fc-btn-fg:#1c1c1a;--fc-btn-hover:#ffffff;--fc-hint-fg:#444442;--fc-front-label:#555553;--fc-back-label:#888886;--fc-shine:rgba(255,255,255,0.03);}}
        /* ── outer wrapper: max-width + centered ── */
        .fc-wrap{font-family:'Source Serif 4',Georgia,serif;display:flex;flex-direction:column;align-items:center;gap:1.25rem;margin:1.5em auto;max-width:600px;width:100%;}
        .fc-badge{display:inline-flex;align-items:center;gap:.4rem;background:var(--fc-badge-bg);border:1px solid var(--fc-border);border-radius:999px;padding:.28rem .8rem;font-family:'JetBrains Mono',monospace;font-size:.68rem;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:var(--fc-badge-fg);align-self:flex-start;}
        .fc-badge-dot{width:6px;height:6px;border-radius:50%;background:var(--fc-fg-faint);}
        /* ── 3-D scene: no fixed height — grows with content ── */
        .fc-scene{width:100%;perspective:1200px;cursor:pointer;}
        /* ── card: relative so it grows; faces are stacked via grid ── */
        .fc-card{
          width:100%;position:relative;
          transform-style:preserve-3d;
          transition:transform .55s cubic-bezier(.45,.05,.55,.95);
          border-radius:16px;
        }
        .fc-card.fc-flipped{transform:rotateY(180deg);}
        /* ── faces: absolute, full coverage, content scrollable ── */
        .fc-face{
          position:absolute;inset:0;
          border-radius:16px;
          border:1px solid var(--fc-border);
          backface-visibility:hidden;-webkit-backface-visibility:hidden;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          padding:3rem 2rem 2.5rem;
          gap:.85rem;
          overflow-y:auto;
          box-sizing:border-box;
        }
        /* Shine line at top edge */
        .fc-face::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:var(--fc-shine);border-radius:16px 16px 0 0;pointer-events:none;}
        /* ── invisible sizer face — drives the card's height ──
           It mirrors the back content so the card is always tall enough */
        .fc-sizer{
          position:relative!important;
          inset:auto!important;
          visibility:hidden;
          pointer-events:none;
          border:none!important;
          background:transparent!important;
          padding:3rem 2rem 2.5rem;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:.85rem;
          min-height:220px;
          width:100%;
          box-sizing:border-box;
        }
        .fc-front{background:var(--fc-bg);}
        .fc-face-label{font-family:'JetBrains Mono',monospace;font-size:.67rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--fc-front-label);position:absolute;top:1rem;left:1.4rem;}
        .fc-front-term{font-family:'Playfair Display',Georgia,serif;font-size:clamp(1.4rem,4.5vw,2.2rem);font-weight:700;color:var(--fc-fg);line-height:1.25;letter-spacing:-.02em;text-align:center;word-break:break-word;}
        .fc-flip-hint{display:flex;align-items:center;gap:.35rem;font-family:'Inter',sans-serif;font-size:.72rem;font-weight:500;color:var(--fc-hint-fg);letter-spacing:.02em;transition:color .2s;user-select:none;margin-top:.5rem;}
        .fc-scene:hover .fc-flip-hint{color:var(--fc-fg-faint);}
        .fc-flip-hint svg{animation:fc-pulse 2.2s ease-in-out infinite;}
        @keyframes fc-pulse{0%,100%{opacity:.5;transform:scale(1);}50%{opacity:1;transform:scale(1.12);}}
        .fc-back{background:var(--fc-bg-back);transform:rotateY(180deg);}
        .fc-back .fc-face-label{color:var(--fc-back-label);}
        .fc-back-def{font-family:'Source Serif 4',Georgia,serif;font-size:clamp(.9rem,2.5vw,1.1rem);font-weight:400;color:var(--fc-fg);line-height:1.75;text-align:center;max-width:40ch;margin:0;word-break:break-word;}
        .fc-controls{display:flex;align-items:center;justify-content:space-between;width:100%;gap:.75rem;}
        .fc-counter{font-family:'JetBrains Mono',monospace;font-size:.75rem;font-weight:500;color:var(--fc-fg-faint);letter-spacing:.04em;min-width:3ch;}
        .fc-dots{display:flex;gap:.4rem;align-items:center;flex:1;justify-content:center;}
        .fc-dot{width:6px;height:6px;border-radius:50%;background:var(--fc-border-mid);transition:background .25s,transform .25s;}
        .fc-dot.fc-dot-active{background:var(--fc-fg);transform:scale(1.25);}
        .fc-dot.fc-dot-seen{background:var(--fc-fg-muted);}
        .fc-btn{display:inline-flex;align-items:center;gap:.45rem;padding:.62rem 1.1rem;border:1.5px solid var(--fc-btn-bg);border-radius:999px;background:var(--fc-btn-bg);color:var(--fc-btn-fg);font-family:'Inter',system-ui,sans-serif;font-size:.82rem;font-weight:600;letter-spacing:.01em;cursor:pointer;transition:background .16s,border-color .16s,transform .12s;white-space:nowrap;}
        .fc-btn:hover{background:var(--fc-btn-hover);border-color:var(--fc-btn-hover);transform:translateY(-1px);}
        .fc-btn:active{transform:translateY(0);}
        .fc-btn svg{flex-shrink:0;}
        @keyframes fc-ripple{from{opacity:.25;transform:scale(0);}to{opacity:0;transform:scale(3);}}
        .fc-ripple{position:absolute;width:60px;height:60px;border-radius:50%;background:var(--fc-fg);pointer-events:none;animation:fc-ripple .5s ease-out forwards;transform-origin:center;margin-left:-30px;margin-top:-30px;}
        `;
        document.head.appendChild(s);
        _fcStylesInjected = true;
    }

    function _svgFlip() {
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>';
    }

    function _svgTap() {
        return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><polyline points="12 6 12 12 16 14"/></svg>';
    }

    function _renderFlashcard(el, cards) {
        _injectFlashcardStyles();
        var uid = 'fc_' + Math.random().toString(36).slice(2, 9);
        var current = 0, flipped = false;
        var seen = {};

        var wrap = document.createElement('div');
        wrap.className = 'fc-wrap';
        wrap.innerHTML =
            '<div class="fc-badge"><span class="fc-badge-dot"></span>Flashcard</div>' +
            '<div class="fc-scene" id="' + uid + '_scene" role="button" aria-label="Flashcard — click to flip" tabindex="0">' +
            '  <div class="fc-card" id="' + uid + '_card">' +
            /* Invisible sizer — holds both front term + back def so card is always tall enough for both */
            '    <div class="fc-sizer" aria-hidden="true">' +
            '      <span class="fc-face-label" style="position:static;margin-bottom:.25rem">‌</span>' +
            '      <span class="fc-front-term" id="' + uid + '_sizer_term" style="visibility:hidden"></span>' +
            '      <p class="fc-back-def" id="' + uid + '_sizer_def" style="visibility:hidden"></p>' +
            '      <span class="fc-flip-hint" style="visibility:hidden">tap to reveal</span>' +
            '    </div>' +
            '    <div class="fc-face fc-front" id="' + uid + '_front">' +
            '      <span class="fc-face-label">Term</span>' +
            '      <span class="fc-front-term" id="' + uid + '_term"></span>' +
            '      <span class="fc-flip-hint">' + _svgTap() + ' tap to reveal</span>' +
            '    </div>' +
            '    <div class="fc-face fc-back" id="' + uid + '_back">' +
            '      <span class="fc-face-label">Definition</span>' +
            '      <p class="fc-back-def" id="' + uid + '_def"></p>' +
            '    </div>' +
            '  </div>' +
            '</div>' +
            '<div class="fc-controls">' +
            '  <span class="fc-counter" id="' + uid + '_counter"></span>' +
            '  <div class="fc-dots" id="' + uid + '_dots"></div>' +
            '  <button class="fc-btn" id="' + uid + '_btn">' + _svgFlip() + ' Flip</button>' +
            '</div>';
        el.appendChild(wrap);

        var scene = wrap.querySelector('#' + uid + '_scene');
        var card = wrap.querySelector('#' + uid + '_card');
        var termEl = wrap.querySelector('#' + uid + '_term');
        var defEl = wrap.querySelector('#' + uid + '_def');
        var sizerTerm = wrap.querySelector('#' + uid + '_sizer_term');
        var sizerDef = wrap.querySelector('#' + uid + '_sizer_def');
        var counter = wrap.querySelector('#' + uid + '_counter');
        var dotsEl = wrap.querySelector('#' + uid + '_dots');
        var btn = wrap.querySelector('#' + uid + '_btn');

        function renderDots() {
            dotsEl.innerHTML = cards.map(function (_, i) {
                var cls = 'fc-dot' + (i === current ? ' fc-dot-active' : seen[i] ? ' fc-dot-seen' : '');
                return '<span class="' + cls + '"></span>';
            }).join('');
        }

        function renderCard(idx, animate) {
            var c = cards[idx];
            termEl.textContent = c.frontText;
            defEl.textContent = c.backText;
            // Keep sizer in sync so card height fits both sides
            if (sizerTerm) sizerTerm.textContent = c.frontText;
            if (sizerDef) sizerDef.textContent = c.backText;
            counter.textContent = cards.length > 1 ? (idx + 1) + ' / ' + cards.length : '';
            renderDots();
            if (animate) {
                card.style.transition = 'none';
                card.style.transform = 'rotateY(90deg) scale(.96)';
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        card.style.transition = '';
                        card.style.transform = flipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
                    });
                });
            }
        }

        function doFlip(e) {
            if (e && e.clientX) {
                var rect = scene.getBoundingClientRect();
                var rip = document.createElement('span');
                rip.className = 'fc-ripple';
                rip.style.left = (e.clientX - rect.left) + 'px';
                rip.style.top = (e.clientY - rect.top) + 'px';
                scene.appendChild(rip);
                rip.addEventListener('animationend', function () { rip.remove(); });
            }
            flipped = !flipped;
            card.classList.toggle('fc-flipped', flipped);
            seen[current] = true;
            renderDots();
            btn.innerHTML = (flipped ? _svgFlip() + ' Unflip' : _svgFlip() + ' Flip');
        }

        scene.addEventListener('click', doFlip);
        scene.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doFlip(null); } });
        btn.addEventListener('click', function (e) { e.stopPropagation(); doFlip(null); });

        if (cards.length > 1) {
            var touchX = null;
            scene.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
            scene.addEventListener('touchend', function (e) {
                if (touchX === null) return;
                var dx = e.changedTouches[0].clientX - touchX; touchX = null;
                if (Math.abs(dx) < 40) return;
                if (dx < 0 && current < cards.length - 1) { seen[current] = true; current++; flipped = false; card.classList.remove('fc-flipped'); renderCard(current, true); }
                if (dx > 0 && current > 0) { current--; flipped = false; card.classList.remove('fc-flipped'); renderCard(current, true); }
            }, { passive: true });
        }

        renderCard(0, false);
    }

    /* ══════════════════════════════════════════════════════════════════
       §3.8  CUSTOM XML BLOCK RENDERING
       Scans the rendered host element for placeholder divs injected by
       the parser for <flashcard> and <analogy> blocks, then hydrates
       them into live components.
    ══════════════════════════════════════════════════════════════════ */

    function _renderCustomBlocks(el) {
        // Analogy placeholders
        el.querySelectorAll('.md-analogy-placeholder').forEach(function (ph) {
            var topic = ph.getAttribute('data-ac-topic') || '';
            var content = ph.getAttribute('data-ac-content') || '';
            ph.removeAttribute('class');
            _renderAnalogyCallout(ph, topic, content);
        });

        // Flashcard placeholders — grouped by deck-id so multiple cards share one deck
        var decks = {};
        el.querySelectorAll('.md-flashcard-placeholder').forEach(function (ph) {
            var deckId = ph.getAttribute('data-fc-deck') || ph.id;
            var front = ph.getAttribute('data-fc-front') || '';
            var back = ph.getAttribute('data-fc-back') || '';
            if (!decks[deckId]) decks[deckId] = { el: ph, cards: [] };
            decks[deckId].cards.push({ frontText: front, backText: back });
        });

        Object.keys(decks).forEach(function (id) {
            var deck = decks[id];
            deck.el.removeAttribute('class');
            _renderFlashcard(deck.el, deck.cards);
            // Hide any extra placeholder siblings that belong to the same deck
            el.querySelectorAll('.md-flashcard-placeholder[data-fc-deck="' + id + '"]').forEach(function (extra) {
                extra.style.display = 'none';
            });
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       §4  CODE BLOCKS
    ══════════════════════════════════════════════════════════════════ */

    function _codeBlock(code, lang) {
        var highlighted = escapeHtml(code);
        if (lang && typeof hljs !== 'undefined') {
            try {
                var res = hljs.getLanguage(lang)
                    ? hljs.highlight(code, { language: lang })
                    : hljs.highlightAuto(code);
                highlighted = res.value;
            } catch (e) { }
        }

        var langLabel = lang
            ? '<span class="md-code-lang">' + escapeHtml(lang) + '</span>'
            : '<span class="md-code-lang"></span>';

        var collapseBtn = '<button class="md-code-collapse" title="Collapse"'
            + ' onclick="(function(b){'
            + 'var blk=b.closest(\'.md-code-block\');var pre=blk.querySelector(\'pre\');'
            + 'var collapsed=blk.getAttribute(\'data-collapsed\')==\'1\';'
            + 'if(collapsed){pre.style.display=\'\';blk.removeAttribute(\'data-collapsed\');b.innerHTML=\'&#x2715;\';b.title=\'Collapse\';}'
            + 'else{pre.style.display=\'none\';blk.setAttribute(\'data-collapsed\',\'1\');b.innerHTML=\'&#x2195;\';b.title=\'Expand\';}'
            + '})(this)">\u00d7</button>';

        var copyBtn = '<button class="md-copy-btn" title="Copy"'
            + ' onclick="(function(b){'
            + 'var t=b.closest(\'.md-code-block\').querySelector(\'code\').innerText;'
            + 'navigator.clipboard.writeText(t).then(function(){'
            + 'var lb=b.querySelector(\'.md-copy-label\');lb.textContent=\'Copied!\';'
            + 'setTimeout(function(){lb.textContent=\'Copy\';},1500);});'
            + '})(this)">'
            + '<svg class="md-copy-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
            + '<span class="md-copy-label">Copy</span>'
            + '</button>';

        return '<div class="md-code-block">'
            + '<div class="md-code-header">'
            + langLabel
            + '<div class="md-code-actions">' + collapseBtn + copyBtn + '</div>'
            + '</div>'
            + '<pre><code class="md-code' + (lang ? ' language-' + escapeHtml(lang) : '') + '">'
            + highlighted
            + '</code></pre>'
            + '</div>';
    }

    /* ══════════════════════════════════════════════════════════════════
       §5  INLINE PARSER
    ══════════════════════════════════════════════════════════════════ */

    function parseInline(text) {
        var codeSlots = [];
        text = text.replace(/`([^`]+)`/g, function (_, code) {
            var i = codeSlots.length;
            codeSlots.push('<code class="md-inline-code">' + escapeHtml(code) + '</code>');
            return '\x00C' + i + '\x00';
        });

        var mathSlots = [];
        text = text.replace(/\$([^$\n]+?)\$/g, function (_, expr) {
            var i = mathSlots.length;
            mathSlots.push(_inlineMath(expr));
            return '\x00M' + i + '\x00';
        });

        text = text.replace(/!\[([^\]]*)\]\(([^)]+?)(?:\s+"([^"]*)")?\)/g,
            function (_, alt, src, title) {
                return '<img class="md-img" src="' + src + '" alt="' + escapeHtml(alt) + '"'
                    + (title ? ' title="' + escapeHtml(title) + '"' : '') + ' loading="lazy">';
            });

        text = text.replace(/\[([^\]]+)\]\(([^)]+?)(?:\s+"([^"]*)")?\)/g,
            function (_, label, href, title) {
                return '<a class="md-link" href="' + href + '"'
                    + (title ? ' title="' + escapeHtml(title) + '"' : '')
                    + ' target="_blank" rel="noopener">' + parseInline(label) + '</a>';
            });

        text = text.replace(/(?<![="'])https?:\/\/[^\s<>"']+/g, function (url) {
            return '<a class="md-link md-autolink" href="' + url + '" target="_blank" rel="noopener">' + url + '</a>';
        });

        text = text.replace(/(\*\*\*|___)(.+?)\1/g, function (_, __, t) { return '<strong><em>' + parseInline(t) + '</em></strong>'; });
        text = text.replace(/(\*\*|__)(.+?)\1/g, function (_, __, t) { return '<strong>' + parseInline(t) + '</strong>'; });
        text = text.replace(/(\*|_)(.+?)\1/g, function (_, __, t) { return '<em>' + parseInline(t) + '</em>'; });
        text = text.replace(/~~(.+?)~~/g, function (_, t) { return '<del>' + parseInline(t) + '</del>'; });
        text = text.replace(/==(.+?)==/g, function (_, t) { return '<mark class="md-highlight">' + parseInline(t) + '</mark>'; });
        text = text.replace(/\^([^\s^]+)\^/g, function (_, t) { return '<sup>' + parseInline(t) + '</sup>'; });
        text = text.replace(/~([^\s~]+)~/g, function (_, t) { return '<sub>' + parseInline(t) + '</sub>'; });
        text = text.replace(/:([a-z0-9_]+):/g, function (_, name) { return EMOJI[name] || (':' + name + ':'); });
        text = text.replace(/  \n/g, '<br>');

        text = text.replace(/\x00C(\d+)\x00/g, function (_, i) { return codeSlots[+i]; });
        text = text.replace(/\x00M(\d+)\x00/g, function (_, i) { return mathSlots[+i]; });
        return text;
    }

    /* ══════════════════════════════════════════════════════════════════
       §6  LIST PARSER
    ══════════════════════════════════════════════════════════════════ */

    function parseList(lines, ordered) {
        var tag = ordered ? 'ol' : 'ul';
        var html = '<' + tag + ' class="md-list md-' + tag + '">';
        var i = 0;
        while (i < lines.length) {
            var line = lines[i];
            var marker = ordered ? line.match(/^\s*\d+\.\s+(.*)/) : line.match(/^\s*[-*+]\s+(.*)/);
            if (!marker) { i++; continue; }
            var content = marker[1];
            var indent = line.match(/^(\s*)/)[1].length;
            var taskM = content.match(/^\[([ xX])\]\s+(.*)/);
            var prefix = '';
            if (taskM) {
                prefix = '<input type="checkbox" class="md-task-checkbox" ' + (taskM[1].toLowerCase() === 'x' ? 'checked ' : '') + 'disabled> ';
                content = taskM[2];
            }
            var sub = []; i++;
            while (i < lines.length) {
                var ni = lines[i].match(/^(\s*)/)[1].length;
                if (ni > indent && lines[i].trim() !== '') { sub.push(lines[i]); i++; } else break;
            }
            var item = prefix + parseInline(content);
            if (sub.length) item += parseList(sub, /^\s*\d+\./.test(sub[0]));
            html += '<li class="md-list-item">' + item + '</li>';
        }
        return html + '</' + tag + '>';
    }

    /* ══════════════════════════════════════════════════════════════════
       §7  TABLE PARSER  (GFM)
    ══════════════════════════════════════════════════════════════════ */

    function parseTable(lines) {
        if (lines.length < 2) return null;
        var row = function (l) { return l.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        var aligns = row(lines[1]).map(function (c) {
            return /^:-+:$/.test(c) ? 'center' : /^-+:$/.test(c) ? 'right' : 'left';
        });
        var html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
        row(lines[0]).forEach(function (cell, ci) {
            html += '<th style="text-align:' + (aligns[ci] || 'left') + '">' + parseInline(cell) + '</th>';
        });
        html += '</tr></thead><tbody>';
        lines.slice(2).forEach(function (line) {
            html += '<tr>';
            row(line).forEach(function (cell, ci) {
                html += '<td style="text-align:' + (aligns[ci] || 'left') + '">' + parseInline(cell) + '</td>';
            });
            html += '</tr>';
        });
        return html + '</tbody></table></div>';
    }

    /* ══════════════════════════════════════════════════════════════════
       §8  BLOCK PARSER
       Extended: detects <flashcard> and <analogy> XML blocks before
       the generic raw-HTML passthrough, emits placeholder divs that
       §3.8 hydrates into live components after deps load.
    ══════════════════════════════════════════════════════════════════ */

    function _extractXmlTag(src, tag) {
        /* Pull inner text of a named XML tag (case-insensitive, trims whitespace) */
        var re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i');
        var m = src.match(re);
        return m ? m[1].trim() : '';
    }

    function _parseCustomBlock(lines, i) {
        /* Try to consume a complete <flashcard> or <analogy> block starting at line i.
           Returns { html, nextIndex } on success, null if not applicable. */
        var trimmed = lines[i].trim();

        // ── <flashcard> ────────────────────────────────────────────
        if (/^<flashcard[\s>]/i.test(trimmed) || trimmed === '<flashcard>') {
            var raw = '';
            // Collect lines until closing tag (inclusive)
            var j = i;
            while (j < lines.length) {
                raw += lines[j] + '\n';
                if (/<\/flashcard>/i.test(lines[j])) { j++; break; }
                j++;
            }
            var title = _extractXmlTag(raw, 'title');
            var content = _extractXmlTag(raw, 'content');
            if (!title && !content) return null; // malformed — fall through

            // Use a stable deck id per placeholder so multiple cards can share one widget
            var pid = 'md-fc-' + Math.random().toString(36).slice(2, 8);
            var deckId = 'deck-' + pid; // single card always gets its own deck
            var html = '<div class="md-flashcard-placeholder" id="' + pid + '"'
                + ' data-fc-deck="' + deckId + '"'
                + ' data-fc-front="' + escapeHtml(title) + '"'
                + ' data-fc-back="' + escapeHtml(content) + '">'
                + '</div>';
            return { html: html, nextIndex: j };
        }

        // ── <analogy> ──────────────────────────────────────────────
        if (/^<analogy[\s>]/i.test(trimmed) || trimmed === '<analogy>') {
            var raw = '';
            var j = i;
            while (j < lines.length) {
                raw += lines[j] + '\n';
                if (/<\/analogy>/i.test(lines[j])) { j++; break; }
                j++;
            }
            // <analogy> uses <title> or <topic> for the heading
            var topic = _extractXmlTag(raw, 'title') || _extractXmlTag(raw, 'topic');
            var content = _extractXmlTag(raw, 'content');
            if (!topic && !content) return null;

            var pid = 'md-ac-' + Math.random().toString(36).slice(2, 8);
            var html = '<div class="md-analogy-placeholder" id="' + pid + '"'
                + ' data-ac-topic="' + escapeHtml(topic) + '"'
                + ' data-ac-content="' + escapeHtml(content) + '">'
                + '</div>';
            return { html: html, nextIndex: j };
        }

        return null; // not a custom block
    }

    function parse(markdown) {
        var lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        var out = [];
        var fn = {};
        var i = 0;

        while (i < lines.length) {
            var line = lines[i];
            var trimmed = line.trim();

            /* ── Footnote definition ── */
            var fnDef = trimmed.match(/^\[\^([^\]]+)\]:\s+(.+)$/);
            if (fnDef) { fn[fnDef[1]] = fnDef[2]; i++; continue; }

            /* ── Fenced code block ── */
            var fenceOpen = trimmed.match(/^(`{3,}|~{3,})\s*(\S+)?/);
            if (fenceOpen && /^[`~]/.test(trimmed[0])) {
                var fenceChar = fenceOpen[1][0];
                var fenceLen = fenceOpen[1].length;
                var lang = fenceOpen[2] ? fenceOpen[2].split(/[\s/\\:,]/)[0] : '';
                var codeLines = [];
                i++;
                while (i < lines.length) {
                    var cl = lines[i]; var ct = cl.trim();
                    var cm = ct.match(/^([`~]+)\s*$/);
                    if (cm && cm[1][0] === fenceChar && cm[1].length >= fenceLen) { i++; break; }
                    codeLines.push(cl); i++;
                }
                if (lang === 'mermaid') {
                    var mCode = codeLines.join('\n');
                    var mId = 'md-mermaid-' + Math.random().toString(36).slice(2, 9);
                    out.push('<div class="md-mermaid-placeholder" id="' + mId + '" data-md-mermaid="' + escapeHtml(mCode) + '"></div>');
                } else {
                    out.push(_codeBlock(codeLines.join('\n'), lang));
                }
                continue;
            }

            /* ── Block math ── */
            if (trimmed === '$$' || trimmed.startsWith('$$\n') || /^\$\$[^\$]/.test(trimmed)) {
                var mathLines = []; var afterDollar = trimmed.slice(2);
                if (afterDollar && !afterDollar.startsWith('$')) {
                    if (afterDollar.endsWith('$$')) { out.push(_blockMath(afterDollar.slice(0, -2).trim())); i++; continue; }
                    mathLines.push(afterDollar);
                }
                i++;
                while (i < lines.length) {
                    var ml = lines[i];
                    if (ml.trim() === '$$' || ml.trim().endsWith('$$')) {
                        if (ml.trim() !== '$$') mathLines.push(ml.trim().slice(0, -2));
                        i++; break;
                    }
                    mathLines.push(ml); i++;
                }
                out.push(_blockMath(mathLines.join('\n').trim()));
                continue;
            }

            /* ── Horizontal rule ── */
            if (/^(\s*[-*_]){3,}\s*$/.test(line) && trimmed.replace(/[-*_ ]/g, '') === '') {
                out.push('<hr class="md-hr">'); i++; continue;
            }

            /* ── ATX Heading ── */
            var hm = trimmed.match(/^(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/);
            if (hm) {
                var lvl = hm[1].length; var htx = hm[2].trim();
                var hid = slugify(htx.replace(/[*_`#]/g, ''));
                out.push('<h' + lvl + ' id="' + hid + '" class="md-h md-h' + lvl + '">' + parseInline(htx) + '</h' + lvl + '>');
                i++; continue;
            }

            /* ── Setext heading ── */
            if (i + 1 < lines.length && trimmed) {
                if (/^=+\s*$/.test(lines[i + 1].trim()) && lines[i + 1].trim()) {
                    var sid = slugify(trimmed.replace(/[*_`]/g, ''));
                    out.push('<h1 id="' + sid + '" class="md-h md-h1">' + parseInline(trimmed) + '</h1>');
                    i += 2; continue;
                }
                if (/^-+\s*$/.test(lines[i + 1].trim()) && lines[i + 1].trim().length > 1) {
                    var sid2 = slugify(trimmed.replace(/[*_`]/g, ''));
                    out.push('<h2 id="' + sid2 + '" class="md-h md-h2">' + parseInline(trimmed) + '</h2>');
                    i += 2; continue;
                }
            }

            /* ── Blockquote ── */
            if (/^>\s?/.test(trimmed)) {
                var bq = [];
                while (i < lines.length && /^>\s?/.test(lines[i].trim())) { bq.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
                out.push('<blockquote class="md-blockquote">' + parse(bq.join('\n')) + '</blockquote>');
                continue;
            }

            /* ── List ── */
            if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
                var listOrd = /^\s*\d+\./.test(trimmed);
                var li0 = line.match(/^(\s*)/)[1].length;
                var ll = [];
                while (i < lines.length) {
                    var lc = lines[i]; var lci = lc.match(/^(\s*)/)[1].length;
                    var isIt = /^\s*[-*+]\s+/.test(lc) || /^\s*\d+\.\s+/.test(lc);
                    var cont = lc.trim() !== '' && lci > li0;
                    var emp = lc.trim() === '';
                    if (isIt && lci === li0) { ll.push(lc); i++; }
                    else if (cont || (emp && ll.length && i + 1 < lines.length && lines[i + 1].trim())) { ll.push(lc); i++; }
                    else break;
                }
                out.push(parseList(ll, listOrd));
                continue;
            }

            /* ── GFM Table ── */
            if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*\|/.test(lines[i + 1])) {
                var tl = [];
                while (i < lines.length && /\|/.test(lines[i])) { tl.push(lines[i]); i++; }
                var th = parseTable(tl);
                if (th) { out.push(th); continue; }
            }

            /* ── Custom XML blocks (<flashcard>, <analogy>) ──
               Must come BEFORE the generic raw-HTML passthrough so these
               are intercepted and turned into component placeholders.     */
            if (/^<(flashcard|analogy)[\s>]/i.test(trimmed)) {
                var result = _parseCustomBlock(lines, i);
                if (result) { out.push(result.html); i = result.nextIndex; continue; }
            }

            /* ── Raw HTML block ── */
            if (/^<[a-zA-Z]/.test(trimmed)) {
                var hb = '';
                while (i < lines.length && lines[i].trim() !== '') { hb += lines[i] + '\n'; i++; }
                out.push(hb);
                continue;
            }

            /* ── Blank line ── */
            if (trimmed === '') { i++; continue; }

            /* ── Paragraph ── */
            var pl = [];
            while (i < lines.length) {
                var pl_line = lines[i];
                var pl_trimmed = pl_line.trim();
                if (pl_trimmed === '') break;
                if (/^#{1,6}\s/.test(pl_trimmed)) break;
                if (/^>\s?/.test(pl_trimmed)) break;
                if (/^(\s*[-*_]){3,}\s*$/.test(pl_line)) break;
                if (/^(`{3,}|~{3,})/.test(pl_trimmed)) break;
                if (/^\$\$/.test(pl_trimmed)) break;
                if (/^\s*[-*+]\s+/.test(pl_line) || /^\s*\d+\.\s+/.test(pl_line)) break;
                pl.push(pl_line); i++;
            }
            if (pl.length) out.push('<p class="md-p">' + parseInline(pl.join(' ')) + '</p>');
        }

        /* ── Footnote inline refs ── */
        var html = out.join('\n');
        html = html.replace(/\[\^([^\]]+)\]/g, function (_, lbl) {
            var def = fn[lbl];
            return '<sup class="md-footnote"' + (def ? ' title="' + escapeHtml(def) + '"' : '') + '>[' + escapeHtml(lbl) + ']</sup>';
        });
        return html;
    }

    /* ══════════════════════════════════════════════════════════════════
       §9  BUILT-IN STYLES
    ══════════════════════════════════════════════════════════════════ */

    var GOOGLE_FONTS = 'https://fonts.googleapis.com/css2?'
        + 'family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700&'
        + 'family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&'
        + 'family=Inter:wght@400;500;600;700&'
        + 'family=JetBrains+Mono:ital,wght@0,400;0,500;1,400&'
        + 'display=swap';

    function _injectFonts() {
        if (typeof document === 'undefined') return;
        if (document.querySelector('link[data-md-fonts]')) return;
        ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'].forEach(function (h) {
            if (document.querySelector('link[href="' + h + '"]')) return;
            var pc = document.createElement('link'); pc.rel = 'preconnect'; pc.href = h;
            if (h.includes('gstatic')) pc.crossOrigin = 'anonymous';
            document.head.appendChild(pc);
        });
        var link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = GOOGLE_FONTS;
        link.setAttribute('data-md-fonts', '1');
        document.head.appendChild(link);
    }

    var CSS = [
        '.md-root{--md-h-font:"Playfair Display","Georgia",serif;--md-sub-font:"Inter","Segoe UI",system-ui,sans-serif;--md-body-font:"Source Serif 4","Georgia","Charter",serif;--md-mono:"JetBrains Mono","Fira Code","Cascadia Code","Consolas",monospace;--md-fg:#242424;--md-bg:#fff;--md-accent:#1a8917;--md-accent2:#0f730c;--md-muted:#6b6b6b;--md-border:#e6e6e6;--md-code-bg:#f2f2f2;--md-bq-bar:#242424;--md-mark:#fffde7;--md-th:#f9f9f9;--md-r:4px;font-family:var(--md-body-font);font-size:1.125rem;line-height:1.78;color:var(--md-fg);background:var(--md-bg);padding:2rem 2.5rem;max-width:740px;margin:0 auto;box-sizing:border-box;word-wrap:break-word;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}',
        /* Mobile: tighter horizontal padding frees up space for scrollable elements */
        '@media(max-width:600px){.md-root{padding:1.25rem 1rem;font-size:1rem;}}',
        '@media(prefers-color-scheme:dark){.md-root{--md-fg:#e6e6e6;--md-bg:#191919;--md-accent:#3fba37;--md-accent2:#5cd655;--md-muted:#999;--md-border:#2e2e2e;--md-code-bg:#242424;--md-bq-bar:#e6e6e6;--md-th:#222;}}',
        '.md-root *{box-sizing:border-box}',
        '.md-h{margin:1.5em 0 .4em;line-height:1.18;}',
        '.md-h1{font-family:var(--md-h-font);font-size:clamp(1.9rem,4.5vw,2.75rem);font-weight:700;letter-spacing:-.03em;color:var(--md-fg);border:none;line-height:1.12;}',
        '.md-h2{font-family:var(--md-sub-font);font-size:1.5rem;font-weight:700;letter-spacing:-.02em;color:var(--md-fg);border:none;margin-top:2.2em;}',
        '.md-h3{font-family:var(--md-sub-font);font-size:1.2rem;font-weight:700;letter-spacing:-.015em;border:none;}',
        '.md-h4{font-family:var(--md-sub-font);font-size:1.05rem;font-weight:600;}',
        '.md-h5{font-family:var(--md-sub-font);font-size:.95rem;font-weight:600;}',
        '.md-h6{font-family:var(--md-sub-font);font-size:.875rem;font-weight:500;color:var(--md-muted);}',
        '.md-p{margin:0 0 1.25em;font-size:1.125rem;line-height:1.78;color:var(--md-fg);}',
        '.md-link{color:inherit;text-decoration:underline;text-decoration-color:rgba(36,36,36,.4);text-underline-offset:2px;text-decoration-thickness:1px;transition:text-decoration-color .15s;}',
        '.md-link:hover{text-decoration-color:var(--md-fg);}',
        '@media(prefers-color-scheme:dark){.md-link{text-decoration-color:rgba(230,230,230,.35);}.md-link:hover{text-decoration-color:#e6e6e6;}}',
        '.md-inline-code{font-family:var(--md-mono);font-size:.82em;background:var(--md-code-bg);border-radius:3px;padding:.1em .38em;color:#c7254e;}',
        '@media(prefers-color-scheme:dark){.md-inline-code{color:#f48fb1;background:#2a2a2a}}',
        /* Code block card — overflow visible so the <pre> scroll is not clipped */
        '.md-code-block{border-radius:10px;overflow:visible;margin:1.5em auto;border:1px solid #e0e4ea;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.06);max-width:720px;width:100%;}',
        '.md-code-header{display:flex;justify-content:space-between;align-items:center;padding:.55em .9em;background:#fff;border-bottom:1px solid #e8ecf0;border-radius:10px 10px 0 0;}',
        '.md-code-lang{font-family:var(--md-mono);font-size:.78rem;color:#6b7280;font-weight:500;letter-spacing:.03em;}',
        '.md-code-actions{display:flex;align-items:center;gap:.4em}',
        '.md-code-collapse{background:none;border:none;cursor:pointer;color:#9ca3af;font-size:1rem;line-height:1;padding:.2em .35em;border-radius:4px;transition:color .15s,background .15s;display:flex;align-items:center;justify-content:center;}',
        '.md-code-collapse:hover{color:#374151;background:#f3f4f6}',
        '.md-copy-btn{display:flex;align-items:center;gap:.35em;background:none;border:none;cursor:pointer;color:#6b7280;font-size:.78rem;font-family:var(--md-mono);padding:.25em .5em;border-radius:4px;transition:color .15s,background .15s;}',
        '.md-copy-btn:hover{color:#374151;background:#f3f4f6}',
        '.md-copy-icon{flex-shrink:0;opacity:.7}',
        '.md-copy-btn:hover .md-copy-icon{opacity:1}',
        /* pre is the scroll container — rounded bottom corners, always-visible scrollbar on small screens */
        '.md-code-block pre{margin:0;padding:1em 1.15em;background:#fafbfc;overflow-x:auto;border-radius:0 0 10px 10px;scrollbar-width:thin;scrollbar-color:#c1c7d0 #f0f2f5;}',
        '.md-code-block pre::-webkit-scrollbar{height:6px;}',
        '.md-code-block pre::-webkit-scrollbar-track{background:#f0f2f5;border-radius:0 0 10px 10px;}',
        '.md-code-block pre::-webkit-scrollbar-thumb{background:#c1c7d0;border-radius:4px;}',
        '.md-code-block pre::-webkit-scrollbar-thumb:hover{background:#9ca3af;}',
        /* code must NOT scroll itself (hljs sets overflow-x:auto — we override it back) */
        /* also white-space:pre to prevent line wrapping, which is what triggers the scroll */
        '.md-code-block code,.md-code-block code.hljs{font-family:var(--md-mono);font-size:.875rem;line-height:1.65;background:none!important;overflow-x:visible!important;white-space:pre!important;display:block;padding:0!important;}',
        /* Below 768px: always show the scrollbar so users know the block is scrollable */
        '@media(max-width:768px){',
        '  .md-code-block pre{scrollbar-width:auto;overflow-x:scroll;}',
        '  .md-code-block pre::-webkit-scrollbar{height:7px;}',
        '  .md-code-block pre::-webkit-scrollbar-thumb{background:#9ca3af;}',
        '  .md-code-block code,.md-code-block code.hljs{font-size:.82rem;}',
        '}',
        '@media(prefers-color-scheme:dark){',
        '  .md-code-block{border-color:#3a3f4b;background:#282c34;box-shadow:0 1px 6px rgba(0,0,0,.35);}',
        '  .md-code-header{background:#282c34;border-bottom-color:#3a3f4b;}',
        '  .md-code-lang{color:#9ca3af}.md-code-collapse{color:#6b7280}',
        '  .md-code-collapse:hover{color:#e5e7eb;background:#353a45}',
        '  .md-copy-btn{color:#6b7280}.md-copy-btn:hover{color:#e5e7eb;background:#353a45}',
        '  .md-code-block pre{background:#282c34;scrollbar-color:#4b5563 #1e2127;}',
        '  .md-code-block pre::-webkit-scrollbar-track{background:#1e2127;}',
        '  .md-code-block pre::-webkit-scrollbar-thumb{background:#4b5563;}',
        '  .md-code-block pre::-webkit-scrollbar-thumb:hover{background:#6b7280;}',
        '  .md-code-block code,.md-code-block code.hljs{color:#abb2bf;}',
        '}',
        '@media(max-width:600px){',
        '  .md-code-block pre{padding:.75em .85em;}',
        '}',
        '.md-blockquote{border-left:3px solid var(--md-bq-bar);margin:1.8em 0;padding:.1em 0 .1em 1.5em;background:none;font-style:italic;font-size:1.22rem;line-height:1.65;color:var(--md-muted);}',
        '.md-blockquote .md-blockquote{font-size:1rem;}',
        '@media(prefers-color-scheme:dark){.md-blockquote{border-left-color:#e6e6e6;color:#999;}}',
        '.md-list{margin:.5em 0 1.1em;padding-left:1.75em;}',
        '.md-list-item{margin:.45em 0;font-size:1.125rem;line-height:1.78;}',
        '.md-task-checkbox{margin-right:.5em;accent-color:var(--md-accent);}',
        /* Tables — scroll wrapper: max-width + centered + always-visible scrollbar on small screens */
        '.md-table-wrap{overflow-x:auto;margin:1.5em auto;border-radius:var(--md-r);border:1px solid var(--md-border);max-width:720px;width:100%;scrollbar-width:thin;scrollbar-color:#d1d5db transparent;}',
        '.md-table-wrap::-webkit-scrollbar{height:6px;}',
        '.md-table-wrap::-webkit-scrollbar-track{background:#f0f2f5;}',
        '.md-table-wrap::-webkit-scrollbar-thumb{background:#c1c7d0;border-radius:4px;}',
        '.md-table-wrap::-webkit-scrollbar-thumb:hover{background:#9ca3af;}',
        '@media(max-width:768px){.md-table-wrap{scrollbar-width:auto;overflow-x:scroll;}.md-table-wrap::-webkit-scrollbar{height:7px;}.md-table-wrap::-webkit-scrollbar-thumb{background:#9ca3af;}}',
        '@media(prefers-color-scheme:dark){.md-table-wrap{scrollbar-color:#4b5563 #1e2127;}.md-table-wrap::-webkit-scrollbar-track{background:#1e2127;}.md-table-wrap::-webkit-scrollbar-thumb{background:#4b5563;}.md-table-wrap::-webkit-scrollbar-thumb:hover{background:#6b7280;}}',
        /* Table itself: nowrap so columns hold their shape and wrapper scrolls */
        '.md-table{border-collapse:collapse;width:100%;font-size:1rem;white-space:nowrap;}',
        '.md-table th{background:var(--md-th);font-family:var(--md-sub-font);font-weight:600;font-size:.875rem;padding:.6em 1em;border-bottom:2px solid var(--md-border);letter-spacing:.01em;}',
        '.md-table td{padding:.55em 1em;border-bottom:1px solid var(--md-border);}',
        '.md-table tr:last-child td{border-bottom:none;}',
        '.md-table tr:nth-child(even) td{background:#fafafa;}',
        '@media(prefers-color-scheme:dark){.md-table th{background:#222;}.md-table tr:nth-child(even) td{background:#1e1e1e;}}',
        '@media(max-width:600px){.md-table{font-size:.875rem;}.md-table th{font-size:.8rem;padding:.5em .75em;}.md-table td{padding:.45em .75em;}}',
        '.md-hr{border:none;border-top:1px solid var(--md-border);margin:3em auto;width:25%;display:block;}',
        '.md-img{max-width:100%;height:auto;border-radius:var(--md-r);margin:1em 0;display:block;}',
        '.md-highlight{background:var(--md-mark);padding:.05em .25em;border-radius:2px;}',
        '.md-footnote{color:var(--md-accent);cursor:help;border-bottom:1px dotted var(--md-accent);font-size:.8em;}',
        /* Math block — max-width + centered + horizontal scroll for wide equations */
        '.md-math-block{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:.75em 0;text-align:center;font-size:1.1em;max-width:720px;margin:1em auto;scrollbar-width:thin;scrollbar-color:#c1c7d0 #f0f2f5;}',
        '.md-math-block::-webkit-scrollbar{height:6px;}',
        '.md-math-block::-webkit-scrollbar-track{background:#f0f2f5;}',
        '.md-math-block::-webkit-scrollbar-thumb{background:#c1c7d0;border-radius:4px;}',
        '.md-math-block::-webkit-scrollbar-thumb:hover{background:#9ca3af;}',
        '@media(max-width:768px){.md-math-block{scrollbar-width:auto;overflow-x:scroll;font-size:.95em;padding:.6em 0;}.md-math-block::-webkit-scrollbar{height:7px;}.md-math-block::-webkit-scrollbar-thumb{background:#9ca3af;}}',
        '@media(prefers-color-scheme:dark){.md-math-block{scrollbar-color:#4b5563 #1e2127;}.md-math-block::-webkit-scrollbar-track{background:#1e2127;}.md-math-block::-webkit-scrollbar-thumb{background:#4b5563;}}',
        '.md-math-inline{font-size:1em;}',
        '.md-mermaid-placeholder{margin:1.5em 0;}',
    ].join('\n');

    var _stylesInjected = false;
    function _injectStyles(extra) {
        if (_stylesInjected || typeof document === 'undefined') return;
        _injectFonts();
        if (!document.getElementById('md-renderer-styles')) {
            var s = document.createElement('style');
            s.id = 'md-renderer-styles';
            s.textContent = CSS + (extra || '');
            document.head.appendChild(s);
        }
        _stylesInjected = true;
    }

    /* ══════════════════════════════════════════════════════════════════
       §10  PUBLIC API
    ══════════════════════════════════════════════════════════════════ */

    function MDRenderer(options) {
        options = options || {};
        _injectStyles(options.css);

        function load(host, markdown) {
            if (typeof document === 'undefined') {
                return Promise.reject(new Error('MDRenderer.load() requires a browser environment.'));
            }
            var el = typeof host === 'string' ? document.getElementById(host) : host;
            if (!el) {
                return Promise.reject(new Error('MDRenderer: host "' + host + '" not found.'));
            }

            return _loadAllDeps().then(function () {
                el.classList.add('md-root');
                el.innerHTML = parse(markdown);

                if (typeof hljs !== 'undefined') {
                    el.querySelectorAll('pre code').forEach(function (block) {
                        try { hljs.highlightElement(block); } catch (e) { }
                    });
                }

                // Hydrate mermaid + custom component placeholders in parallel
                return Promise.all([
                    _renderAllMermaidDiagrams(el),
                    Promise.resolve(_renderCustomBlocks(el))
                ]).then(function () {
                    _triggerMathJax(el);

                    el.querySelectorAll('a[href^="#"]').forEach(function (a) {
                        a.addEventListener('click', function (e) {
                            var target = document.getElementById(a.getAttribute('href').slice(1));
                            if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
                        });
                    });

                    return api;
                });
            });
        }

        function toHTML(markdown) {
            return parse(markdown);
        }

        /**
         * print(container)
         *
         * Renders the content of `container` into a clean isolated window
         * and triggers print from there. The host page is never modified.
         *
         * Before printing:
         *   - Flashcards are flattened to a heading + definition block.
         *   - Mermaid SVGs are rasterised to PNG data URIs.
         *   - All page styles are carried across to the print window.
         *   - Interactive chrome (toolbars, buttons) is stripped.
         *
         * @param {string|Element} container  id string or DOM element that
         *                                    wraps all rendered host divs.
         * @returns Promise  resolves once the print window has been opened.
         */
        function print(container, print_title, alert_handler) {
            var root = typeof container === 'string'
                ? document.getElementById(container)
                : container;
            if (!root) {
                console.warn('MDRenderer.print(): container not found:', container);
                return Promise.resolve();
            }

            if (typeof print_title !== 'string' || print_title.trim().length === 0) {
                console.warn('A valid title is required before the printing can be done');
                return Promise.resolve();
            }

            if (typeof alert_handler !== 'object' || alert_handler === null || typeof alert_handler.display !== 'function') {
                console.warn('A valid alert handler is required');
                return Promise.resolve();
            }



            /* ── Step 1: deep-clone so the live page is never touched ────── */
            var clone = root.cloneNode(true);

            /* ── Step 2: flatten flashcards in the clone ─────────────────── */
            clone.querySelectorAll('.fc-wrap').forEach(function (wrap) {
                var termEl = wrap.querySelector('[id$="_term"]');
                var defEl = wrap.querySelector('[id$="_def"]');
                var term = termEl ? termEl.textContent.trim() : '';
                var def = defEl ? defEl.textContent.trim() : '';

                var block = document.createElement('div');
                block.style.cssText = [
                    'border:1px solid #e6e4de',
                    'border-radius:12px',
                    'padding:1.25rem 1.5rem',
                    'margin:1.25em auto',
                    'max-width:600px',
                    'font-family:\'Source Serif 4\',Georgia,serif',
                    'page-break-inside:avoid',
                    'box-sizing:border-box'
                ].join(';');
                block.innerHTML =
                    '<div style="font-family:\'JetBrains Mono\',monospace;font-size:.65rem;'
                    + 'font-weight:500;letter-spacing:.09em;text-transform:uppercase;'
                    + 'color:#9a9a98;margin-bottom:.5rem;">Flashcard</div>'
                    + '<div style="font-family:\'Playfair Display\',Georgia,serif;font-size:1.2rem;'
                    + 'font-weight:700;color:#242424;line-height:1.3;margin-bottom:.65rem;">'
                    + _escHtml(term) + '</div>'
                    + '<hr style="border:none;border-top:1px solid #e6e4de;margin:.65rem 0;">'
                    + '<p style="font-family:\'Source Serif 4\',Georgia,serif;font-size:.975rem;'
                    + 'line-height:1.75;color:#444;margin:0;">'
                    + _escHtml(def) + '</p>';

                wrap.parentNode.replaceChild(block, wrap);
            });

            /* ── Step 3: strip interactive chrome from the clone ─────────── */
            [
                '.md-mermaid-header', '.md-mermaid-toolbar', '.md-mermaid-tool-btn',
                '.md-mermaid-dl-wrap', '.fc-controls', '.fc-badge', '.fc-scene',
                '.md-code-actions', '.md-copy-btn', '.md-code-collapse',
                '.md-mermaid-loading', '.md-mermaid-error'
            ].forEach(function (sel) {
                clone.querySelectorAll(sel).forEach(function (el) { el.remove(); });
            });

            /* ── Step 4: rasterise mermaid SVGs → PNG using the live DOM ─── */
            /* SVGs only exist in the live DOM after mermaid renders them.
               We read from the live root, convert to PNG, then patch the clone. */
            var liveMermaidCards = Array.prototype.slice.call(
                root.querySelectorAll('.md-mermaid-card')
            );
            var cloneMermaidCards = Array.prototype.slice.call(
                clone.querySelectorAll('.md-mermaid-card')
            );

            var svgJobs = liveMermaidCards.map(function (liveCard, idx) {
                return new Promise(function (resolve) {
                    var svgEl = liveCard.querySelector('.md-mermaid-inner svg');
                    var cloneCard = cloneMermaidCards[idx];
                    if (!svgEl || !cloneCard) { resolve(); return; }

                    try {
                        var bbox = svgEl.getBoundingClientRect();
                        var W = Math.round(bbox.width || 800);
                        var H = Math.round(bbox.height || 400);
                        var SCALE = 2;

                        var svgClone = svgEl.cloneNode(true);
                        svgClone.setAttribute('width', W);
                        svgClone.setAttribute('height', H);
                        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                        /* inline page styles so mermaid colours survive the canvas draw */
                        var styleText = '';
                        document.querySelectorAll('style').forEach(function (s) {
                            styleText += s.textContent + '\n';
                        });
                        styleText = styleText.replace(
                            /@font-face\s*\{[^}]*src:[^}]*url\(["\'\']?https?:[^)]+["\'\']?\)[^}]*\}/gi, ''
                        );
                        var inlineStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style');
                        inlineStyle.textContent = styleText;
                        svgClone.insertBefore(inlineStyle, svgClone.firstChild);

                        var svgStr = new XMLSerializer().serializeToString(svgClone);
                        var dataURI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);

                        var tmpImg = new Image();
                        tmpImg.onload = function () {
                            var cnv = document.createElement('canvas');
                            cnv.width = W * SCALE;
                            cnv.height = H * SCALE;
                            var ctx = cnv.getContext('2d');
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, cnv.width, cnv.height);
                            ctx.scale(SCALE, SCALE);
                            ctx.drawImage(tmpImg, 0, 0, W, H);

                            var printImg = document.createElement('img');
                            printImg.src = cnv.toDataURL('image/png');
                            printImg.style.cssText = [
                                'display:block',
                                'max-width:100%',
                                'height:auto',
                                'margin:1.5em auto',
                                'border-radius:8px',
                                'page-break-inside:avoid'
                            ].join(';');

                            /* replace the entire card in the clone with just the PNG */
                            cloneCard.parentNode.replaceChild(printImg, cloneCard);
                            resolve();
                        };
                        tmpImg.onerror = function () { resolve(); };
                        tmpImg.src = dataURI;
                    } catch (e) {
                        console.warn('MDRenderer.print(): rasterise failed', e);
                        resolve();
                    }
                });
            });

            /* ── Step 5: gather all styles from the current page ─────────── */
            function _collectStyles() {
                var out = '';
                document.querySelectorAll('style').forEach(function (s) {
                    out += s.textContent + '\n';
                });
                document.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
                    out += '@import url("' + l.href + '");\n';
                });
                return out;
            }

            /* ── Step 6: open isolated window and print ──────────────────── */
            return Promise.all(svgJobs).then(function () {
                var styles = _collectStyles();
                var bodyHTML = '<div style="max-width:780px;margin:0 auto;padding:2rem 1.5rem;">'
                    + clone.innerHTML + '</div>';

                var old = document.getElementById("__print_frame");
                if (old) old.remove();

                var iframe = document.createElement("iframe");
                iframe.id = "__print_frame";
                iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;";
                document.body.appendChild(iframe);

                var doc = iframe.contentDocument || iframe.contentWindow.document;
                var title = print_title.length >= 20 ? print_title.slice(-15) : print_title;

                doc.open();
                doc.write(
                    `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>transformed..${title}</title>`
                    + '<style>'
                    + '@page { size: auto; margin: 0mm; } '
                    + styles
                    + '</style>'
                    + '<style>'
                    + 'body{margin:15mm 20mm;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
                    + '.md-root{padding:0;max-width:none;background:#fff;}'
                    + '.md-mermaid-canvas{overflow:visible!important;height:auto!important;cursor:default!important;}'
                    + '.md-mermaid-inner{transform:none!important;padding:0!important;}'
                    + '.md-code-block{box-shadow:none!important;}'
                    + '.ac-callout,.fc-wrap,.md-mermaid-card{page-break-inside:avoid;}'
                    + '</style>'
                    + '</head><body>'
                    + bodyHTML
                    + '</body></html>'
                );
                doc.close();

                iframe.onload = function () {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                    setTimeout(function () { iframe.remove(); }, 1000);
                };
            });
        }

        /* tiny html-escape used by print() — avoids dependency on escapeHtml scope */
        function _escHtml(str) {
            return String(str || '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        var api = { load: load, toHTML: toHTML, print: print };
        return api;
    }

    return MDRenderer;

}));
