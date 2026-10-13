import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// drizzle-kit migrate skips any migration whose `when` is not after the last applied one:
// two branches adding a migration with the same index silently lose one of them in prod.
const DRIZZLE_DIR = join(__dirname, "../../drizzle");

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

const entries = (
  JSON.parse(readFileSync(join(DRIZZLE_DIR, "meta/_journal.json"), "utf-8")) as { entries: JournalEntry[] }
).entries;

describe("drizzle migrations journal", () => {
  it("numbers migrations 0..n without gap or duplicate", () => {
    expect(entries.map((e) => e.idx)).toEqual(entries.map((_, i) => i));
  });

  it("gives each migration a strictly later timestamp than the previous one", () => {
    entries.slice(1).forEach((e, i) => expect(e.when).toBeGreaterThan(entries[i].when));
  });

  it("prefixes each tag with its index and has its SQL file", () => {
    const fichiers = new Set(readdirSync(DRIZZLE_DIR).filter((f) => f.endsWith(".sql")));
    for (const e of entries) {
      expect(e.tag.startsWith(String(e.idx).padStart(4, "0") + "_")).toBe(true);
      expect(fichiers.has(`${e.tag}.sql`)).toBe(true);
    }
  });
});
