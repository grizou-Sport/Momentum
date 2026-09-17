/* =========================================================
   MOMENTUM — MOTION v1.0
   ---------------------------------------------------------
   Primitives réutilisables : apparition unique, compteurs,
   parallaxe légère, graphiques et tooltips.
   ========================================================= */

(function momentumMotionModule(global) {
  document.documentElement.classList.add("motion-capable");
  const observed = new WeakSet();
  let chartStageVersion = 0;

  function prefersReducedMotion() {
    return Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }

  function observeOnce(elements, onEnter, options = {}) {
    const targets = [...elements].filter(Boolean);
    if (!targets.length) return null;

    if (prefersReducedMotion() || typeof global.IntersectionObserver !== "function") {
      targets.forEach((element) => onEnter(element));
      return null;
    }

    const observer = new global.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        onEnter(entry.target);
      });
    }, {
      threshold: options.threshold ?? 0.14,
      rootMargin: options.rootMargin || "0px 0px -7% 0px"
    });

    targets.forEach((element) => observer.observe(element));
    return observer;
  }

  function reveal(root = document) {
    const targets = root.querySelectorAll?.("[data-motion-reveal]") || [];
    const fresh = [...targets].filter((element) => !observed.has(element));
    fresh.forEach((element) => observed.add(element));
    return observeOnce(fresh, (element) => element.classList.add("is-motion-visible"));
  }

  function formatCounterValue(value, decimals = 0) {
    return Number(value).toLocaleString("fr-CH", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function setCounterValue(element, value) {
    const decimals = Math.max(0, Number(element.dataset.motionDecimals || 0));
    const prefix = element.dataset.motionPrefix || "";
    const suffix = element.dataset.motionSuffix || "";
    element.textContent = `${prefix}${formatCounterValue(value, decimals)}${suffix}`;
  }

  function animateNumber(element, duration = 500) {
    const target = Number(element?.dataset.motionValue);
    if (!element || !Number.isFinite(target)) return;
    // The value is meaningful data, including when animation is paused or offscreen.
    // Animate its appearance without temporarily reporting invented intermediate values.
    setCounterValue(element, target);
    if (prefersReducedMotion()) return;
    element.animate?.([
      {opacity:0.65,transform:"translateY(4px)"},
      {opacity:1,transform:"translateY(0)"}
    ], {duration,easing:"ease-out"});
  }

  function animateNumbers(root = document) {
    const counters = root.querySelectorAll?.("[data-motion-number]") || [];
    for (const element of counters) {
      const target=Number(element.dataset.motionValue);
      if (Number.isFinite(target)) setCounterValue(element,target);
    }
    observeOnce(counters, (element) => animateNumber(element), {
      threshold: 0.6,
      rootMargin: "0px"
    });
  }

  function initParallax(root = document) {
    if (prefersReducedMotion()) return;
    const heroes = root.querySelectorAll?.("[data-motion-parallax]") || [];

    heroes.forEach((hero) => {
      const media = hero.querySelector("[data-motion-parallax-media]");
      if (!media) return;
      const factor = Math.max(0, Math.min(.3, Number(hero.dataset.motionParallax || .24)));
      let frame = null;

      const update = () => {
        frame = null;
        const rect = hero.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= global.innerHeight) return;
        const offset = Math.max(0, Math.min(90, -rect.top * factor));
        media.style.setProperty("--motion-parallax-y", `${offset.toFixed(1)}px`);
      };

      const requestUpdate = () => {
        if (frame !== null) return;
        frame = global.requestAnimationFrame(update);
      };

      global.addEventListener("scroll", requestUpdate, { passive:true });
      global.addEventListener("resize", requestUpdate, { passive:true });
      requestUpdate();
    });
  }

  function stageChart(chart, element, animation = {}) {
    if (!chart || !element) return;
    const version = ++chartStageVersion;
    element.dataset.motionChartVersion = String(version);

    if (prefersReducedMotion() || element.dataset.motionChartPlayed === "true") {
      element.dataset.motionChartPlayed = "true";
      element.classList.add("is-motion-chart-visible");
      chart.options.animation = false;
      chart.update("none");
      return;
    }

    chart.stop?.();
    chart.reset?.();

    observeOnce([element], () => {
      if (element.dataset.motionChartVersion !== String(version)) return;
      element.dataset.motionChartPlayed = "true";
      element.classList.add("is-motion-chart-visible");
      chart.options.animation = {
        duration: Math.min(900, Math.max(600, Number(animation.duration || 780))),
        easing: animation.easing || "easeOutQuart"
      };
      chart.update();
    }, { threshold:0.22 });
  }

  function externalChartTooltip({ chart, tooltip }) {
    const host = chart.canvas.parentElement;
    if (!host) return;
    let element = host.querySelector(".momentum-chart-tooltip");

    if (!element) {
      element = document.createElement("div");
      element.className = "momentum-chart-tooltip";
      element.setAttribute("role", "status");
      host.append(element);
    }

    if (!tooltip || tooltip.opacity === 0) {
      element.classList.remove("is-visible");
      return;
    }

    element.replaceChildren();
    const title = tooltip.title?.join(" · ");
    if (title) {
      const heading = document.createElement("strong");
      heading.textContent = title;
      element.append(heading);
    }
    (tooltip.body || []).forEach((body) => {
      const line = document.createElement("span");
      line.textContent = body.lines?.join(" · ") || "";
      element.append(line);
    });

    element.style.setProperty("--tooltip-x", `${chart.canvas.offsetLeft + tooltip.caretX}px`);
    element.style.setProperty("--tooltip-y", `${chart.canvas.offsetTop + tooltip.caretY - 10}px`);
    element.classList.add("is-visible");
  }

  const chartHaloPlugin = {
    id:"momentumPointHalo",
    afterDatasetsDraw(chart) {
      if (chart.config.type !== "line") return;
      const active = chart.tooltip?.getActiveElements?.() || chart.getActiveElements?.() || [];
      const point = active[0]?.element;
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      const context = chart.ctx;
      context.save();
      context.beginPath();
      context.arc(point.x, point.y, 10, 0, Math.PI * 2);
      context.fillStyle = "rgba(39,60,49,.11)";
      context.fill();
      context.restore();
    }
  };

  function init(root = document) {
    document.documentElement.classList.add("motion-ready");
    reveal(root);
    animateNumbers(root);
    initParallax(root);
  }

  global.MomentumMotion = Object.freeze({
    animateNumber,
    animateNumbers,
    chartHaloPlugin,
    externalChartTooltip,
    init,
    initParallax,
    observeOnce,
    prefersReducedMotion,
    reveal,
    stageChart
  });

  document.addEventListener("DOMContentLoaded", () => init());
})(window);
