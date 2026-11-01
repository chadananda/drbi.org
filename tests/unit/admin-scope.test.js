import { test } from "node:test";
import assert from "node:assert/strict";
import { scopedAdminRedirect } from "../../src/lib/admin-scope.js";

test("coordinator may use the Roundhouse admin", () => {
  assert.equal(scopedAdminRedirect("coordinator", "/admin/roundhouse"), null);
  assert.equal(scopedAdminRedirect("coordinator", "/admin/roundhouse/"), null);
});

test("coordinator is sent to Roundhouse from any other admin page", () => {
  for (const p of ["/admin", "/admin/", "/admin/calendar", "/admin/newsletter", "/admin/roundhouse-x"]) {
    assert.equal(scopedAdminRedirect("coordinator", p), "/admin/roundhouse", p);
  }
});

test("full staff roles are never scoped", () => {
  for (const r of ["author", "editor", "admin", "superadmin"]) assert.equal(scopedAdminRedirect(r, "/admin/calendar"), null);
});
