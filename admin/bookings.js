// ===== Settings =====
// Same published link the website uses (read only)
const SHEET_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQL61X45TyNxYoKR1irDHYfBpQ75EtBof-rfUmMIQTcl0OtICr9W8J2-d2lGnV_bhWiyLLpQJFCc2zu/pub?gid=0&single=true&output=csv";

// Open your sheet in Google Sheets and copy the address from the browser bar
const SHEET_EDIT_URL = "PASTE_YOUR_GOOGLE_SHEET_EDIT_LINK_HERE";

(function () {
    if (!document.getElementById("bkCal")) return;

    const $ = id => document.getElementById(id);
    const MONTHS = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
    const MON = MONTHS.map(m => m.slice(0, 3));
    const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const LABEL = { venue: "Venue", hall: "Hall", both: "Venue + Hall" };

    const pad = n => String(n).padStart(2, "0");
    const iso = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);
    const toDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
    const isRealDate = s => { const x = toDate(s); return iso(x.getFullYear(), x.getMonth(), x.getDate()) === s; };
    const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    const now = new Date();
    const todayISO = iso(now.getFullYear(), now.getMonth(), now.getDate());
    const firstYear = now.getFullYear();
    const firstMonth = now.getMonth();
    let year = firstYear;
    let month = firstMonth;

    let rows = [];
    let skipped = [];
    let loaded = false;
    let failed = false;
    let checkedAt = null;

    // ----- date helpers -----
    function fmtDay(s, withYear) {
        const d = toDate(s);
        return d.getDate() + " " + MON[d.getMonth()] + (withYear ? " " + d.getFullYear() : "");
    }

    function fmtRange(a, b) {
        if (a === b) return fmtDay(a, true);
        const da = toDate(a), db = toDate(b);
        if (da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth()) {
            return da.getDate() + "–" + db.getDate() + " " + MON[db.getMonth()] + " " + db.getFullYear();
        }
        if (da.getFullYear() === db.getFullYear()) return fmtDay(a, false) + " – " + fmtDay(b, true);
        return fmtDay(a, true) + " – " + fmtDay(b, true);
    }

    const daysInclusive = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000) + 1;

    function when(r) {
        if (r.end < todayISO) return "Ended";
        if (r.start <= todayISO) return "Happening now";
        const n = Math.round((toDate(r.start) - toDate(todayISO)) / 86400000);
        return n === 1 ? "Tomorrow" : "In " + n + " days";
    }

    // ----- sheet parsing -----
    function parse(text) {
        const ok = /^\d{4}-\d{2}-\d{2}$/;
        const good = [];
        const bad = [];

        text.split(/\r?\n/).slice(1).forEach((line, i) => {
            if (!line.replace(/,/g, "").trim()) return;
            const [sp, st, en] = line.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
            const space = (sp || "").toLowerCase();
            const start = st || "";
            const end = en || st || "";
            const valid = ["venue", "hall", "both"].includes(space) &&
                ok.test(start) && ok.test(end) &&
                isRealDate(start) && isRealDate(end) && end >= start;

            if (valid) good.push({ space, start, end });
            else bad.push("Row " + (i + 2) + ": " + line.trim());
        });

        return { good, bad };
    }

    function isBooked(dateISO, key) {
        return rows.some(r => (r.space === key || r.space === "both") &&
            dateISO >= r.start && dateISO <= r.end);
    }

    // two upcoming bookings that clash on the same space
    function findConflicts() {
        const pairs = [];
        for (let i = 0; i < rows.length; i++) {
            for (let j = i + 1; j < rows.length; j++) {
                const a = rows[i], b = rows[j];
                const sameSpace = a.space === b.space || a.space === "both" || b.space === "both";
                const overlap = a.start <= b.end && b.start <= a.end;
                const upcoming = a.end >= todayISO && b.end >= todayISO;
                if (sameSpace && overlap && upcoming) pairs.push([a, b]);
            }
        }
        return pairs;
    }

    // ----- drawing -----
    function itemHTML(r, clash) {
        const n = daysInclusive(r.start, r.end);
        return '<li class="bk-item' + (clash.has(r.id) ? " conflict" : "") + '">' +
            '<span class="bk-tag ' + r.space + '">' + LABEL[r.space] + "</span>" +
            '<span class="bk-range">' + fmtRange(r.start, r.end) +
            "<small>" + n + (n === 1 ? " day" : " days") + "</small></span>" +
            '<span class="bk-when">' + when(r) + "</span></li>";
    }

    function drawCalendar() {
        const startDay = (new Date(year, month, 1).getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const ahead = (year - firstYear) * 12 + (month - firstMonth);

        let html =
            '<div class="bk-cal-head">' +
            '<button type="button" data-prev aria-label="Previous month"' + (ahead <= 0 ? " disabled" : "") + '>&#8249;</button>' +
            "<strong>" + MONTHS[month] + " " + year + "</strong>" +
            '<button type="button" data-next aria-label="Next month"' + (ahead >= 24 ? " disabled" : "") + '>&#8250;</button>' +
            "</div>" +
            '<div class="bk-grid">' + DOW.map(d => '<span class="bk-dow">' + d + "</span>").join("");

        for (let i = 0; i < startDay; i++) html += "<span></span>";

        for (let d = 1; d <= daysInMonth; d++) {
            const date = iso(year, month, d);
            const v = loaded && isBooked(date, "venue");
            const h = loaded && isBooked(date, "hall");
            let cls = "bk-day";
            if (date < todayISO) cls += " past";
            if (v || h) cls += " booked";
            if (date === todayISO) cls += " today";
            const dots = (v || h)
                ? '<i class="bk-dots">' + (v ? '<b class="dv"></b>' : "") + (h ? '<b class="dh"></b>' : "") + "</i>"
                : "";
            html += '<span class="' + cls + '">' + d + dots + "</span>";
        }
        html += "</div>";

        $("bkCal").innerHTML = html;
        $("bkCal").querySelector("[data-prev]").onclick = () => {
            month--; if (month < 0) { month = 11; year--; }
            drawCalendar();
        };
        $("bkCal").querySelector("[data-next]").onclick = () => {
            month++; if (month > 11) { month = 0; year++; }
            drawCalendar();
        };
    }

    function render() {
        const pill = $("bkStatus");
        pill.className = "status-pill";

        if (failed) {
            pill.textContent = "Couldn't load";
            pill.classList.add("bad");
        } else if (!loaded) {
            pill.textContent = "Loading...";
        } else {
            pill.textContent = "Connected";
            pill.classList.add("ok");
        }

        const upcoming = rows.filter(r => r.end >= todayISO).sort((a, b) => a.start.localeCompare(b.start));
        const past = rows.filter(r => r.end < todayISO).sort((a, b) => b.start.localeCompare(a.start));
        const conflicts = findConflicts();
        const clash = new Set();
        conflicts.forEach(([a, b]) => { clash.add(a.id); clash.add(b.id); });

        $("bkMeta").textContent = loaded
            ? upcoming.length + " upcoming · checked " +
              checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "";

        let notices = "";
        if (failed) {
            notices += '<div class="bk-notice danger">The sheet couldn\'t be read. Check your internet connection and that the sheet is still published to the web.</div>';
        }
        if (conflicts.length) {
            notices += '<div class="bk-notice danger"><strong>Possible double booking</strong><ul>' +
                conflicts.map(([a, b]) =>
                    "<li>" + LABEL[a.space] + " " + fmtRange(a.start, a.end) +
                    " overlaps " + LABEL[b.space] + " " + fmtRange(b.start, b.end) + "</li>").join("") +
                "</ul></div>";
        }
        if (skipped.length) {
            notices += '<div class="bk-notice warn"><strong>' + skipped.length +
                (skipped.length === 1 ? " row was" : " rows were") +
                " ignored.</strong> Check the space (venue, hall or both) and the dates (YYYY-MM-DD).<ul>" +
                skipped.map(s => "<li>" + esc(s) + "</li>").join("") + "</ul></div>";
        }
        $("bkNotices").innerHTML = notices;

        $("bkList").innerHTML = loaded
            ? (upcoming.length
                ? upcoming.map(r => itemHTML(r, clash)).join("")
                : '<li class="bk-empty">No upcoming bookings in the sheet.</li>')
            : "";

        const pastBox = $("bkPast");
        pastBox.hidden = !past.length;
        $("bkPastCount").textContent = past.length;
        $("bkPastList").innerHTML = past.map(r => itemHTML(r, clash)).join("");

        drawCalendar();
    }

    async function load() {
        loaded = false;
        failed = false;
        render();
        try {
            const url = SHEET_CSV + (SHEET_CSV.includes("?") ? "&" : "?") + "t=" + Date.now();
            const res = await fetch(url);
            if (!res.ok) throw new Error("bad response");
            const parsed = parse(await res.text());
            rows = parsed.good.map((r, i) => Object.assign({ id: i }, r));
            skipped = parsed.bad;
            loaded = true;
            checkedAt = new Date();
        } catch (e) {
            failed = true;
        }
        render();
    }

    // edit button: only shown once you've pasted your sheet's edit link
    const edit = $("bkEdit");
    if (SHEET_EDIT_URL.indexOf("https://docs.google.com/") === 0) edit.href = SHEET_EDIT_URL;
    else edit.hidden = true;

    $("bkRefresh").addEventListener("click", load);
    load();
})();

