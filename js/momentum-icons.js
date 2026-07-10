// ===================================================== // MOMENTUM —
BIBLIOTHÈQUE D’ICÔNES //
===================================================== // //
Responsabilité de ce fichier : // - construire le chemin d’un SVG ; // -
générer son HTML ; // - créer un élément réutilisable ; // - fournir une
icône de secours si nécessaire. // // Les sports et leurs clés d’icônes
restent définis dans : // js/momentum-sports.js // // Convention : //
icon: “running” // correspond à : // assets/icons/sports/running.svg //
// =====================================================

(function initializeMomentumIcons() { const DEFAULT_OPTIONS =
Object.freeze({ basePath: “assets/icons”, fallbackIcon:
“circle-ellipsis”, defaultSize: 24, });

let configuration = { …DEFAULT_OPTIONS, };

// =================================================== // UTILITAIRES
INTERNES // ===================================================

function sanitizeSegment(value) { return String(value || ““) .trim()
.toLowerCase() .replace(/[^a-z0-9-_]/g,”“); }

function normalizeSize(value) { const size = Number(value);

    return Number.isFinite(size) && size > 0
      ? size
      : configuration.defaultSize;

}

function escapeHtml(value) { return String(value ?? ““)
.replace(/&/g,”&“) .replace(/</g,”<“) .replace(/>/g,”>“) .replace(/”/g,
“"“) .replace(/’/g,”'“); }

function getSafeIconKey(iconKey) { return ( sanitizeSegment(iconKey) ||
sanitizeSegment(configuration.fallbackIcon) ); }

function getSafeCollection(collection) { return
sanitizeSegment(collection) || “sports”; }

// =================================================== // CONFIGURATION
// ===================================================

function configure(options = {}) { configuration = { …configuration,
…options, };

    configuration.basePath = String(
      configuration.basePath || DEFAULT_OPTIONS.basePath
    ).replace(/\/+$/, "");

    configuration.fallbackIcon =
      sanitizeSegment(configuration.fallbackIcon) ||
      DEFAULT_OPTIONS.fallbackIcon;

    configuration.defaultSize = normalizeSize(
      configuration.defaultSize
    );

    return getConfiguration();

}

function getConfiguration() { return Object.freeze({ …configuration, });
}

// =================================================== // CHEMINS //
===================================================

function getPath(iconKey, options = {}) { const collection =
getSafeCollection(options.collection); const safeIconKey =
getSafeIconKey(iconKey); const basePath = String( options.basePath ||
configuration.basePath ).replace(//+$/, ““);

    return `${basePath}/${collection}/${safeIconKey}.svg`;

}

function getSportPath(sportOrId, options = {}) { let iconKey =
sportOrId;

    if (
      window.MomentumSports &&
      typeof sportOrId === "string"
    ) {
      const sport = window.MomentumSports.resolve(sportOrId);
      iconKey = sport?.icon || sportOrId;
    } else if (
      sportOrId &&
      typeof sportOrId === "object"
    ) {
      iconKey = sportOrId.icon || sportOrId.id;
    }

    return getPath(iconKey, {
      ...options,
      collection: "sports",
    });

}

// =================================================== // GÉNÉRATION
HTML // ===================================================

function render(iconKey, options = {}) { const { collection = “sports”,
size = configuration.defaultSize, className = ““, alt =”“, title =”“,
decorative = !alt, loading =”lazy”, } = options;

    const normalizedSize = normalizeSize(size);
    const src = getPath(iconKey, { collection });
    const safeClassName = escapeHtml(className);
    const safeAlt = escapeHtml(alt);
    const safeTitle = escapeHtml(title);

    const accessibilityAttributes = decorative
      ? 'alt="" aria-hidden="true"'
      : `alt="${safeAlt}"`;

    const titleAttribute = safeTitle
      ? ` title="${safeTitle}"`
      : "";

    return `
      <img
        class="momentum-icon ${safeClassName}".trim()
        src="${src}"
        width="${normalizedSize}"
        height="${normalizedSize}"
        ${accessibilityAttributes}
        loading="${escapeHtml(loading)}"
        decoding="async"
        ${titleAttribute}
      >
    `.replace(
      'class="momentum-icon ${safeClassName}".trim()',
      `class="momentum-icon${safeClassName ? ` ${safeClassName}` : ""}"`
    );

}

function renderSport(sportOrId, options = {}) { let sport = sportOrId;

    if (
      window.MomentumSports &&
      typeof sportOrId === "string"
    ) {
      sport = window.MomentumSports.resolve(sportOrId);
    }

    const iconKey =
      sport && typeof sport === "object"
        ? sport.icon
        : sportOrId;

    const label =
      sport && typeof sport === "object"
        ? sport.label
        : "";

    return render(iconKey, {
      ...options,
      collection: "sports",
      alt:
        options.alt !== undefined
          ? options.alt
          : label,
      decorative:
        options.decorative !== undefined
          ? options.decorative
          : true,
    });

}

// =================================================== // CRÉATION DOM
// ===================================================

function create(iconKey, options = {}) { const { collection = “sports”,
size = configuration.defaultSize, className = ““, alt =”“, title =”“,
decorative = !alt, loading =”lazy”, fallback = true, } = options;

    const image = document.createElement("img");
    const normalizedSize = normalizeSize(size);

    image.className = [
      "momentum-icon",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    image.src = getPath(iconKey, { collection });
    image.width = normalizedSize;
    image.height = normalizedSize;
    image.loading = loading;
    image.decoding = "async";

    if (decorative) {
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
    } else {
      image.alt = alt;
    }

    if (title) {
      image.title = title;
    }

    if (fallback) {
      image.addEventListener(
        "error",
        () => {
          const fallbackPath = getPath(
            configuration.fallbackIcon,
            { collection }
          );

          if (image.src.endsWith(fallbackPath)) return;

          image.src = fallbackPath;
        },
        { once: true }
      );
    }

    return image;

}

function createSport(sportOrId, options = {}) { let sport = sportOrId;

    if (
      window.MomentumSports &&
      typeof sportOrId === "string"
    ) {
      sport = window.MomentumSports.resolve(sportOrId);
    }

    const iconKey =
      sport && typeof sport === "object"
        ? sport.icon
        : sportOrId;

    const label =
      sport && typeof sport === "object"
        ? sport.label
        : "";

    return create(iconKey, {
      ...options,
      collection: "sports",
      alt:
        options.alt !== undefined
          ? options.alt
          : label,
      decorative:
        options.decorative !== undefined
          ? options.decorative
          : true,
    });

}

// =================================================== // API PUBLIQUE
// ===================================================

window.MomentumIcons = Object.freeze({ configure, getConfiguration,
getPath, getSportPath, render, renderSport, create, createSport, });
})();
