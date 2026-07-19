(function initializeAvatarCropper() {
  const OUTPUT_SIZE = 512;

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ image, url });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Cette image ne peut pas être ouverte."));
      };
      image.src = url;
    });
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Le cadrage n’a pas pu être créé.")), "image/jpeg", .9);
    });
  }

  async function open(file) {
    const { image, url } = await loadImage(file);
    const state = { zoom:1, x:0, y:0, pointerId:null, startX:0, startY:0, originX:0, originY:0 };

    const dialog = document.createElement("dialog");
    dialog.className = "avatar-crop-dialog";
    dialog.setAttribute("aria-labelledby", "avatarCropTitle");
    dialog.innerHTML = `
      <form method="dialog" class="avatar-crop-panel">
        <div class="avatar-crop-heading">
          <div><span class="section-kicker">Photo de profil</span><h2 id="avatarCropTitle">Choisir le cadrage</h2></div>
          <button class="avatar-crop-close" value="cancel" type="submit" aria-label="Annuler">×</button>
        </div>
        <p>Déplace la photo et ajuste le zoom. Ce cercle correspond exactement à l’avatar affiché dans MOMENTUM.</p>
        <div class="avatar-crop-stage" data-crop-stage>
          <img draggable="false" alt="Aperçu du cadrage" data-crop-image />
          <span class="avatar-crop-ring" aria-hidden="true"></span>
        </div>
        <label class="avatar-crop-zoom">Zoom
          <input type="range" min="1" max="3" value="1" step="0.01" data-crop-zoom />
        </label>
        <div class="avatar-crop-actions">
          <button class="secondary" value="cancel" type="submit">Annuler</button>
          <button class="primary" value="confirm" type="submit">Utiliser cette photo</button>
        </div>
      </form>`;

    document.body.append(dialog);
    const stage = dialog.querySelector("[data-crop-stage]");
    const preview = dialog.querySelector("[data-crop-image]");
    const zoom = dialog.querySelector("[data-crop-zoom]");
    preview.src = url;

    function geometry() {
      const size = stage.clientWidth;
      const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
      const scale = baseScale * state.zoom;
      return {
        size,
        scale,
        width:image.naturalWidth * scale,
        height:image.naturalHeight * scale
      };
    }

    function constrain() {
      const { size, width, height } = geometry();
      state.x = Math.max(-(width - size) / 2, Math.min((width - size) / 2, state.x));
      state.y = Math.max(-(height - size) / 2, Math.min((height - size) / 2, state.y));
    }

    function render() {
      constrain();
      const { width, height } = geometry();
      preview.style.width = `${width}px`;
      preview.style.height = `${height}px`;
      preview.style.transform = `translate(calc(-50% + ${state.x}px), calc(-50% + ${state.y}px))`;
    }

    zoom.addEventListener("input", () => {
      state.zoom = Number(zoom.value);
      render();
    });
    stage.addEventListener("pointerdown", (event) => {
      state.pointerId = event.pointerId;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.originX = state.x;
      state.originY = state.y;
      stage.setPointerCapture(event.pointerId);
      stage.classList.add("is-dragging");
    });
    stage.addEventListener("pointermove", (event) => {
      if (event.pointerId !== state.pointerId) return;
      state.x = state.originX + event.clientX - state.startX;
      state.y = state.originY + event.clientY - state.startY;
      render();
    });
    const endDrag = (event) => {
      if (event.pointerId !== state.pointerId) return;
      state.pointerId = null;
      stage.classList.remove("is-dragging");
    };
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    const result = new Promise((resolve) => {
      dialog.addEventListener("close", async () => {
        try {
          if (dialog.returnValue !== "confirm") return resolve(null);
          const { size, scale } = geometry();
          const sourceSize = size / scale;
          const sourceX = (image.naturalWidth - sourceSize) / 2 - state.x / scale;
          const sourceY = (image.naturalHeight - sourceSize) / 2 - state.y / scale;
          const canvas = document.createElement("canvas");
          canvas.width = OUTPUT_SIZE;
          canvas.height = OUTPUT_SIZE;
          canvas.getContext("2d").drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
          resolve(await canvasBlob(canvas));
        } catch (error) {
          console.error("YOU : recadrage de l’avatar interrompu.", error);
          resolve(null);
        } finally {
          URL.revokeObjectURL(url);
          dialog.remove();
        }
      }, { once:true });
    });

    dialog.showModal();
    render();
    return result;
  }

  window.MomentumAvatarCropper = { open };
})();
