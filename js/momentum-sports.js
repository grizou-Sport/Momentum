// =====================================================
// MOMENTUM — RÉFÉRENTIEL DES SPORTS
// =====================================================
//
// Source unique des sports pour :
// - YOU
// - Mon Horizon
// - HOME
// - Imports .FIT
// - Futures connexions Garmin / COROS / Strava
//
// Règle fondamentale :
// Les identifiants techniques "id" ne doivent jamais être renommés.
// Les labels, icônes et alias peuvent évoluer librement.
//
// =====================================================

(function initializeMomentumSports() {
  const CATEGORIES = [
    {
      id: "endurance",
      label: "Endurance",
      icon: "activity",
      order: 10,
    },
    {
      id: "mountain",
      label: "Montagne",
      icon: "mountain",
      order: 20,
    },
    {
      id: "water",
      label: "Sports nautiques",
      icon: "waves",
      order: 30,
    },
    {
      id: "strength_fitness",
      label: "Force & Fitness",
      icon: "dumbbell",
      order: 40,
    },
    {
      id: "racket",
      label: "Sports de raquette",
      icon: "circle-dot",
      order: 50,
    },
    {
      id: "team",
      label: "Sports collectifs",
      icon: "users",
      order: 60,
    },
    {
      id: "combat",
      label: "Sports de combat",
      icon: "swords",
      order: 70,
    },
    {
      id: "precision",
      label: "Précision & loisirs",
      icon: "target",
      order: 80,
    },
    {
      id: "movement",
      label: "Mouvement & glisse",
      icon: "move",
      order: 90,
    },
    {
      id: "other",
      label: "Autres",
      icon: "circle-ellipsis",
      order: 100,
    },
  ];

  const SPORTS = [
    // =================================================
    // ENDURANCE
    // =================================================

    {
      id: "running",
      label: "Course à pied",
      category: "endurance",
      parent: null,
      icon: "running",
      aliases: [
        "run",
        "running",
        "course",
        "course à pied",
        "road running",
        "outdoor running",
      ],
      traits: ["endurance", "cardio", "outdoor", "gps"],
      active: true,
      order: 10,
    },
    {
      id: "trail_running",
      label: "Trail",
      category: "endurance",
      parent: "running",
      icon: "trail-running",
      aliases: [
        "trail",
        "trail running",
        "mountain running",
        "course en sentier",
      ],
      traits: ["endurance", "cardio", "outdoor", "gps", "mountain"],
      active: true,
      order: 20,
    },
    {
      id: "walking",
      label: "Marche",
      category: "endurance",
      parent: null,
      icon: "walking",
      aliases: ["walk", "walking", "marche", "promenade"],
      traits: ["outdoor", "gps", "low_impact"],
      active: true,
      order: 30,
    },
    {
      id: "hiking",
      label: "Randonnée",
      category: "endurance",
      parent: "walking",
      icon: "hiking",
      aliases: ["hike", "hiking", "randonnée", "randonnee"],
      traits: ["endurance", "outdoor", "gps", "mountain"],
      active: true,
      order: 40,
    },
    {
      id: "trekking",
      label: "Trekking",
      category: "endurance",
      parent: "hiking",
      icon: "trekking",
      aliases: ["trek", "trekking", "long distance hiking"],
      traits: ["endurance", "outdoor", "gps", "adventure"],
      active: true,
      order: 50,
    },
    {
      id: "cycling",
      label: "Vélo route",
      category: "endurance",
      parent: null,
      icon: "cycling",
      aliases: [
        "vélo",
        "velo",
        "vélo route",
        "cycling",
        "ride",
        "road cycling",
        "road bike",
      ],
      traits: ["endurance", "cardio", "outdoor", "gps", "equipment"],
      active: true,
      order: 60,
    },
    {
      id: "gravel_cycling",
      label: "Gravel",
      category: "endurance",
      parent: "cycling",
      icon: "gravel",
      aliases: ["gravel", "gravel ride", "gravel cycling"],
      traits: ["endurance", "cardio", "outdoor", "gps", "adventure"],
      active: true,
      order: 70,
    },
    {
      id: "mountain_biking",
      label: "VTT",
      category: "endurance",
      parent: "cycling",
      icon: "mountain-bike",
      aliases: [
        "vtt",
        "mtb",
        "mountain biking",
        "mountain bike",
        "vélo tout terrain",
      ],
      traits: ["endurance", "cardio", "outdoor", "gps", "mountain"],
      active: true,
      order: 80,
    },
    {
      id: "electric_cycling",
      label: "Vélo électrique",
      category: "endurance",
      parent: "cycling",
      icon: "electric-bike",
      aliases: [
        "e-bike",
        "ebike",
        "electric bike",
        "electric cycling",
        "vélo électrique",
      ],
      traits: ["outdoor", "gps", "equipment"],
      active: true,
      order: 90,
    },
    {
      id: "bikepacking",
      label: "Bikepacking",
      category: "endurance",
      parent: "cycling",
      icon: "bikepacking",
      aliases: ["bikepacking", "bike packing", "bicycle touring"],
      traits: ["endurance", "outdoor", "gps", "adventure"],
      active: true,
      order: 100,
    },
    {
      id: "indoor_cycling",
      label: "Vélo indoor",
      category: "endurance",
      parent: "cycling",
      icon: "indoor-cycling",
      aliases: [
        "indoor cycling",
        "virtual ride",
        "spinning",
        "home trainer",
        "zwift",
      ],
      traits: ["endurance", "cardio", "indoor", "equipment"],
      active: true,
      order: 110,
    },
    {
      id: "swimming",
      label: "Natation",
      category: "endurance",
      parent: null,
      icon: "swimming",
      aliases: [
        "swim",
        "swimming",
        "natation",
        "pool swimming",
        "lap swimming",
      ],
      traits: ["endurance", "cardio", "water", "low_impact"],
      active: true,
      order: 120,
    },
    {
      id: "open_water_swimming",
      label: "Natation en eau libre",
      category: "endurance",
      parent: "swimming",
      icon: "open-water-swimming",
      aliases: [
        "open water",
        "open water swimming",
        "eau libre",
        "natation eau libre",
      ],
      traits: ["endurance", "cardio", "outdoor", "water", "gps"],
      active: true,
      order: 130,
    },
    {
      id: "triathlon",
      label: "Triathlon",
      category: "endurance",
      parent: null,
      icon: "triathlon",
      aliases: ["triathlon", "ironman"],
      traits: ["endurance", "cardio", "outdoor", "multisport", "gps"],
      active: true,
      order: 140,
    },
    {
      id: "duathlon",
      label: "Duathlon",
      category: "endurance",
      parent: null,
      icon: "duathlon",
      aliases: ["duathlon"],
      traits: ["endurance", "cardio", "outdoor", "multisport", "gps"],
      active: true,
      order: 150,
    },
    {
      id: "swimrun",
      label: "Swimrun",
      category: "endurance",
      parent: null,
      icon: "swimrun",
      aliases: ["swimrun", "swim run"],
      traits: ["endurance", "cardio", "outdoor", "water", "multisport"],
      active: true,
      order: 160,
    },

    // =================================================
    // MONTAGNE & HIVER
    // =================================================

    {
      id: "mountaineering",
      label: "Alpinisme",
      category: "mountain",
      parent: null,
      icon: "mountaineering",
      aliases: ["alpinisme", "mountaineering"],
      traits: ["outdoor", "mountain", "adventure", "gps"],
      active: true,
      order: 10,
    },
    {
      id: "climbing",
      label: "Escalade",
      category: "mountain",
      parent: null,
      icon: "climbing",
      aliases: ["climbing", "rock climbing", "escalade"],
      traits: ["strength", "technical"],
      active: true,
      order: 20,
    },
    {
      id: "via_ferrata",
      label: "Via ferrata",
      category: "mountain",
      parent: "climbing",
      icon: "via-ferrata",
      aliases: ["via ferrata"],
      traits: ["outdoor", "mountain", "technical", "adventure"],
      active: true,
      order: 30,
    },
    {
      id: "alpine_skiing",
      label: "Ski alpin",
      category: "mountain",
      parent: null,
      icon: "alpine-skiing",
      aliases: [
        "ski",
        "ski alpin",
        "alpine skiing",
        "downhill skiing",
        "resort skiing",
      ],
      traits: ["outdoor", "mountain", "winter", "gps"],
      active: true,
      order: 40,
    },
    {
      id: "ski_touring",
      label: "Ski de randonnée",
      category: "mountain",
      parent: "alpine_skiing",
      icon: "ski-touring",
      aliases: [
        "ski touring",
        "backcountry skiing",
        "ski de randonnée",
        "ski de randonnee",
      ],
      traits: ["endurance", "outdoor", "mountain", "winter", "gps"],
      active: true,
      order: 50,
    },
    {
      id: "cross_country_skiing",
      label: "Ski de fond",
      category: "mountain",
      parent: "alpine_skiing",
      icon: "cross-country-skiing",
      aliases: [
        "cross country skiing",
        "nordic skiing",
        "ski de fond",
        "ski nordique",
      ],
      traits: ["endurance", "cardio", "outdoor", "winter", "gps"],
      active: true,
      order: 60,
    },
    {
      id: "snowboarding",
      label: "Snowboard",
      category: "mountain",
      parent: null,
      icon: "snowboarding",
      aliases: ["snowboard", "snowboarding"],
      traits: ["outdoor", "mountain", "winter", "gps"],
      active: true,
      order: 70,
    },
    {
      id: "snowshoeing",
      label: "Raquettes",
      category: "mountain",
      parent: "walking",
      icon: "snowshoeing",
      aliases: ["snowshoe", "snowshoeing", "raquettes", "raquette à neige"],
      traits: ["endurance", "outdoor", "mountain", "winter", "gps"],
      active: true,
      order: 80,
    },
    {
      id: "ice_climbing",
      label: "Cascade de glace",
      category: "mountain",
      parent: "climbing",
      icon: "ice-climbing",
      aliases: ["ice climbing", "cascade de glace"],
      traits: ["outdoor", "mountain", "winter", "technical", "strength"],
      active: true,
      order: 90,
    },

    // =================================================
    // SPORTS NAUTIQUES
    // =================================================

    {
      id: "surfing",
      label: "Surf",
      category: "water",
      parent: null,
      icon: "surfing",
      aliases: ["surf", "surfing"],
      traits: ["outdoor", "water", "balance"],
      active: true,
      order: 10,
    },
    {
      id: "kitesurfing",
      label: "Kitesurf",
      category: "water",
      parent: null,
      icon: "kitesurfing",
      aliases: ["kitesurf", "kite surf", "kitesurfing"],
      traits: ["outdoor", "water", "wind", "technical"],
      active: true,
      order: 20,
    },
    {
      id: "wing_foil",
      label: "Wingfoil",
      category: "water",
      parent: null,
      icon: "wing-foil",
      aliases: ["wingfoil", "wing foil", "wing foiling"],
      traits: ["outdoor", "water", "wind", "technical"],
      active: true,
      order: 30,
    },
    {
      id: "windsurfing",
      label: "Planche à voile",
      category: "water",
      parent: null,
      icon: "windsurfing",
      aliases: ["windsurf", "windsurfing", "planche à voile"],
      traits: ["outdoor", "water", "wind", "technical"],
      active: true,
      order: 40,
    },
    {
      id: "stand_up_paddle",
      label: "Stand Up Paddle",
      category: "water",
      parent: null,
      icon: "stand-up-paddle",
      aliases: [
        "sup",
        "stand up paddle",
        "stand-up paddle",
        "paddle board",
      ],
      traits: ["outdoor", "water", "balance"],
      active: true,
      order: 50,
    },
    {
      id: "canoeing",
      label: "Canoë",
      category: "water",
      parent: null,
      icon: "canoeing",
      aliases: ["canoe", "canoeing", "canoë", "canoe"],
      traits: ["endurance", "outdoor", "water", "gps"],
      active: true,
      order: 60,
    },
    {
      id: "kayaking",
      label: "Kayak",
      category: "water",
      parent: null,
      icon: "kayaking",
      aliases: ["kayak", "kayaking"],
      traits: ["endurance", "outdoor", "water", "gps"],
      active: true,
      order: 70,
    },
    {
      id: "rowing",
      label: "Aviron",
      category: "water",
      parent: null,
      icon: "rowing",
      aliases: ["row", "rowing", "aviron"],
      traits: ["endurance", "strength", "water"],
      active: true,
      order: 80,
    },
    {
      id: "sailing",
      label: "Voile",
      category: "water",
      parent: null,
      icon: "sailing",
      aliases: ["sailing", "voile"],
      traits: ["outdoor", "water", "wind", "technical"],
      active: true,
      order: 90,
    },
    {
      id: "diving",
      label: "Plongée",
      category: "water",
      parent: null,
      icon: "diving",
      aliases: ["diving", "scuba diving", "plongée", "plongee"],
      traits: ["outdoor", "water", "technical"],
      active: true,
      order: 100,
    },

    // =================================================
    // FORCE & FITNESS
    // =================================================

    {
      id: "strength_training",
      label: "Musculation",
      category: "strength_fitness",
      parent: null,
      icon: "strength-training",
      aliases: [
        "musculation",
        "strength",
        "strength training",
        "weight training",
        "weights",
      ],
      traits: ["strength", "indoor"],
      active: true,
      order: 10,
    },
    {
      id: "fitness",
      label: "Fitness",
      category: "strength_fitness",
      parent: null,
      icon: "fitness",
      aliases: ["fitness", "workout", "gym"],
      traits: ["cardio", "strength", "indoor"],
      active: true,
      order: 20,
    },
    {
      id: "crossfit",
      label: "CrossFit",
      category: "strength_fitness",
      parent: "fitness",
      icon: "crossfit",
      aliases: ["crossfit", "cross fit"],
      traits: ["cardio", "strength", "indoor", "competition"],
      active: true,
      order: 30,
    },
    {
      id: "hyrox",
      label: "Hyrox",
      category: "strength_fitness",
      parent: "fitness",
      icon: "hyrox",
      aliases: ["hyrox"],
      traits: ["endurance", "cardio", "strength", "competition"],
      active: true,
      order: 40,
    },
    {
      id: "weightlifting",
      label: "Haltérophilie",
      category: "strength_fitness",
      parent: "strength_training",
      icon: "weightlifting",
      aliases: ["weightlifting", "olympic lifting", "haltérophilie"],
      traits: ["strength", "technical", "indoor"],
      active: true,
      order: 50,
    },
    {
      id: "street_workout",
      label: "Street Workout",
      category: "strength_fitness",
      parent: "strength_training",
      icon: "street-workout",
      aliases: ["street workout", "calisthenics", "calisthénie"],
      traits: ["strength", "outdoor", "bodyweight"],
      active: true,
      order: 60,
    },
    {
      id: "pilates",
      label: "Pilates",
      category: "strength_fitness",
      parent: null,
      icon: "pilates",
      aliases: ["pilates"],
      traits: ["mobility", "strength", "low_impact"],
      active: true,
      order: 70,
    },
    {
      id: "yoga",
      label: "Yoga",
      category: "strength_fitness",
      parent: null,
      icon: "yoga",
      aliases: ["yoga"],
      traits: ["mobility", "wellbeing", "low_impact"],
      active: true,
      order: 80,
    },
    {
      id: "mobility",
      label: "Mobilité",
      category: "strength_fitness",
      parent: null,
      icon: "mobility",
      aliases: ["mobility", "mobilité", "stretching", "étirements"],
      traits: ["mobility", "recovery", "low_impact"],
      active: true,
      order: 90,
    },

    // =================================================
    // SPORTS DE RAQUETTE
    // =================================================

    {
      id: "tennis",
      label: "Tennis",
      category: "racket",
      parent: null,
      icon: "tennis",
      aliases: ["tennis"],
      traits: ["cardio", "racket", "competition"],
      active: true,
      order: 10,
    },
    {
      id: "padel",
      label: "Padel",
      category: "racket",
      parent: null,
      icon: "padel",
      aliases: ["padel", "padel tennis"],
      traits: ["cardio", "racket", "competition"],
      active: true,
      order: 20,
    },
    {
      id: "badminton",
      label: "Badminton",
      category: "racket",
      parent: null,
      icon: "badminton",
      aliases: ["badminton"],
      traits: ["cardio", "racket", "competition"],
      active: true,
      order: 30,
    },
    {
      id: "squash",
      label: "Squash",
      category: "racket",
      parent: null,
      icon: "squash",
      aliases: ["squash"],
      traits: ["cardio", "racket", "indoor", "competition"],
      active: true,
      order: 40,
    },
    {
      id: "table_tennis",
      label: "Tennis de table",
      category: "racket",
      parent: null,
      icon: "table-tennis",
      aliases: ["table tennis", "ping pong", "ping-pong", "tennis de table"],
      traits: ["racket", "indoor", "competition"],
      active: true,
      order: 50,
    },

    // =================================================
    // SPORTS COLLECTIFS
    // =================================================

    {
      id: "football",
      label: "Football",
      category: "team",
      parent: null,
      icon: "football",
      aliases: ["football", "soccer"],
      traits: ["cardio", "team", "competition"],
      active: true,
      order: 10,
    },
    {
      id: "futsal",
      label: "Futsal",
      category: "team",
      parent: "football",
      icon: "futsal",
      aliases: ["futsal", "indoor soccer"],
      traits: ["cardio", "team", "indoor", "competition"],
      active: true,
      order: 20,
    },
    {
      id: "basketball",
      label: "Basketball",
      category: "team",
      parent: null,
      icon: "basketball",
      aliases: ["basketball", "basket"],
      traits: ["cardio", "team", "competition"],
      active: true,
      order: 30,
    },
    {
      id: "volleyball",
      label: "Volleyball",
      category: "team",
      parent: null,
      icon: "volleyball",
      aliases: ["volleyball", "volley"],
      traits: ["team", "competition"],
      active: true,
      order: 40,
    },
    {
      id: "handball",
      label: "Handball",
      category: "team",
      parent: null,
      icon: "handball",
      aliases: ["handball"],
      traits: ["cardio", "team", "competition"],
      active: true,
      order: 50,
    },
    {
      id: "rugby",
      label: "Rugby",
      category: "team",
      parent: null,
      icon: "rugby",
      aliases: ["rugby"],
      traits: ["cardio", "strength", "team", "competition"],
      active: true,
      order: 60,
    },
    {
      id: "ice_hockey",
      label: "Hockey sur glace",
      category: "team",
      parent: null,
      icon: "ice-hockey",
      aliases: ["hockey", "ice hockey", "hockey sur glace"],
      traits: ["cardio", "team", "winter", "competition"],
      active: true,
      order: 70,
    },
    {
      id: "field_hockey",
      label: "Hockey sur gazon",
      category: "team",
      parent: null,
      icon: "field-hockey",
      aliases: ["field hockey", "hockey sur gazon"],
      traits: ["cardio", "team", "outdoor", "competition"],
      active: true,
      order: 80,
    },
    {
      id: "baseball",
      label: "Baseball",
      category: "team",
      parent: null,
      icon: "baseball",
      aliases: ["baseball"],
      traits: ["team", "competition"],
      active: true,
      order: 90,
    },
    {
      id: "softball",
      label: "Softball",
      category: "team",
      parent: "baseball",
      icon: "softball",
      aliases: ["softball"],
      traits: ["team", "competition"],
      active: true,
      order: 100,
    },

    // =================================================
    // SPORTS DE COMBAT
    // =================================================

    {
      id: "boxing",
      label: "Boxe",
      category: "combat",
      parent: null,
      icon: "boxing",
      aliases: ["boxing", "boxe"],
      traits: ["cardio", "strength", "combat", "competition"],
      active: true,
      order: 10,
    },
    {
      id: "kickboxing",
      label: "Kickboxing",
      category: "combat",
      parent: "boxing",
      icon: "kickboxing",
      aliases: ["kickboxing", "kick boxing"],
      traits: ["cardio", "strength", "combat", "competition"],
      active: true,
      order: 20,
    },
    {
      id: "mma",
      label: "MMA",
      category: "combat",
      parent: null,
      icon: "mma",
      aliases: ["mma", "mixed martial arts"],
      traits: ["cardio", "strength", "combat", "competition"],
      active: true,
      order: 30,
    },
    {
      id: "judo",
      label: "Judo",
      category: "combat",
      parent: null,
      icon: "judo",
      aliases: ["judo"],
      traits: ["strength", "combat", "technical", "competition"],
      active: true,
      order: 40,
    },
    {
      id: "karate",
      label: "Karaté",
      category: "combat",
      parent: null,
      icon: "karate",
      aliases: ["karate", "karaté"],
      traits: ["combat", "technical", "competition"],
      active: true,
      order: 50,
    },
    {
      id: "taekwondo",
      label: "Taekwondo",
      category: "combat",
      parent: null,
      icon: "taekwondo",
      aliases: ["taekwondo"],
      traits: ["combat", "technical", "competition"],
      active: true,
      order: 60,
    },
    {
      id: "jiu_jitsu",
      label: "Jiu-Jitsu",
      category: "combat",
      parent: null,
      icon: "jiu-jitsu",
      aliases: ["jiu jitsu", "jiu-jitsu", "bjj", "brazilian jiu jitsu"],
      traits: ["strength", "combat", "technical", "competition"],
      active: true,
      order: 70,
    },
    {
      id: "wrestling",
      label: "Lutte",
      category: "combat",
      parent: null,
      icon: "wrestling",
      aliases: ["wrestling", "lutte"],
      traits: ["strength", "combat", "competition"],
      active: true,
      order: 80,
    },
    {
      id: "fencing",
      label: "Escrime",
      category: "combat",
      parent: null,
      icon: "fencing",
      aliases: ["fencing", "escrime"],
      traits: ["combat", "technical", "competition"],
      active: true,
      order: 90,
    },

    // =================================================
    // PRÉCISION & LOISIRS
    // =================================================

    {
      id: "golf",
      label: "Golf",
      category: "precision",
      parent: null,
      icon: "golf",
      aliases: ["golf"],
      traits: ["outdoor", "precision", "technical"],
      active: true,
      order: 10,
    },
    {
      id: "archery",
      label: "Tir à l’arc",
      category: "precision",
      parent: null,
      icon: "archery",
      aliases: ["archery", "tir à l'arc", "tir à l’arc"],
      traits: ["precision", "technical"],
      active: true,
      order: 20,
    },
    {
      id: "sport_shooting",
      label: "Tir sportif",
      category: "precision",
      parent: null,
      icon: "sport-shooting",
      aliases: ["shooting", "sport shooting", "tir sportif"],
      traits: ["precision", "technical"],
      active: true,
      order: 30,
    },
    {
      id: "petanque",
      label: "Pétanque",
      category: "precision",
      parent: null,
      icon: "petanque",
      aliases: ["petanque", "pétanque", "boules"],
      traits: ["outdoor", "precision", "social"],
      active: true,
      order: 40,
    },
    {
      id: "disc_golf",
      label: "Disc Golf",
      category: "precision",
      parent: null,
      icon: "disc-golf",
      aliases: ["disc golf", "frisbee golf"],
      traits: ["outdoor", "precision"],
      active: true,
      order: 50,
    },
    {
      id: "bowling",
      label: "Bowling",
      category: "precision",
      parent: null,
      icon: "bowling",
      aliases: ["bowling"],
      traits: ["indoor", "precision", "social"],
      active: true,
      order: 60,
    },

    // =================================================
    // MOUVEMENT & GLISSE
    // =================================================

    {
      id: "horse_riding",
      label: "Équitation",
      category: "movement",
      parent: null,
      icon: "horse-riding",
      aliases: ["horse riding", "equestrian", "équitation", "equitation"],
      traits: ["outdoor", "technical"],
      active: true,
      order: 10,
    },
    {
      id: "dance",
      label: "Danse",
      category: "movement",
      parent: null,
      icon: "dance",
      aliases: ["dance", "danse"],
      traits: ["cardio", "movement", "indoor"],
      active: true,
      order: 20,
    },
    {
      id: "ice_skating",
      label: "Patinage",
      category: "movement",
      parent: null,
      icon: "ice-skating",
      aliases: ["ice skating", "skating", "patinage"],
      traits: ["movement", "winter", "balance"],
      active: true,
      order: 30,
    },
    {
      id: "roller_skating",
      label: "Roller",
      category: "movement",
      parent: null,
      icon: "roller-skating",
      aliases: ["roller", "roller skating", "inline skating"],
      traits: ["cardio", "movement", "outdoor", "balance"],
      active: true,
      order: 40,
    },
    {
      id: "skateboarding",
      label: "Skateboard",
      category: "movement",
      parent: null,
      icon: "skateboarding",
      aliases: ["skate", "skateboard", "skateboarding"],
      traits: ["movement", "outdoor", "balance", "technical"],
      active: true,
      order: 50,
    },

    // =================================================
    // AUTRE
    // =================================================

    {
      id: "other",
      label: "Autre",
      category: "other",
      parent: null,
      icon: "circle-ellipsis",
      aliases: ["other", "autre", "unknown", "inconnu"],
      traits: [],
      active: true,
      order: 999,
    },
  ];

  // ===================================================
  // UTILITAIRES INTERNES
  // ===================================================

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("fr")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function sortByOrder(items) {
    return [...items].sort((a, b) => {
      const categoryA = CATEGORIES.find(
        (category) => category.id === a.category
      );
      const categoryB = CATEGORIES.find(
        (category) => category.id === b.category
      );

      const categoryOrderA = categoryA?.order ?? 999;
      const categoryOrderB = categoryB?.order ?? 999;

      if (categoryOrderA !== categoryOrderB) {
        return categoryOrderA - categoryOrderB;
      }

      return (a.order ?? 999) - (b.order ?? 999);
    });
  }

  // ===================================================
  // API PUBLIQUE
  // ===================================================

  function getAll(options = {}) {
    const { activeOnly = true } = options;

    const sports = activeOnly
      ? SPORTS.filter((sport) => sport.active)
      : SPORTS;

    return sortByOrder(sports);
  }

  function getCategories() {
    return [...CATEGORIES].sort((a, b) => a.order - b.order);
  }

  function getById(id) {
    if (!id) return null;

    return SPORTS.find((sport) => sport.id === id) || null;
  }

  function getCategoryById(id) {
    if (!id) return null;

    return CATEGORIES.find((category) => category.id === id) || null;
  }

  function getByCategory(categoryId, options = {}) {
    return getAll(options).filter(
      (sport) => sport.category === categoryId
    );
  }

  function getChildren(parentId, options = {}) {
    return getAll(options).filter((sport) => sport.parent === parentId);
  }

  function getByTrait(trait, options = {}) {
    return getAll(options).filter((sport) =>
      sport.traits.includes(trait)
    );
  }

  function resolve(value) {
    if (!value) return null;

    const directMatch = getById(value);
    if (directMatch) return directMatch;

    const normalizedValue = normalize(value);

    return (
      SPORTS.find((sport) => {
        if (normalize(sport.label) === normalizedValue) {
          return true;
        }

        return sport.aliases.some(
          (alias) => normalize(alias) === normalizedValue
        );
      }) || null
    );
  }

  function resolveId(value) {
    return resolve(value)?.id || null;
  }

  function getLabel(value, fallback = "") {
    return resolve(value)?.label || fallback || value || "";
  }

  function getIcon(value, fallback = "circle-ellipsis") {
    return resolve(value)?.icon || fallback;
  }

  function getCategory(value) {
    const sport = resolve(value);
    if (!sport) return null;

    return getCategoryById(sport.category);
  }

  function getOptions(options = {}) {
    return getAll(options).map((sport) => ({
      value: sport.id,
      label: sport.label,
      icon: sport.icon,
      category: sport.category,
    }));
  }

  function getGroupedOptions(options = {}) {
    return getCategories()
      .map((category) => ({
        ...category,
        sports: getByCategory(category.id, options),
      }))
      .filter((group) => group.sports.length > 0);
  }

  // ===================================================
  // EXPOSITION GLOBALE
  // ===================================================

  window.MomentumSports = Object.freeze({
    getAll,
    getCategories,
    getById,
    getCategoryById,
    getByCategory,
    getChildren,
    getByTrait,
    resolve,
    resolveId,
    getLabel,
    getIcon,
    getCategory,
    getOptions,
    getGroupedOptions,
  });
})();