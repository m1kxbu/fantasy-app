import { readFileSync } from "node:fs";
import { parseFpAdpTable } from "../src/lib/sources/fantasypros";

const html = readFileSync(process.argv[2] ?? "/tmp/fp-bb.html", "utf8");
const rows = parseFpAdpTable(html);

console.log(`parsed ${rows.length} rows`);
console.log("first 5:");
for (const r of rows.slice(0, 5)) console.log(JSON.stringify(r));
console.log("---position breakdown---");
const byPos = new Map<string, number>();
for (const r of rows) byPos.set(r.position, (byPos.get(r.position) ?? 0) + 1);
for (const [k, v] of [...byPos.entries()].sort()) console.log(`  ${k}: ${v}`);
console.log("---missing teams (excluding DST):");
let count = 0;
for (const r of rows) {
  if (r.position !== "DST" && !r.team) {
    if (count < 5) console.log(`  ${r.displayName} (${r.position})`);
    count++;
  }
}
console.log(`  total: ${count}`);
console.log("---slug examples---");
for (const r of rows.slice(0, 3)) console.log(`  ${r.displayName} → ${r.fpSlug}`);
