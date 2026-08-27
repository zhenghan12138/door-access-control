const ringContainer = document.querySelector("#ring-container");
const button = document.querySelector("#open-door");
const buttonLabel = document.querySelector("#button-label");
const buttonIcon = document.querySelector("#button-icon");

const ICONS = {
  key: `<circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 8.3-8.3" /><path d="M16 7h3" /><path d="M19 4h2v3" />`,
  spinner: `<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />`,
  check: `<path d="M20 6 9 17l-5-5" />`,
  cross: `<path d="M18 6 6 18M6 6l12 12" />`
};

let resetTimer = null;

function setState(state) {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }

  ringContainer.className = `ring-container state-${state}`;

  switch (state) {
    case "loading":
      button.disabled = true;
      buttonLabel.textContent = "开启中";
      buttonIcon.innerHTML = ICONS.spinner;
      break;

    case "success":
      button.disabled = false;
      buttonLabel.textContent = "已开启";
      buttonIcon.innerHTML = ICONS.check;

      resetTimer = setTimeout(() => {
        setState("idle");
      }, 3500);
      break;

    case "error":
      button.disabled = false;
      buttonLabel.textContent = "失败重试";
      buttonIcon.innerHTML = ICONS.cross;

      resetTimer = setTimeout(() => {
        setState("idle");
      }, 3500);
      break;

    case "idle":
    default:
      button.disabled = false;
      buttonLabel.textContent = "开门";
      buttonIcon.innerHTML = ICONS.key;
      break;
  }
}

async function requestOpenDoor() {
  if (ringContainer.classList.contains("state-loading")) return;

  setState("loading");

  try {
    const response = await fetch("/api/open-door", {
      method: "POST",
      headers: { "x-door-action": "open" }
    });
    const data = await response.json();

    if (response.ok && (data.success || data.status === "1")) {
      setState("success");
    } else {
      setState("error");
    }
  } catch {
    setState("error");
  }
}

button.addEventListener("click", requestOpenDoor);
