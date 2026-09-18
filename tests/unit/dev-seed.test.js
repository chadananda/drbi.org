import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sqlLiteral, rowInsert, tableInserts, buildSeedSql, PUBLIC_TABLES, SYNTHETIC } from "../../src/lib/dev-seed.js";

describe("sqlLiteral", () => {
  it("renders null and undefined as NULL", () => {
    assert.equal(sqlLiteral(null), "NULL");
    assert.equal(sqlLiteral(undefined), "NULL");
  });
  it("renders numbers bare", () => {
    assert.equal(sqlLiteral(5), "5");
    assert.equal(sqlLiteral(0), "0");
    assert.equal(sqlLiteral(-3.5), "-3.5");
  });
  it("renders booleans as 1/0", () => {
    assert.equal(sqlLiteral(true), "1");
    assert.equal(sqlLiteral(false), "0");
  });
  it("quotes strings and doubles embedded single quotes", () => {
    assert.equal(sqlLiteral("hi"), "'hi'");
    assert.equal(sqlLiteral("O'Brien"), "'O''Brien'");
    assert.equal(sqlLiteral("a'b'c"), "'a''b''c'");
  });
  it("does not let a value break out of the statement (injection)", () => {
    const evil = "'); DROP TABLE users;--";
    const out = sqlLiteral(evil);
    assert.equal(out, "'''); DROP TABLE users;--'");
    assert.ok(!out.includes("');") || out.startsWith("'"), "must stay a single quoted literal");
  });
  it("serializes objects/arrays as JSON text (D1 JSON columns are TEXT)", () => {
    assert.equal(sqlLiteral(["a", "b"]), "'[\"a\",\"b\"]'");
    assert.equal(sqlLiteral({ x: 1 }), "'{\"x\":1}'");
  });
});

describe("rowInsert", () => {
  it("builds an INSERT OR REPLACE with quoted identifiers and ordered values", () => {
    const sql = rowInsert("content", { id: "1", title: "Hi", draft: 0 });
    assert.equal(sql, `INSERT OR REPLACE INTO "content" ("id","title","draft") VALUES ('1','Hi',0);`);
  });
  it("handles null column values", () => {
    const sql = rowInsert("team", { id: "t1", email: null });
    assert.equal(sql, `INSERT OR REPLACE INTO "team" ("id","email") VALUES ('t1',NULL);`);
  });
});

describe("tableInserts", () => {
  it("returns empty string for no rows", () => {
    assert.equal(tableInserts("content", []), "");
    assert.equal(tableInserts("content", null), "");
  });
  it("emits one statement per row", () => {
    const out = tableInserts("topics", [{ id: "a" }, { id: "b" }]);
    assert.equal(out.split("\n").filter(Boolean).length, 2);
  });
});

describe("buildSeedSql", () => {
  const fetched = {
    content: [{ id: "c1", slug: "hello", collection: "articles", title: "Hello", draft: 0 }],
    team: [{ id: "t1", name: "Jane", email: "jane@drbi.org" }],
  };
  it("includes a generated-file header and transaction wrapper", () => {
    const sql = buildSeedSql(fetched);
    assert.match(sql, /GENERATED/);
    assert.match(sql, /BEGIN TRANSACTION;/);
    assert.match(sql, /COMMIT;/);
  });
  it("includes rows for supplied public tables", () => {
    const sql = buildSeedSql(fetched);
    assert.match(sql, /INSERT OR REPLACE INTO "content"/);
    assert.match(sql, /INSERT OR REPLACE INTO "team"/);
  });
  it("appends synthetic rows for PII tables and never real ones", () => {
    const sql = buildSeedSql(fetched);
    // a synthetic admin user exists so admin screens render
    assert.match(sql, /INSERT OR REPLACE INTO "users"/);
    // and it is clearly a local/dev fake, not a real address
    assert.match(sql, /@example\.(test|com)|dev-local/i);
  });
  it("only ever inserts whitelisted public tables from fetched data", () => {
    // a caller passing a sensitive table in `fetched` must not get it serialized from real data
    const withPii = { ...fetched, event_waitlist: [{ id: 1, email: "real@person.com", phone: "555" }] };
    const sql = buildSeedSql(withPii);
    assert.ok(!sql.includes("real@person.com"), "real PII passed in must be ignored");
  });
});

describe("table config", () => {
  it("whitelist is public content only, excludes PII tables", () => {
    for (const t of ["users", "event_waitlist", "event_invoices", "comments", "subscribers"])
      assert.ok(!PUBLIC_TABLES.includes(t), `${t} must not be in the public whitelist`);
    for (const t of ["content", "events", "team", "categories", "topics"])
      assert.ok(PUBLIC_TABLES.includes(t), `${t} should be in the public whitelist`);
  });
  it("synthetic rows are provided for the sensitive tables admin UIs read", () => {
    assert.ok(Array.isArray(SYNTHETIC.users) && SYNTHETIC.users.length >= 1);
  });
});
