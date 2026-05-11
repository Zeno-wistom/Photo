(() => {
  const rawPhotos = Array.isArray(window.PHOTO_ARCHIVE) ? window.PHOTO_ARCHIVE : [];
  const layoutPattern = ["wide", "portrait", "standard", "tall", "standard", "wide", "standard", "portrait", "standard", "tall"];
  const fallbackAccents = [
    "#b8b1a6",
    "#8fa0a7",
    "#a78f7a",
    "#8c8f89",
    "#b49d7f",
    "#7f8a9a",
    "#a7a19a",
    "#908474"
  ];

  const state = {
    photos: rawPhotos.map(normalizePhoto),
    currentIndex: 0,
    viewerOpen: false
  };

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const root = document.documentElement;
  const header = qs("[data-header]");
  const cursorGlow = qs(".cursor-glow");
  const cursorDot = qs(".cursor-dot");
  const heroFrame = qs("[data-hero-frame]");
  const heroMeta = qs("[data-hero-meta]");
  const heroStage = qs("[data-hero-stage]");
  const featuredGrid = qs("[data-featured-grid]");
  const archiveGrid = qs("[data-archive-grid]");
  const viewer = qs("[data-viewer]");
  const viewerImage = qs("[data-viewer-image]");
  const viewerNumber = qs("[data-viewer-number]");
  const viewerTitle = qs("[data-viewer-title]");
  const viewerCategory = qs("[data-viewer-category]");

  render();
  bindGlobalInteractions();
  bindRevealObserver();

  function normalizePhoto(photo, index) {
    const number = String(photo.number || index + 1).padStart(2, "0");
    const src = photo.src || photo.path || photo.url || "";
    const title = photo.title || `Frame ${number}`;
    const category = photo.category || "Visual Fragment";
    const accent = photo.accent || fallbackAccents[index % fallbackAccents.length];

    return {
      ...photo,
      index,
      number,
      src,
      title,
      category,
      mood: photo.mood || photo.colorTag || "Muted tone",
      featured: photo.featured ?? index < 12,
      layout: photo.layout || layoutPattern[index % layoutPattern.length],
      weight: photo.weight || (index % 7 === 0 ? 1.35 : 1),
      accent,
      rgb: photo.rgb || hexToRgbString(accent)
    };
  }

  function render() {
    if (!state.photos.length) {
      renderEmptyState();
      return;
    }

    renderHero(state.photos[0]);
    renderFeatured();
    renderArchive();
    bindPhotoInteractions();
    setActiveAtmosphere(state.photos[0]);
  }

  function renderHero(photo) {
    heroFrame.innerHTML = `
      <img src="${escapeAttr(photo.src)}" alt="${escapeAttr(photo.title)}" decoding="async" fetchpriority="high" />
    `;
    heroMeta.innerHTML = `
      <span>Frame ${photo.number}</span>
      <span>${escapeHTML(photo.title)}</span>
    `;

    const image = qs("img", heroFrame);
    image.addEventListener("load", () => extractImageColor(image, photo.index));
  }

  function renderFeatured() {
    const featuredPhotos = state.photos.filter((photo) => photo.featured).slice(0, 14);
    featuredGrid.innerHTML = featuredPhotos
      .map((photo, localIndex) => photoFigure(photo, `featured-card reveal ${photo.layout}`, localIndex < 2 ? "eager" : "lazy"))
      .join("");
  }

  function renderArchive() {
    archiveGrid.innerHTML = state.photos.map((photo) => photoFigure(photo, "sheet-item reveal", "lazy")).join("");
  }

  function renderEmptyState() {
    const emptyMarkup = `
      <div class="empty-state reveal visible">
        <p class="eyebrow">No photos detected</p>
        <h3>Place your photographs in <code>public/photos/</code>.</h3>
        <p>
          The site structure, interaction system, immersive viewer, and manifest
          workflow are ready. After adding images, run
          <code>node scripts/generate-photos.mjs</code> to generate the archive.
        </p>
      </div>
    `;
    featuredGrid.innerHTML = emptyMarkup;
    archiveGrid.innerHTML = emptyMarkup;
  }

  function photoFigure(photo, className, loading) {
    return `
      <figure
        class="photo-frame ${className}"
        data-photo-index="${photo.index}"
        style="--frame-accent:${photo.accent};--frame-rgb:${photo.rgb};--weight:${photo.weight};"
        tabindex="0"
        role="button"
        aria-label="Open ${escapeAttr(photo.title)}"
      >
        <div class="photo-inner">
          <img
            src="${escapeAttr(photo.src)}"
            alt="${escapeAttr(photo.title)}"
            loading="${loading}"
            decoding="async"
          />
          <div class="photo-sheen" aria-hidden="true"></div>
        </div>
        <figcaption>
          <span>Frame ${photo.number}</span>
          <strong>${escapeHTML(photo.title)}</strong>
          <em>${escapeHTML(photo.category)} · ${escapeHTML(photo.mood)}</em>
        </figcaption>
      </figure>
    `;
  }

  function bindGlobalInteractions() {
    window.addEventListener("pointermove", (event) => {
      const x = event.clientX;
      const y = event.clientY;
      root.style.setProperty("--cursor-x", `${x}px`);
      root.style.setProperty("--cursor-y", `${y}px`);
      root.style.setProperty("--cursor-x-percent", `${(x / window.innerWidth) * 100}%`);
      root.style.setProperty("--cursor-y-percent", `${(y / window.innerHeight) * 100}%`);

      if (cursorGlow && cursorDot) {
        cursorGlow.animate({ transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)` }, { duration: 500, fill: "forwards" });
        cursorDot.animate({ transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)` }, { duration: 120, fill: "forwards" });
      }
    });

    window.addEventListener("scroll", () => {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
    }, { passive: true });

    if (heroStage) {
      heroStage.addEventListener("pointermove", (event) => {
        const rect = heroStage.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        heroStage.style.setProperty("--hero-rx", `${py * -5}deg`);
        heroStage.style.setProperty("--hero-ry", `${px * 7}deg`);
      });
      heroStage.addEventListener("pointerleave", () => {
        heroStage.style.setProperty("--hero-rx", "0deg");
        heroStage.style.setProperty("--hero-ry", "0deg");
      });
    }

    qsa(".magnetic").forEach((item) => {
      item.addEventListener("pointermove", (event) => {
        const rect = item.getBoundingClientRect();
        item.style.setProperty("--mx", `${(event.clientX - rect.left - rect.width / 2) * 0.16}px`);
        item.style.setProperty("--my", `${(event.clientY - rect.top - rect.height / 2) * 0.22}px`);
      });
      item.addEventListener("pointerleave", () => {
        item.style.setProperty("--mx", "0px");
        item.style.setProperty("--my", "0px");
      });
    });

    qs("[data-viewer-close]").addEventListener("click", closeViewer);
    qs("[data-viewer-prev]").addEventListener("click", () => stepViewer(-1));
    qs("[data-viewer-next]").addEventListener("click", () => stepViewer(1));
    viewer.addEventListener("click", (event) => {
      if (event.target === viewer) closeViewer();
    });

    window.addEventListener("keydown", (event) => {
      if (!state.viewerOpen) return;
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft") stepViewer(-1);
      if (event.key === "ArrowRight") stepViewer(1);
    });
  }

  function bindRevealObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });

    qsa(".reveal").forEach((node) => observer.observe(node));
  }

  function bindPhotoInteractions() {
    qsa(".photo-frame").forEach((frame) => {
      const index = Number(frame.dataset.photoIndex);
      const photo = state.photos[index];
      const image = qs("img", frame);

      image.addEventListener("load", () => extractImageColor(image, index));

      frame.addEventListener("pointerenter", () => {
        setActiveAtmosphere(photo);
        document.body.classList.add("is-photo-hovering");
        dimArchiveSiblings(frame);
      });

      frame.addEventListener("pointermove", (event) => {
        const rect = frame.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        frame.style.setProperty("--tilt-x", `${py * -6}deg`);
        frame.style.setProperty("--tilt-y", `${px * 8}deg`);
        frame.style.setProperty("--local-x", `${(px + 0.5) * 100}%`);
        frame.style.setProperty("--local-y", `${(py + 0.5) * 100}%`);
      });

      frame.addEventListener("pointerleave", () => {
        frame.style.setProperty("--tilt-x", "0deg");
        frame.style.setProperty("--tilt-y", "0deg");
        document.body.classList.remove("is-photo-hovering");
        clearArchiveDimming();
      });

      frame.addEventListener("click", () => openViewer(index));
      frame.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openViewer(index);
        }
      });
    });
  }

  function dimArchiveSiblings(activeFrame) {
    if (!archiveGrid.contains(activeFrame)) return;
    qsa(".sheet-item", archiveGrid).forEach((item) => {
      item.classList.toggle("is-dimmed", item !== activeFrame);
    });
  }

  function clearArchiveDimming() {
    qsa(".sheet-item.is-dimmed", archiveGrid).forEach((item) => item.classList.remove("is-dimmed"));
  }

  function openViewer(index) {
    state.currentIndex = index;
    state.viewerOpen = true;
    updateViewer();
    viewer.setAttribute("aria-hidden", "false");
    viewer.classList.add("is-open");
    document.body.classList.add("viewer-open");
  }

  function closeViewer() {
    state.viewerOpen = false;
    viewer.setAttribute("aria-hidden", "true");
    viewer.classList.remove("is-open");
    document.body.classList.remove("viewer-open");
  }

  function stepViewer(direction) {
    if (!state.photos.length) return;
    state.currentIndex = (state.currentIndex + direction + state.photos.length) % state.photos.length;
    updateViewer();
  }

  function updateViewer() {
    const photo = state.photos[state.currentIndex];
    if (!photo) return;

    viewerImage.src = photo.src;
    viewerImage.alt = photo.title;
    viewerNumber.textContent = `Frame ${photo.number}`;
    viewerTitle.textContent = photo.title;
    viewerCategory.textContent = `${photo.category} · ${photo.mood}`;
    setActiveAtmosphere(photo);
  }

  function setActiveAtmosphere(photo) {
    if (!photo) return;
    root.style.setProperty("--active-accent", photo.accent);
    root.style.setProperty("--active-rgb", photo.rgb || hexToRgbString(photo.accent));
  }

  function extractImageColor(image, index) {
    const photo = state.photos[index];
    if (!photo || photo.colorExtracted || !image.complete || !image.naturalWidth) return;

    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const size = 28;
      canvas.width = size;
      canvas.height = size;
      context.drawImage(image, 0, 0, size, size);
      const { data } = context.getImageData(0, 0, size, size);
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let i = 0; i < data.length; i += 16) {
        const alpha = data[i + 3];
        if (alpha < 40) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count += 1;
      }

      if (!count) return;
      const rgb = [r, g, b].map((value) => Math.round(value / count));
      photo.rgb = rgb.join(", ");
      photo.accent = rgbToHex(rgb[0], rgb[1], rgb[2]);
      photo.colorExtracted = true;

      qsa(`[data-photo-index="${index}"]`).forEach((node) => {
        node.style.setProperty("--frame-accent", photo.accent);
        node.style.setProperty("--frame-rgb", photo.rgb);
      });

      if (state.currentIndex === index || index === 0) setActiveAtmosphere(photo);
    } catch (error) {
      photo.colorExtracted = true;
    }
  }

  function hexToRgbString(hex) {
    const normalized = hex.replace("#", "").trim();
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "184, 177, 166";
    const value = Number.parseInt(normalized, 16);
    return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
  }

  function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHTML(value).replaceAll("`", "&#096;");
  }
})();
