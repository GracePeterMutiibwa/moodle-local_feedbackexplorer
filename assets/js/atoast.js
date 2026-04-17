class AToast {
    constructor() {
        this._injectStyles();
        this._container = { top: null, bottom: null };
    }

    _injectStyles() {
        if (document.getElementById('atoast-styles')) return;
        const style = document.createElement('style');
        style.id = 'atoast-styles';
        style.textContent = `
      .atoast-container {
        position: fixed; left: 50%; transform: translateX(-50%);
        display: flex; flex-direction: column; align-items: center;
        gap: 8px; z-index: 9999; pointer-events: none;
        width: max-content; max-width: calc(100vw - 40px);
      }
      .atoast-container.top    { top: 20px; }
      .atoast-container.bottom { bottom: 20px; }

      .atoast {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 14px 10px 14px;
        border-radius: 9px;
        font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; font-weight: 500;
        box-shadow: 0 4px 20px rgba(0,0,0,0.14);
        pointer-events: all;
        opacity: 0; transform: translateY(10px);
        transition: opacity 0.2s ease, transform 0.2s ease;
        background: var(--text, #2c3140);
        color: var(--surface, #ffffff);
        border: 1px solid rgba(255,255,255,0.06);
        min-width: 200px;
      }
      .atoast-container.top .atoast { transform: translateY(-10px); }
      .atoast.atoast-show { opacity: 1; transform: translateY(0); }

      .atoast-icon { flex-shrink: 0; display: flex; }
      .atoast-icon.success { color: #22c55e; }
      .atoast-icon.fail    { color: #ef4444; }

      .atoast-msg { 
        flex: 1; 
        line-height: 1.4; 
        overflow-wrap: anywhere; 
      }

      .atoast-close {
        width: 18px; height: 18px; border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.6);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; flex-shrink: 0;
        transition: background 0.15s, color 0.15s;
        padding: 0;
      }
      .atoast-close:hover { background: rgba(255,255,255,0.18); color: #fff; }
    `;
        document.head.appendChild(style);
    }

    _getContainer(position) {
        if (!this._container[position]) {
            const el = document.createElement('div');
            el.className = `atoast-container ${position}`;
            document.body.appendChild(el);
            this._container[position] = el;
        }
        return this._container[position];
    }

    /**
     * @param {string} message
     * @param {1|0}    status    — 1=success, 0=fail
     * @param {"top"|"bottom"} position
     * @param {number} [duration=4000] — ms before auto-dismiss
     */
    display(message, status, position = 'bottom', duration = 4000) {
        const pos = position === 'top' ? 'top' : 'bottom';
        const container = this._getContainer(pos);

        const toast = document.createElement('div');
        toast.className = 'atoast';

        const isSuccess = status === 1;
        const iconSvg = isSuccess
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

        toast.innerHTML = `
      <span class="atoast-icon ${isSuccess ? 'success' : 'fail'}">${iconSvg}</span>
      <span class="atoast-msg">${message}</span>
      <button class="atoast-close" aria-label="Dismiss">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

        container.appendChild(toast);

        // animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('atoast-show'));
        });

        const dismiss = () => {
            toast.classList.remove('atoast-show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        };

        toast.querySelector('.atoast-close').addEventListener('click', dismiss);

        if (duration > 0) setTimeout(dismiss, duration);
    }
}


window.atoast = new AToast();