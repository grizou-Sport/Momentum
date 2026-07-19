import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("HOME recentre la fenêtre mobile de trois jours sur aujourd’hui", async () => {
  const [calendar, home, styles] = await Promise.all([
    read("js/home-calendar.js"),
    read("js/home.js"),
    read("css/home.css")
  ]);
  assert.match(calendar, /data-day-offset=/);
  assert.match(calendar, /centerLivingWeekOnToday/);
  assert.match(home, /pageshow.*centerLivingWeekOnToday/);
  assert.match(styles, /calc\(\(100% - 24px\) \/ 3\)/);
  assert.match(styles, /scroll-snap-align:center/);
});

test("la navigation utilise l’avatar pour ouvrir directement YOU", async () => {
  const [navigation, styles] = await Promise.all([
    read("js/navigation.js"),
    read("css/navigation.css")
  ]);
  assert.match(navigation, /data-momentum-user-avatar/);
  assert.match(navigation, /data-momentum-direct/);
  assert.match(navigation, /select\("display_name,avatar_url"\)/);
  assert.doesNotMatch(navigation, /Paramètres bientôt disponibles/);
  assert.match(styles, /\.momentum-user-avatar/);
});

test("YOU centralise le compte et recadre les avatars avant l’upload", async () => {
  const [you, passport, cropper, html] = await Promise.all([
    read("js/you.js"),
    read("js/you-passport.js"),
    read("js/avatar-cropper.js"),
    read("you.html")
  ]);
  assert.match(html, /data-you-section="account"/);
  assert.match(you, /function renderAccount/);
  assert.match(you, /from\("user_settings"\)\.upsert/);
  assert.match(you, /data-account-export/);
  assert.match(you, /data-account-logout/);
  assert.match(passport, /MomentumAvatarCropper\.open/);
  assert.match(cropper, /OUTPUT_SIZE = 512/);
  assert.match(cropper, /await waitForImage\(preview\)/);
  assert.match(cropper, /data-crop-confirm/);
  assert.match(cropper, /visiblePixels/);
  assert.match(cropper, /drawImage/);
});
