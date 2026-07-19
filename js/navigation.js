(function () {
  const body = document.body;
  const page = body.dataset.momentumPage || "home";
  const mount = document.querySelector("[data-momentum-navigation]");
  if (!mount) return;

  const icons = {
    home: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8"></path><path d="M5 10v11h14V10"></path><path d="M9 21v-7h6v7"></path></svg>',
    progression: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9"></path><path d="M10 19V5"></path><path d="M16 19v-7"></path><path d="M22 19V3"></path></svg>',
    you: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
    together: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"></circle><circle cx="17" cy="10" r="2.5"></circle><path d="M3 20a6 6 0 0 1 12 0"></path><path d="M14 15a5 5 0 0 1 7 4.5"></path></svg>',
    close: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>'
  };

  const sections = {
    home: {
      label: "Home",
      kicker: "Aujourd’hui",
      items: [
        ["today", "Aujourd’hui", "index.html#today"],
        ["journal", "Journal", "index.html#journal"],
        ["flow", "Flow", "index.html#flow"]
      ]
    },
    progression: {
      label: "Progression",
      kicker: "Ton évolution",
      items: [
        ["volume", "Volume hebdomadaire", "progression.html#volume"],
        ["sports", "Répartition sportive", "progression.html#sports"],
        ["charge", "Charge & forme", "progression.html#charge"],
        ["bien-etre", "Bien-être", "progression.html#bien-etre"]
      ]
    },
    you: {
      label: "You",
      kicker: "Tout ce qui te concerne",
      items: [
        ["about", "Mon profil", "you.html?section=about"],
        ["mission", "Objectifs", "you.html?section=mission"],
        ["sports", "Je vis pour", "you.html?section=sports"],
        ["wellbeing", "Mon équilibre", "you.html?section=wellbeing"],
        ["equipment", "Mon matériel", "you.html?section=equipment"],
        ["account", "Mon compte", "you.html?section=account"]
      ]
    },
    together: {
      label: "Together",
      kicker: "Vivre ensemble",
      items: [
        ["feed", "Fil d’actualité", "#", "Bientôt"],
        ["moments", "Mes Moments", "together.html?view=moments"],
        ["circle", "Cercle", "together.html?view=circle"],
        ["clubs", "Clubs", "together.html?view=clubs"],
        ["invitations", "Invitations", "together.html?view=invitations"]
      ]
    }
  };

  const params = new URLSearchParams(window.location.search);
  const initialSubsection = params.get("section") || params.get("view") || (page === "home" ? "today" : page === "progression" ? "volume" : page === "you" ? "mission" : "circle");

  const railLink = (key, href, label) => `<a class="momentum-rail-link ${page === key ? "active" : ""}" data-momentum-section="${key}" href="${href}" aria-label="${label}" aria-controls="momentum-panel-${key}" aria-expanded="false" ${page === key ? 'aria-current="page"' : ""}>${icons[key]}</a>`;
  const youRailLink = () => `<a class="momentum-rail-link momentum-user-link ${page === "you" ? "active" : ""}" data-momentum-section="you" data-momentum-direct href="you.html" aria-label="Ouvrir YOU" title="YOU" ${page === "you" ? 'aria-current="page"' : ""}><span class="momentum-user-avatar" data-momentum-user-avatar>${icons.you}</span></a>`;
  const contextPanel = ([sectionKey, menu]) => {
    const contextLinks = menu.items.map(([key, label, href, note]) => `<a class="momentum-context-link ${page === sectionKey && initialSubsection === key ? "active" : ""}" data-momentum-subsection="${key}" href="${href}" ${note ? 'aria-disabled="true"' : ""}><span>${label}</span>${note ? `<span class="momentum-context-note">${note}</span>` : ""}</a>`).join("");
    return `<aside id="momentum-panel-${sectionKey}" class="momentum-context-panel ${page === sectionKey ? "current" : ""}" data-momentum-panel="${sectionKey}" aria-label="Navigation ${menu.label}">
      <button class="momentum-panel-close" type="button" aria-label="Fermer le menu">${icons.close}</button>
      <div class="momentum-context-heading"><span class="momentum-context-kicker">${menu.kicker}</span><strong>${menu.label}</strong></div>
      <nav class="momentum-context-nav">${contextLinks}</nav>
    </aside>`;
  };

  mount.className = "momentum-navigation";
  mount.innerHTML = `
    <aside class="momentum-rail" aria-label="Navigation principale">
      <a class="momentum-nav-brand" href="index.html" aria-label="MOMENTUM, accueil">△</a>
      ${railLink("home", "index.html", "Home")}
      ${railLink("together", "together.html", "Together")}
      ${railLink("progression", "progression.html", "Progression")}
      ${youRailLink()}
      <span class="momentum-rail-spacer"></span>
    </aside>
    ${Object.entries(sections).map(contextPanel).join("")}
    <button class="momentum-mobile-scrim" type="button" aria-label="Fermer le menu"></button>`;

  body.classList.add("has-momentum-navigation");

  const rail = mount.querySelector(".momentum-rail");
  let sampledPhotoTheme = null;
  let themeFrame = 0;
  let photoResizeTimer = 0;

  function declaredThemeAtViewportCenter() {
    const x = Math.min(36, window.innerWidth / 2);
    const y = Math.max(1, Math.min(window.innerHeight - 1, window.innerHeight / 2));
    const section = document.elementsFromPoint(x, y)
      .filter((element) => !mount.contains(element))
      .map((element) => element.closest("[data-nav-theme]"))
      .find(Boolean);
    if (!section) return "dark";
    if (section.hasAttribute("data-nav-luminance") && sampledPhotoTheme) return sampledPhotoTheme;
    return section.dataset.navTheme === "light" ? "light" : "dark";
  }

  function updateNavigationTheme() {
    themeFrame = 0;
    const theme = declaredThemeAtViewportCenter();
    mount.dataset.theme = theme;
    rail?.setAttribute("data-theme", theme);
  }

  function scheduleThemeUpdate() {
    if (!themeFrame) themeFrame = window.requestAnimationFrame(updateNavigationTheme);
  }

  function analysePhotographicSection(section, force = false) {
    const rect = section.getBoundingClientRect();
    const previousWidth = Number(section.dataset.navSampleWidth || 0);
    const previousHeight = Number(section.dataset.navSampleHeight || 0);
    if (!force && previousWidth && Math.abs(rect.width - previousWidth) < 48 && Math.abs(rect.height - previousHeight) < 48) return;
    section.dataset.navSampleWidth = String(Math.round(rect.width));
    section.dataset.navSampleHeight = String(Math.round(rect.height));
    const imageUrl = getComputedStyle(section).backgroundImage.match(/url\(["']?(.+?)["']?\)/)?.[1];
    if (!imageUrl) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const sampleWidth = Math.max(1, Math.min(72, Math.round(rect.width)));
        const sampleHeight = Math.max(1, Math.min(360, Math.round(rect.height)));
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(24, sampleWidth);
        canvas.height = Math.min(120, sampleHeight);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
        const renderedWidth = image.naturalWidth * scale;
        const renderedHeight = image.naturalHeight * scale;
        const cropX = Math.max(0, (renderedWidth - rect.width) / (2 * scale));
        const cropY = Math.max(0, (renderedHeight - rect.height) / (2 * scale));
        context.drawImage(image, cropX, cropY, sampleWidth / scale, sampleHeight / scale, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let luminance = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index] / 255;
          const green = pixels[index + 1] / 255;
          const blue = pixels[index + 2] / 255;
          luminance += .2126 * red + .7152 * green + .0722 * blue;
        }
        sampledPhotoTheme = luminance / (pixels.length / 4) < .52 ? "light" : "dark";
      } catch (_error) {
        sampledPhotoTheme = section.dataset.navTheme === "light" ? "light" : "dark";
      }
      scheduleThemeUpdate();
    };
    image.onerror = () => {
      sampledPhotoTheme = section.dataset.navTheme === "light" ? "light" : "dark";
      scheduleThemeUpdate();
    };
    image.src = new URL(imageUrl, window.location.href).href;
  }

  document.querySelectorAll("[data-nav-luminance]").forEach(analysePhotographicSection);
  document.querySelectorAll("[data-nav-luminance]").forEach((section) => {
    new MutationObserver(() => analysePhotographicSection(section, true)).observe(section, { attributes:true, attributeFilter:["class","style"] });
  });
  window.addEventListener("scroll", scheduleThemeUpdate, { passive: true });
  window.addEventListener("resize", () => {
    scheduleThemeUpdate();
    window.clearTimeout(photoResizeTimer);
    photoResizeTimer = window.setTimeout(() => document.querySelectorAll("[data-nav-luminance]").forEach(analysePhotographicSection), 180);
  });
  updateNavigationTheme();

  const closeButtons = mount.querySelectorAll(".momentum-panel-close,.momentum-mobile-scrim");
  const closeMenu = () => {
    mount.classList.remove("menu-open");
    mount.removeAttribute("data-mobile-section");
    mount.querySelectorAll("[data-momentum-section]").forEach((link) => link.setAttribute("aria-expanded", "false"));
  };
  closeButtons.forEach((button) => button.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });

  const desktop = window.matchMedia("(min-width: 901px)");
  let panelCloseTimer;
  const closeDesktopPanel = () => {
    window.clearTimeout(panelCloseTimer);
    mount.removeAttribute("data-open-section");
  };
  const scheduleDesktopPanelClose = () => {
    window.clearTimeout(panelCloseTimer);
    panelCloseTimer = window.setTimeout(closeDesktopPanel, 120);
  };
  const openDesktopPanel = (key, trigger) => {
    if (!desktop.matches) return;
    window.clearTimeout(panelCloseTimer);
    const panel = mount.querySelector(`[data-momentum-panel="${key}"]`);
    if (!panel) return;
    const triggerRect = trigger.getBoundingClientRect();
    const maxTop = Math.max(12, window.innerHeight - panel.scrollHeight - 12);
    panel.style.setProperty("--momentum-panel-top", `${Math.min(triggerRect.top, maxTop)}px`);
    mount.dataset.openSection = key;
  };

  mount.querySelectorAll("[data-momentum-section]").forEach((link) => {
    link.addEventListener("mouseenter", () => openDesktopPanel(link.dataset.momentumSection, link));
    link.addEventListener("focus", () => openDesktopPanel(link.dataset.momentumSection, link));
    link.addEventListener("mouseleave", scheduleDesktopPanelClose);
    link.addEventListener("click", (event) => {
      if (desktop.matches) return;
      if (link.hasAttribute("data-momentum-direct")) return;
      event.preventDefault();
      const key = link.dataset.momentumSection;
      const willOpen = !mount.classList.contains("menu-open") || mount.dataset.mobileSection !== key;
      closeMenu();
      if (!willOpen) return;
      mount.dataset.mobileSection = key;
      mount.classList.add("menu-open");
      link.setAttribute("aria-expanded", "true");
    });
  });
  mount.querySelectorAll("[data-momentum-panel]").forEach((panel) => {
    panel.addEventListener("mouseenter", () => window.clearTimeout(panelCloseTimer));
    panel.addEventListener("mouseleave", scheduleDesktopPanelClose);
  });
  mount.addEventListener("focusout", (event) => {
    if (!mount.contains(event.relatedTarget)) scheduleDesktopPanelClose();
  });
  window.addEventListener("resize", closeDesktopPanel);

  function setSubsection(key) {
    mount.querySelectorAll("[data-momentum-subsection]").forEach((link) => {
      const active = link.dataset.momentumSubsection === key;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  mount.querySelectorAll("[data-momentum-subsection]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (link.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        return;
      }
      const linkSection = link.closest("[data-momentum-panel]")?.dataset.momentumPanel;
      if (linkSection !== page) return;
      const key = link.dataset.momentumSubsection;
      if (page === "you") {
        event.preventDefault();
        document.querySelector(`[data-you-section="${key}"]`)?.click();
        window.history.replaceState({}, "", `you.html?section=${key}`);
        setSubsection(key);
        closeMenu();
      } else if (page === "together" && window.MomentumTogetherNavigation) {
        event.preventDefault();
        window.MomentumTogetherNavigation.open(key);
        setSubsection(key);
        closeMenu();
      } else if (page === "home") {
        setSubsection(key);
        closeMenu();
      }
    });
  });

  if (page === "you" && initialSubsection !== "mission") {
    window.setTimeout(() => document.querySelector(`[data-you-section="${initialSubsection}"]`)?.click(), 0);
  }

  function initials(name) {
    return String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "YOU";
  }

  async function hydrateUserAvatar() {
    const avatar = mount.querySelector("[data-momentum-user-avatar]");
    if (!avatar || !window.momentumDB) return;

    try {
      const { data:sessionData } = await window.momentumDB.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;
      const { data:passport, error } = await window.momentumDB
        .from("passports")
        .select("display_name,avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;

      avatar.replaceChildren();
      if (passport?.avatar_url) {
        const image = document.createElement("img");
        image.src = passport.avatar_url;
        image.alt = "";
        avatar.append(image);
      } else {
        avatar.textContent = initials(passport?.display_name || user.email);
      }
    } catch (error) {
      console.warn("Navigation : avatar momentanément indisponible.", error);
    }
  }

  window.addEventListener("load", hydrateUserAvatar, { once:true });
  window.addEventListener("momentum:avatar-updated", hydrateUserAvatar);

  window.MomentumNavigation = { setSubsection, closeMenu };
})();
