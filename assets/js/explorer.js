window.atoast = new AToast();
// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('#explorerTabs .nav-link').forEach(function (tab) {
    tab.addEventListener('click', function (e) {
        e.preventDefault();

        // Deactivate all tabs and panes
        document.querySelectorAll('#explorerTabs .nav-link').forEach(function (t) {
            t.classList.remove('active');
        });
        document.querySelectorAll('#explorerTabContent .tab-pane').forEach(function (p) {
            p.classList.remove('show', 'active');
        });

        // Activate clicked tab
        this.classList.add('active');
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.classList.add('show', 'active');
        }
    });
});


// ── Settings tab: populate model dropdown from textarea ──────────────────────
function refreshModelDropdown() {
    const textarea = document.getElementById('cfg-models');
    const select = document.getElementById('cfg-default-model');
    const saved = select.dataset.saved || '';

    const models = textarea.value.split('\n').map(m => m.trim()).filter(Boolean);
    select.innerHTML = '<option value="">-- select default --</option>';
    models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === saved) opt.selected = true;
        select.appendChild(opt);
    });
}

const cfgModels = document.getElementById('cfg-models');

if (cfgModels) {
    cfgModels.addEventListener('input', refreshModelDropdown);
}

// Set saved default on page load
// (function initDropdown() {
//     const select = document.getElementById('cfg-default-model');
//     // prettier-ignore
//     select.dataset.saved = <?php echo json_encode((string)$saved_default); ?>;
//     refreshModelDropdown();
// })();
(function initDropdown() {
    const select = document.getElementById('cfg-default-model');

    if (!select) return;

    // Read the value from the data attribute we just added
    if (select && select.dataset.saved) {
        const savedValue = JSON.parse(select.dataset.saved);
        select.value = savedValue;

        // If you still need it in dataset for refreshModelDropdown:
        select.dataset.saved = savedValue;
    }

    refreshModelDropdown();
})();


const btnSaveSettings = document.getElementById('btn-save-settings');

