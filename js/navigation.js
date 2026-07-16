(function () {
  const body = document.body;
  const page = body.dataset.momentumPage || "home";
  const mount = document.querySelector("[data-momentum-navigation]");
  if (!mount) return;

  const icons = {
    home: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8"></path><path d="M5 10v11h14V10"></path><path d="M9 21v-7h6v7"></path></svg>',
    you: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
    together: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"></circle><circle cx="17" cy="10" r="2.5"></circle><path d="M3 20a6 6 0 0 1 12 0"></path><path d="M14 15a5 5 0 0 1 7 4.5"></path></svg>',
    logout: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v10"></path><path d="M6.3 5.7a8 8 0 1 0 11.4 0"></path></svg>',
    settings: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path></svg>',
    menu: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>',
    close: '<svg class="momentum-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>'
  };

  const sections = {
    home: {
      label: "Home",
      kicker: "Aujourd’hui",
      items: [
        ["today", "Aujourd’hui", "index.html#today"],
        ["journal", "Journal", "index.html#journal"],
        ["statistics", "Statistiques", "index.html#progression"]
      ]
    },
    you: {
      label: "You",
      kicker: "Ton histoire",
      items: [
        ["about", "Passeport", "you.html?section=about"],
        ["mission", "Mon Horizon", "you.html?section=mission"],
        ["sports", "Je vis pour", "you.html?section=sports"],
        ["wellbeing", "Mon équilibre", "you.html?section=wellbeing"],
        ["equipment", "Mon matériel", "you.html?section=equipment"]
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
  const initialSubsection = params.get("section") || params.get("view") || (page === "home" ? "today" : page === "you" ? "mission" : "circle");

  const railLink = (key, href, label) => `<a class="momentum-rail-link ${page === key ? "active" : ""}" data-momentum-section="${key}" href="${href}" aria-label="${label}" ${page === key ? 'aria-current="page"' : ""}>${icons[key]}</a>`;
  const contextPanel = ([sectionKey, menu]) => {
    const contextLinks = menu.items.map(([key, label, href, note]) => `<a class="momentum-context-link ${page === sectionKey && initialSubsection === key ? "active" : ""}" data-momentum-subsection="${key}" href="${href}" ${note ? 'aria-disabled="true"' : ""}><span>${label}</span>${note ? `<span class="momentum-context-note">${note}</span>` : ""}</a>`).join("");
    return `<aside class="momentum-context-panel ${page === sectionKey ? "current" : ""}" data-momentum-panel="${sectionKey}" aria-label="Navigation ${menu.label}">
      <button class="momentum-panel-close" type="button" aria-label="Fermer le menu">${icons.close}</button>
      <div class="momentum-context-heading"><span class="momentum-context-kicker">${menu.kicker}</span><strong>${menu.label}</strong></div>
      <nav class="momentum-context-nav">${contextLinks}</nav>
    </aside>`;
  };

  mount.className = "momentum-navigation";
  mount.innerHTML = `
    <div class="momentum-mobile-bar">
      <button class="momentum-menu-toggle" type="button" aria-label="Ouvrir le menu" aria-expanded="false">${icons.menu}</button>
      <span class="momentum-mobile-brand"><span class="momentum-nav-brand">M</span>Momentum</span>
      <span class="momentum-mobile-balance" aria-hidden="true"></span>
    </div>
    <aside class="momentum-rail" aria-label="Navigation principale">
      <a class="momentum-nav-brand" href="index.html" aria-label="Momentum, accueil">M</a>
      ${railLink("home", "index.html", "Home")}
      ${railLink("you", "you.html", "You")}
      ${railLink("together", "together.html", "Together")}
      <span class="momentum-rail-spacer"></span>
      <button id="${page === "home" ? "homeLogoutBtn" : "logoutBtn"}" class="momentum-rail-link momentum-nav-logout" type="button" aria-label="Déconnexion" title="Déconnexion">${icons.logout}</button>
      <span class="momentum-rail-link" aria-label="Paramètres, bientôt disponible" aria-disabled="true">${icons.settings}</span>
    </aside>
    ${Object.entries(sections).map(contextPanel).join("")}
    <button class="momentum-mobile-scrim" type="button" aria-label="Fermer le menu"></button>`;

  body.classList.add("has-momentum-navigation");

  const toggle = mount.querySelector(".momentum-menu-toggle");
  const closeButtons = mount.querySelectorAll(".momentum-panel-close,.momentum-mobile-scrim");
  const closeMenu = () => {
    mount.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
  };
  toggle.addEventListener("click", () => {
    const open = mount.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
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

  window.MomentumNavigation = { setSubsection, closeMenu };
})();
