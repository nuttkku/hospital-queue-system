// สรุปผล Trivy JSON เป็นรูปแบบสั้นสำหรับแสดงบนหน้าเว็บ
const fs = require("fs");
const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const results = Array.isArray(raw) ? raw : raw.Results || [];
const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
const map = new Map();
for (const r of results) {
    for (const v of r.Vulnerabilities || []) {
        const key = v.VulnerabilityID + "|" + v.PkgName + "|" + v.InstalledVersion;
        if (!map.has(key)) {
            map.set(key, {
                id: v.VulnerabilityID || "N/A",
                severity: v.Severity || "UNKNOWN",
                pkg: v.PkgName || "?",
                installed: v.InstalledVersion || "",
                fixed: v.FixedVersion || "",
                title: (v.Title || "").slice(0, 220),
            });
        }
    }
}
const items = [...map.values()].sort(
    (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
);
const counts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
for (const i of items) {
    const k = (i.severity || "UNKNOWN").toLowerCase();
    if (k in counts) counts[k] += 1;
    else counts.unknown += 1;
}
const out = {
    target: "hospital-queue-system (backend + frontend dependencies)",
    scannedAt: new Date().toISOString(),
    scanner: "Trivy fs",
    counts,
    items,
};
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log("items=" + items.length + " counts=" + JSON.stringify(counts));
