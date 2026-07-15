import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = await Promise.all(["index.html", "you.html", "together.html"].map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
const navigation = await readFile(new URL("../js/navigation.js", import.meta.url), "utf8");
const together = await readFile(new URL("../js/together.js", import.meta.url), "utf8");
const togetherPage = files[2];

test("every authenticated area uses the shared contextual rail", () => {
  for (const page of files) {
    assert.match(page, /css\/navigation\.css/);
    assert.match(page, /data-momentum-navigation/);
    assert.match(page, /js\/navigation\.js/);
    assert.doesNotMatch(page, /<header class="topbar">/);
  }
  for (const label of ["Home", "You", "Together", "Paramètres", "Déconnexion"]) {
    assert.match(navigation, new RegExp(label));
  }
});

test("mobile navigation exposes an accessible hamburger drawer", () => {
  assert.match(navigation, /aria-label="Ouvrir le menu"/);
  assert.match(navigation, /aria-expanded="false"/);
  assert.match(navigation, /event\.key === "Escape"/);
  assert.match(navigation, /menu-open/);
});

test("Moment form follows visibility then Circle participant selection", () => {
  assert.ok(togetherPage.indexOf('id="momentVisibility"') < togetherPage.indexOf('id="momentParticipantPicker"'));
  assert.match(togetherPage, /value="PRIVATE">Privé/);
  assert.match(togetherPage, /value="CIRCLE">Cercle/);
  assert.match(togetherPage, /value="CLUB">Club/);
  assert.match(together, /syncMomentParticipants/);
  assert.match(together, /invitation_status: "PENDING"/);
});

test("Moment owners can edit, duplicate and delete while participants can answer", () => {
  for (const label of ["Modifier", "Dupliquer", "Supprimer", "Accepter", "Refuser", "Participants"]) {
    assert.match(together, new RegExp(label));
  }
  assert.match(together, /function openMomentForm/);
  assert.match(together, /async function deleteMoment/);
  assert.match(together, /async function answerMomentInvitation/);
});