if (btnSaveSettings) {
    // ── Save settings ────────────────────────────────────────────────────────────
    btnSaveSettings.addEventListener('click', async function () {
        const payload = {
            sesskey: SESSKEY,
            baseurl: document.getElementById('cfg-baseurl').value.trim(),
            apikey: document.getElementById('cfg-apikey').value.trim(),
            models: document.getElementById('cfg-models').value.trim(),
            default_model: document.getElementById('cfg-default-model').value,
            sysprompt: document.getElementById('cfg-sysprompt').value.trim(),
        };

        try {
            const res = await fetch(SAVE_SETTINGS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (json.success) {
                window.atoast.display('Settings saved', 1);
                document.getElementById('cfg-default-model').dataset.saved = payload.default_model;
                refreshModelDropdown();
            } else {
                window.atoast.display('Failed to save: ' + (json.error || 'unknown error'), 0);
            }
        } catch (e) {
            window.atoast.display('Network error saving settings', 0);
        }
    });
}

// ── Generate report ──────────────────────────────────────────────────────────
document.getElementById('btn-generate').addEventListener('click', async function () {
    const btnGen = document.getElementById('btn-generate');
    const btnExp = document.getElementById('btn-export');
    const reportArea = document.getElementById('report-area');

    // Reset state
    reportArea.innerHTML = '';
    btnExp.style.display = 'none';
    btnGen.style.display = 'inline-flex';

    // Show loading state
    btnGen.disabled = true;
    reportArea.innerHTML = `
        <div class="fex-loading-state">
            <div class="fex-spinner"></div>
            <p class="fex-loading-msg">Analysing feedback data...</p>
        </div>
    `;

    //Get the current date formatted as "4/17/2026"
    const currentDate = new Date().toLocaleDateString();

    // load the date
    FEEDBACK_DATA.current_date = currentDate;

    console.log(FEEDBACK_DATA);

    try {
        const res = await fetch(GENERATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sesskey: SESSKEY,
                data: FEEDBACK_DATA,
            }),
        });

        const json = await res.json();

        if (!json.success) {
            reportArea.innerHTML = `
                <div class="fex-error-state">
                    <svg class="fex-error-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2V8C12 9.10457 12.8954 10 14 10H20V20C20 21.1046 19.1046 22 18 22H11.1904C12.3112 20.8321 13 19.2465 13 17.5C13 13.9101 10.0899 11 6.5 11C5.6141 11 4.76959 11.1772 4 11.4982V4C4 2.89543 4.89543 2 6 2H12Z" fill="#e37400"/><path d="M13.5 2.5V8C13.5 8.27614 13.7239 8.5 14 8.5H19.5L13.5 2.5Z" fill="#e37400"/><path d="M12 17.5C12 20.5376 9.53757 23 6.5 23C3.46243 23 1 20.5376 1 17.5C1 14.4624 3.46243 12 6.5 12C9.53757 12 12 14.4624 12 17.5ZM6.5 14C6.22386 14 6 14.2239 6 14.5V18.5C6 18.7761 6.22386 19 6.5 19C6.77614 19 7 18.7761 7 18.5V14.5C7 14.2239 6.77614 14 6.5 14ZM6.5 21.125C6.84518 21.125 7.125 20.8452 7.125 20.5C7.125 20.1548 6.84518 19.875 6.5 19.875C6.15482 19.875 5.875 20.1548 5.875 20.5C5.875 20.8452 6.15482 21.125 6.5 21.125Z" fill="#e37400"/></svg>
                    <p class="fex-error-msg">Could not generate report.</p>
                </div>
            `;
            btnGen.disabled = false;
            window.atoast.display('Error: ' + (json.error || 'unknown'), 0);
            return;
        }

        reportArea.innerHTML = '';

        const loadArea = document.createElement('div');
        loadArea.classList.add('transform-content-host-area');
        reportArea.appendChild(loadArea)

        MDRenderer().load(loadArea, json.markdown);

        // restore button label
        btnGen.querySelector('span')
            ? btnGen.querySelector('span').textContent = 'Re-generate Report'
            : btnGen.textContent = 'Re-generate Report';

        // ── Save report to DB 
        fetch(SAVE_REPORT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sesskey: SESSKEY,
                feedbackid: FEEDBACK_ID,
                markdown: json.markdown,
            }),
        }).catch(() => {
            // non-blocking, silent fail
            console.log('failed to save;')
        });

        btnExp.style.display = 'inline-flex';
        btnGen.style.display = 'none';
        window.atoast.display('Report ready', 1);

    } catch (e) {
        reportArea.innerHTML = `
            <div class="fex-error-state">
                <svg class="fex-error-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2V8C12 9.10457 12.8954 10 14 10H20V20C20 21.1046 19.1046 22 18 22H11.1904C12.3112 20.8321 13 19.2465 13 17.5C13 13.9101 10.0899 11 6.5 11C5.6141 11 4.76959 11.1772 4 11.4982V4C4 2.89543 4.89543 2 6 2H12Z" fill="#e37400"/><path d="M13.5 2.5V8C13.5 8.27614 13.7239 8.5 14 8.5H19.5L13.5 2.5Z" fill="#e37400"/><path d="M12 17.5C12 20.5376 9.53757 23 6.5 23C3.46243 23 1 20.5376 1 17.5C1 14.4624 3.46243 12 6.5 12C9.53757 12 12 14.4624 12 17.5ZM6.5 14C6.22386 14 6 14.2239 6 14.5V18.5C6 18.7761 6.22386 19 6.5 19C6.77614 19 7 18.7761 7 18.5V14.5C7 14.2239 6.77614 14 6.5 14ZM6.5 21.125C6.84518 21.125 7.125 20.8452 7.125 20.5C7.125 20.1548 6.84518 19.875 6.5 19.875C6.15482 19.875 5.875 20.1548 5.875 20.5C5.875 20.8452 6.15482 21.125 6.5 21.125Z" fill="#e37400"/></svg>
                <p class="fex-error-msg">Could not generate report.</p>
            </div>
        `;
        btnGen.disabled = false;
        window.atoast.display('Network error generating report', 0);
    }
});

// ── Export PDF ───────────────────────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', function () {
    const reportArea = document.getElementById('report-area');
    const contentArea = reportArea.querySelector('.transform-content-host-area');

    if (contentArea) {
        MDRenderer().print(
            contentArea,
            'Feedback Explorer Report',
            window.atoast
        );
    } else {
        window.atoast.display('Nothing to export yet', 0);
    }
});


// ── Auto-load saved report on page load ──────────────────────────────────────
(async function loadSavedReport() {
    const reportArea = document.getElementById('report-area');
    const btnExp = document.getElementById('btn-export');
    const btnGen = document.getElementById('btn-generate');

    try {
        const res = await fetch(GET_REPORT_URL + '?feedbackid=' + FEEDBACK_ID);
        const json = await res.json();

        if (json.success && json.markdown) {
            const loadArea = document.createElement('div');
            loadArea.classList.add('transform-content-host-area');
            reportArea.appendChild(loadArea);
            MDRenderer().load(loadArea, json.markdown);

            btnExp.style.display = 'inline-flex';

            // Swap label to "Re-generate" instead of hiding
            btnGen.disabled = false;
            btnGen.querySelector('span')
                ? btnGen.querySelector('span').textContent = 'Re-generate Report'
                : btnGen.textContent = 'Re-generate Report';
        }
    } catch (e) {
        // silently fail — user can still generate fresh
    }
})();