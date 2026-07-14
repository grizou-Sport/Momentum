import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260713192107_phase1_circle_invitations.sql", import.meta.url), "utf8");
const client = await readFile(new URL("../js/together.js", import.meta.url), "utf8");
const page = await readFile(new URL("../together.html", import.meta.url), "utf8");

test("phase 1 exposes only authenticated Circle RPCs", () => {
  for (const rpc of ["search_circle_user", "send_circle_invitation", "answer_circle_invitation", "end_circle_connection", "get_circle_overview"]) {
    assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}\\(`));
    assert.match(migration, new RegExp(`revoke all on function public\\.${rpc}\\([^;]+from public, anon`));
  }
});

test("phase 1 keeps sensitive tables read-only from the browser", () => {
  assert.match(migration, /alter table public\.invitations enable row level security/);
  assert.match(migration, /revoke all on public\.invitations, public\.connections, public\.blocked_users from anon, authenticated/);
  assert.doesNotMatch(client, /\.from\(["'](?:invitations|connections|blocked_users|circle_relationships)["']\)/);
  assert.doesNotMatch(client, /service_role/i);
});

test("Circle UI covers search, received, sent, removal and blocking", () => {
  for (const label of ["Inviter dans mon Cercle", "Invitations reçues", "Invitations envoyées", "Mon Cercle", "Retirer", "Bloquer"]) {
    assert.match(client, new RegExp(label));
  }
  assert.match(page, /id="circleInviteForm"/);
  assert.match(page, /type="email"/);
});

test("Moments UI hides empty categories and uses the finalization label", () => {
  assert.match(client, /if \(!moments\.length\) return "";/);
  assert.match(client, /\["planning", "À finaliser"/);
  assert.match(client, /PLANNING:"À finaliser"/);
  assert.doesNotMatch(client, /À organiser/);
});

test("database rules prevent duplicate open invitations and unordered connections", () => {
  assert.match(migration, /invitations_open_circle_pair_idx/);
  assert.match(migration, /unique \(user_low_id, user_high_id\)/);
  assert.match(migration, /check \(user_low_id < user_high_id\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
});
