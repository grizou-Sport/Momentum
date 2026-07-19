import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = await Promise.all(["index.html", "progression.html", "you.html", "together.html"].map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
const navigation = await readFile(new URL("../js/navigation.js", import.meta.url), "utf8");
const navigationStyles = await readFile(new URL("../css/navigation.css", import.meta.url), "utf8");
const together = await readFile(new URL("../js/together.js", import.meta.url), "utf8");
const togetherPage = files[3];

test("every authenticated area uses the shared contextual rail", () => {
  for (const page of files) {
    assert.match(page, /css\/navigation\.css/);
    assert.match(page, /data-momentum-navigation/);
    assert.match(page, /js\/navigation\.js/);
    assert.doesNotMatch(page, /<header class="topbar">/);
  }
  for (const label of ["Home", "Progression", "You", "Together"]) {
    assert.match(navigation, new RegExp(label));
  }
});

test("mobile navigation exposes an accessible bottom bar with contextual cards", () => {
  assert.doesNotMatch(navigation, /aria-label="Ouvrir le menu"/);
  assert.match(navigation, /aria-controls="momentum-panel-/);
  assert.match(navigation, /data-mobile-section/);
  assert.match(navigationStyles, /inset:auto 8px calc\(8px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(navigationStyles, /transform-origin:center bottom/);
  assert.match(navigation, /event\.key === "Escape"/);
  assert.match(navigation, /menu-open/);
});

test("desktop navigation reveals compact contextual cards and keeps the rail translucent", () => {
  assert.match(navigation, /data-momentum-section/);
  assert.match(navigation, /data-momentum-panel/);
  assert.match(navigation, /mouseenter/);
  assert.match(navigationStyles, /background:rgba\(247,247,245,\.14\)/);
  assert.match(navigationStyles, /height:auto/);
  assert.match(navigationStyles, /visibility:hidden/);
  assert.match(navigationStyles, /body\.has-momentum-navigation\{\s*padding-left:0/);
});

test("the avatar opens YOU directly and account actions are no longer in the rail", async () => {
  const you = await readFile(new URL("../js/you.js", import.meta.url), "utf8");
  assert.match(navigation, /data-momentum-user-avatar/);
  assert.match(navigation, /data-momentum-direct/);
  assert.doesNotMatch(navigation, /aria-label="Paramètres, bientôt disponible"/);
  assert.doesNotMatch(navigation, /aria-label="Déconnexion"/);
  assert.match(you, /data-account-logout/);
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
