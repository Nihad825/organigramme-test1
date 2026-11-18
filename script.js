
"use strict";

// ======================================
// TEST — ORGANIGRAMMES MULTIPLES
// ======================================

const $ = id => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const STORAGE_KEY = "test-organigrammes-v2";

const CARD_W = 220;
const CARD_H = 110;
const GAP_X = 35;
const GAP_Y = 90;
const PAD = 50;

const COLORS = {
  "Direction": "#6558f5",
  "Marketing": "#ef825c",
  "Développement": "#358be8",
  "Ressources humaines": "#18af86",
  "Commercial": "#d5a02c",
  "Finance": "#965ed8",
  "Autre": "#78859b"
};

const demo = [
  {
    id: 1,
    name: "Alexandre Martin",
    role: "Directeur général",
    dept: "Direction",
    manager: null,
    order: 0
  },
  {
    id: 2,
    name: "Sophie Bernard",
    role: "Directrice marketing",
    dept: "Marketing",
    manager: 1,
    order: 0
  },
  {
    id: 3,
    name: "Thomas Petit",
    role: "Directeur technique",
    dept: "Développement",
    manager: 1,
    order: 1
  },
  {
    id: 4,
    name: "Emma Laurent",
    role: "Responsable RH",
    dept: "Ressources humaines",
    manager: 1,
    order: 2
  },
  {
    id: 5,
    name: "Lucas Moreau",
    role: "Designer UI/UX",
    dept: "Marketing",
    manager: 2,
    order: 0
  }
];

// ======================================
// DONNÉES ET SAUVEGARDE
// ======================================

function uid() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}

function createProject(name, members = []) {
  return {
    id: uid(),
    name,
    people: members.map(p => ({ ...p }))
  };
}

function loadData() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    if (
      saved &&
      Array.isArray(saved.projects) &&
      saved.projects.length
    ) {
      return saved;
    }
  } catch (error) {
    console.warn("Lecture impossible :", error);
  }

  // Migration des anciennes données TEST.
  try {
    const old = JSON.parse(
      localStorage.getItem("test-organigrammes-v1")
    );

    if (
      old &&
      Array.isArray(old.projects) &&
      old.projects.length
    ) {
      return old;
    }
  } catch (error) {
    console.warn("Anciennes données illisibles :", error);
  }

  const project = createProject("Entreprise", demo);

  return {
    activeId: project.id,
    projects: [project]
  };
}

const initial = loadData();

let projects = initial.projects;
let activeProjectId = initial.activeId;

if (!projects.some(p => p.id === activeProjectId)) {
  activeProjectId = projects[0].id;
}

function currentProject() {
  return projects.find(p => p.id === activeProjectId);
}

let people = currentProject().people;
let editingId = null;
let projectMode = "create";

let scale = 1;
let offsetX = 0;
let offsetY = 0;

let chartWidth = 600;
let chartHeight = 400;

let drag = null;
let suppressClick = false;
let toastTimer = null;

function save() {
  currentProject().people = people;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeId: activeProjectId,
        projects
      })
    );
  } catch (error) {
    console.error("Sauvegarde impossible :", error);
  }
}

function notify(message) {
  const toast = $("toast");

  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2300);
}

// ======================================
// OUTILS
// ======================================

function colorFor(dept) {
  return COLORS[dept] || COLORS.Autre;
}

function initials(name) {
  return String(name).trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word.charAt(0))
    .join("")
    .toUpperCase();
}

function shorten(value, max = 24) {
  const text = String(value);

  return text.length > max
    ? text.slice(0, max - 1) + "…"
    : text;
}

function sameId(a, b) {
  return String(a) === String(b);
}

function sameManager(a, b) {
  if (a == null || a === "") {
    return b == null || b === "";
  }

  return sameId(a, b);
}

function findPerson(id) {
  return people.find(p => sameId(p.id, id));
}

function siblings(manager, excludeId = null) {
  return people
    .filter(p =>
      sameManager(p.manager, manager) &&
      (excludeId === null || !sameId(p.id, excludeId))
    )
    .sort((a, b) =>
      (a.order ?? 0) - (b.order ?? 0)
    );
}

function normalizeOrders(manager) {
  siblings(manager).forEach((person, index) => {
    person.order = index;
  });
}

function descendantsOf(id) {
  const result = new Set();
  const queue = [id];
  const seen = new Set([String(id)]);

  while (queue.length) {
    const current = queue.shift();

    people.forEach(person => {
      const key = String(person.id);

      if (
        sameManager(person.manager, current) &&
        !seen.has(key)
      ) {
        result.add(key);
        seen.add(key);
        queue.push(person.id);
      }
    });
  }

  return result;
}

function insertPerson(person, manager, position) {
  const oldManager = person.manager;

  const others = siblings(manager, person.id);

  const index = Math.max(
    0,
    Math.min(position, others.length)
  );

  person.manager = manager;

  others.splice(index, 0, person);

  others.forEach((p, i) => {
    p.order = i;
  });

  if (!sameManager(oldManager, manager)) {
    normalizeOrders(oldManager);
  }
}

// ======================================
// GESTION DES ONGLETS
// ======================================

function renderTabs() {
  const container = $("projectTabs");
  container.replaceChildren();

  projects.forEach(project => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "project-tab";
    button.textContent = project.name;

    if (project.id === activeProjectId) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      switchProject(project.id);
    });

    container.appendChild(button);
  });

  $("currentProjectName").textContent =
    currentProject().name;

  $("deleteProjectBtn").disabled =
    projects.length <= 1;
}

function switchProject(id) {
  const project = projects.find(p => p.id === id);

  if (!project) return;

  save();

  activeProjectId = id;
  people = project.people;

  closePersonModal();
  closeProjectModal();

  save();
  renderTabs();
  renderChart();
}

function openProjectModal(mode) {
  projectMode = mode;

  $("projectModalTitle").textContent =
    mode === "create"
      ? "Nouvel organigramme"
      : "Renommer l'organigramme";

  $("projectName").value =
    mode === "create"
      ? ""
      : currentProject().name;

  $("projectModal").classList.remove("hidden");
  $("projectName").focus();
}

function closeProjectModal() {
  $("projectModal").classList.add("hidden");
}

$("newProjectBtn").addEventListener("click", () => {
  openProjectModal("create");
});

$("renameProjectBtn").addEventListener("click", () => {
  openProjectModal("rename");
});

$("projectForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("projectName").value.trim();

  if (!name) return;

  if (projectMode === "create") {
    save();

    const project = createProject(name);

    projects.push(project);
    activeProjectId = project.id;
    people = project.people;

    notify("Nouvel organigramme créé !");
  } else {
    currentProject().name = name;
    notify("Organigramme renommé.");
  }

  closeProjectModal();
  save();
  renderTabs();
  renderChart();
});

$("closeProjectModal").addEventListener(
  "click",
  closeProjectModal
);

$("cancelProjectBtn").addEventListener(
  "click",
  closeProjectModal
);

$("clearProjectBtn").addEventListener("click", () => {
  const confirmed = confirm(
    "Supprimer tous les collaborateurs de cet organigramme ?"
  );

  if (!confirmed) return;

  people = [];

  closePersonModal();
  save();
  renderChart();

  notify("Organigramme vidé.");
});

$("deleteProjectBtn").addEventListener("click", () => {
  if (projects.length <= 1) {
    alert("Vous devez conserver au moins un onglet.");
    return;
  }

  const name = currentProject().name;

  if (!confirm(`Supprimer l'organigramme "${name}" ?`)) {
    return;
  }

  projects = projects.filter(
    p => p.id !== activeProjectId
  );

  activeProjectId = projects[0].id;
  people = currentProject().people;

  closePersonModal();

  save();
  renderTabs();
  renderChart();

  notify("Onglet supprimé.");
});

// ======================================
// CONSTRUCTION DE LA HIÉRARCHIE
// ======================================

function buildTree() {
  const nodes = new Map();

  people.forEach(person => {
    nodes.set(String(person.id), {
      ...person,
      children: [],
      x: 0,
      y: 0,
      width: CARD_W
    });
  });

  const roots = [];

  // Empêche les boucles hiérarchiques,
  // y compris dans d'anciennes sauvegardes.
  function validParent(node) {
    if (node.manager == null || node.manager === "") {
      return null;
    }

    const parent = nodes.get(String(node.manager));

    if (!parent || sameId(parent.id, node.id)) {
      return null;
    }

    const visited = new Set([String(node.id)]);
    let current = parent;

    while (current) {
      const key = String(current.id);

      if (visited.has(key)) {
        return null;
      }

      visited.add(key);

      if (current.manager == null ||
          current.manager === "") {
        break;
      }

      current = nodes.get(String(current.manager));
    }

    return parent;
  }

  nodes.forEach(node => {
    const parent = validParent(node);

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  nodes.forEach(node => {
    node.children.sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
  });

  roots.sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );

  return roots;
}

// ======================================
// CALCUL DES POSITIONS
// ======================================

function calculateLayout(roots) {
  let maxDepth = 0;

  function measure(node, depth) {
    maxDepth = Math.max(maxDepth, depth);

    if (!node.children.length) {
      node.width = CARD_W;
      return node.width;
    }

    let total = 0;

    node.children.forEach((child, index) => {
      if (index > 0) total += GAP_X;

      total += measure(child, depth + 1);
    });

    node.width = Math.max(CARD_W, total);
    return node.width;
  }

  roots.forEach(root => measure(root, 0));

  function place(node, left, depth) {
    node.x = left + (node.width - CARD_W) / 2;
    node.y = depth * (CARD_H + GAP_Y);

    if (!node.children.length) return;

    const total = node.children.reduce(
      (sum, child) => sum + child.width,
      0
    ) + GAP_X * (node.children.length - 1);

    let cursor = left + (node.width - total) / 2;

    node.children.forEach(child => {
      place(child, cursor, depth + 1);
      cursor += child.width + GAP_X;
    });
  }

  let cursor = 0;

  roots.forEach(root => {
    place(root, cursor, 0);
    cursor += root.width + GAP_X;
  });

  const totalWidth = roots.length
    ? cursor - GAP_X
    : CARD_W;

  chartWidth = Math.max(
    500,
    totalWidth + PAD * 2
  );

  chartHeight = Math.max(
    300,
    maxDepth * (CARD_H + GAP_Y) +
      CARD_H + PAD * 2
  );
}

// ======================================
// DESSIN SVG
// ======================================

function svgElement(tag, attrs = {}, parent = null) {
  const element = document.createElementNS(NS, tag);

  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });

  if (parent) parent.appendChild(element);

  return element;
}

function svgText(parent, value, x, y, attrs = {}) {
  const element = svgElement("text", {
    x,
    y,
    "font-family": "Arial, sans-serif",
    ...attrs
  }, parent);

  element.textContent = value;

  return element;
}

function drawCard(parent, person) {
  const group = svgElement("g", {
    transform: `translate(${person.x},${person.y})`,
    "data-person-id": person.id,
    style: "cursor:pointer"
  }, parent);

  // Ombre
  svgElement("rect", {
    x: 0, y: 5,
    width: CARD_W,
    height: CARD_H,
    rx: 15,
    fill: "#252940",
    opacity: 0.08
  }, group);

  // Fond
  svgElement("rect", {
    x: 0, y: 0,
    width: CARD_W,
    height: CARD_H,
    rx: 15,
    fill: "#ffffff",
    stroke: "#e7eaf2",
    "stroke-width": 1.5
  }, group);

  // Bande colorée
  svgElement("rect", {
    x: 0, y: 14,
    width: 5,
    height: 80,
    rx: 2,
    fill: colorFor(person.dept)
  }, group);

  // Avatar
  svgElement("rect", {
    x: 15, y: 17,
    width: 40,
    height: 40,
    rx: 12,
    fill: colorFor(person.dept),
    opacity: 0.14
  }, group);

  svgText(
    group,
    initials(person.name),
    35,
    42,
    {
      "font-size": 12,
      "font-weight": 700,
      "text-anchor": "middle",
      fill: colorFor(person.dept)
    }
  );

  svgText(
    group,
    shorten(person.name, 21),
    65,
    34,
    {
      "font-size": 12,
      "font-weight": 700,
      fill: "#252940"
    }
  );

  svgText(
    group,
    shorten(person.role, 24),
    65,
    51,
    {
      "font-size": 10,
      fill: "#9298a9"
    }
  );

  svgElement("line", {
    x1: 15, y1: 71,
    x2: 205, y2: 71,
    stroke: "#f0f1f6"
  }, group);

  svgElement("circle", {
    cx: 23, cy: 90,
    r: 4,
    fill: colorFor(person.dept)
  }, group);

  svgText(
    group,
    shorten(person.dept, 27),
    35,
    94,
    {
      "font-size": 10,
      "font-weight": 600,
      fill: "#737b91"
    }
  );

  // Petit bouton + cliquable
  const addGroup = svgElement("g", {
    "data-add-under": person.id,
    style: "cursor:pointer"
  }, group);

  svgElement("circle", {
    cx: CARD_W - 17,
    cy: 18,
    r: 13,
    fill: "#efedff"
  }, addGroup);

  svgText(
    addGroup,
    "+",
    CARD_W - 17,
    23,
    {
      "font-size": 19,
      "font-weight": 700,
      "text-anchor": "middle",
      fill: "#6558f5"
    }
  );
}

function drawConnections(parent, node) {
  node.children.forEach(child => {
    const x1 = node.x + CARD_W / 2;
    const y1 = node.y + CARD_H;

    const x2 = child.x + CARD_W / 2;
    const y2 = child.y;

    const middleY = (y1 + y2) / 2;

    svgElement("path", {
      d: `M ${x1} ${y1}
          V ${middleY}
          H ${x2}
          V ${y2}`,
      fill: "none",
      stroke: "#cbd1e4",
      "stroke-width": 2.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    }, parent);

    svgElement("circle", {
      cx: x2,
      cy: y2,
      r: 4,
      fill: "#6558f5"
    }, parent);

    drawConnections(parent, child);
  });
}

// ======================================
// AFFICHAGE
// ======================================

function renderChart() {
  const chart = $("chart");
  chart.replaceChildren();

  const roots = buildTree();

  calculateLayout(roots);

  const viewport = svgElement("g", {
    id: "viewport"
  }, chart);

  const content = svgElement("g", {
    transform: `translate(${PAD},${PAD})`
  }, viewport);

  const lines = svgElement("g", {}, content);
  const cards = svgElement("g", {}, content);

  roots.forEach(root => {
    drawConnections(lines, root);
  });

  function drawNode(node) {
    drawCard(cards, node);
    node.children.forEach(drawNode);
  }

  roots.forEach(drawNode);

  if (!people.length) {
    svgText(
      content,
      "Organigramme vide",
      200,
      105,
      {
        "font-size": 21,
        "font-weight": 700,
        "text-anchor": "middle",
        fill: "#737b91"
      }
    );

    svgText(
      content,
      "Ajoutez votre premier collaborateur.",
      200,
      140,
      {
        "font-size": 13,
        "text-anchor": "middle",
        fill: "#a1a7b6"
      }
    );
  }

  $("teamCount").textContent = people.length;

  $("nodeCount").textContent =
    `${people.length} collaborateur${people.length > 1 ? "s" : ""}`;

  renderTeamList();
  fitChart();
}

function renderTeamList() {
  const container = $("teamList");
  container.replaceChildren();

  people.forEach(person => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "team-member";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = initials(person.name);

    const info = document.createElement("div");
    info.className = "member-info";

    const name = document.createElement("strong");
    name.textContent = person.name;

    const role = document.createElement("small");
    role.textContent = person.role;

    info.append(name, role);
    button.append(avatar, info);

    button.addEventListener("click", () => {
      openPersonModal(person.id);
    });

    container.appendChild(button);
  });
}

// ======================================
// FORMULAIRE COLLABORATEUR
// ======================================

function fillManagers(selected = null) {
  const select = $("personManager");
  select.replaceChildren();

  select.add(
    new Option("Aucun — niveau principal", "")
  );

  const forbidden = editingId === null
    ? new Set()
    : descendantsOf(editingId);

  if (editingId !== null) {
    forbidden.add(String(editingId));
  }

  people.forEach(person => {
    if (!forbidden.has(String(person.id))) {
      select.add(
        new Option(person.name, String(person.id))
      );
    }
  });

  select.value = selected == null
    ? ""
    : String(selected);
}

function selectedManager() {
  const value = $("personManager").value;

  if (value === "") return null;

  const person = findPerson(value);
  return person ? person.id : null;
}

function fillPositions(preferred = null) {
  const manager = selectedManager();
  const others = siblings(manager, editingId);
  const select = $("personPosition");

  select.replaceChildren();

  for (let i = 0; i <= others.length; i++) {
    let label;

    if (!others.length) {
      label = "Première position";
    } else if (i === 0) {
      label = "Tout à gauche";
    } else if (i === others.length) {
      label = "Tout à droite";
    } else {
      label = `Avant ${others[i].name}`;
    }

    select.add(new Option(label, String(i)));
  }

  const index = preferred === null
    ? others.length
    : Math.max(0, Math.min(preferred, others.length));

  select.value = String(index);
}

function openPersonModal(id = null, managerId = null) {
  editingId = id;

  const person = id === null ? null : findPerson(id);

  $("personModalTitle").textContent = person
    ? "Modifier le collaborateur"
    : "Ajouter une personne";

  $("personName").value = person?.name || "";
  $("personRole").value = person?.role || "";
  $("personDept").value = person?.dept || "Direction";

  $("deletePersonBtn").classList.toggle(
    "hidden",
    !person
  );

  const manager = person
    ? person.manager
    : managerId;

  fillManagers(manager);

  let position = null;

  if (person) {
    const ordered = siblings(person.manager);
    position = ordered.findIndex(
      p => sameId(p.id, person.id)
    );
  }

  fillPositions(position);

  $("personModal").classList.remove("hidden");
  $("personName").focus();
}

function closePersonModal() {
  $("personModal").classList.add("hidden");
  editingId = null;
}

$("personManager").addEventListener("change", () => {
  fillPositions();
});

$("personForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("personName").value.trim();
  const role = $("personRole").value.trim();
  const dept = $("personDept").value;

  const manager = selectedManager();
  const position = Number($("personPosition").value);

  if (!name || !role) {
    alert("Veuillez remplir le nom et le poste.");
    return;
  }

  if (editingId !== null) {
    const person = findPerson(editingId);
    if (!person) return;

    const forbidden = descendantsOf(editingId);
    forbidden.add(String(editingId));

    if (
      manager !== null &&
      forbidden.has(String(manager))
    ) {
      alert("Ce placement créerait une boucle.");
      return;
    }

    person.name = name;
    person.role = role;
    person.dept = dept;

    insertPerson(person, manager, position);

    notify("Collaborateur modifié.");
  } else {
    const person = {
      id: uid(),
      name,
      role,
      dept,
      manager: null,
      order: 0
    };

    people.push(person);

    insertPerson(person, manager, position);

    notify("Collaborateur ajouté !");
  }

  save();
  closePersonModal();
  renderChart();
});

$("deletePersonBtn").addEventListener("click", () => {
  if (editingId === null) return;

  const person = findPerson(editingId);
  if (!person) return;

  if (!confirm(`Supprimer ${person.name} ?`)) {
    return;
  }

  const oldManager = person.manager;

  people.forEach(p => {
    if (sameManager(p.manager, person.id)) {
      p.manager = oldManager;
    }
  });

  people = people.filter(
    p => !sameId(p.id, person.id)
  );

  normalizeOrders(oldManager);

  save();
  closePersonModal();
  renderChart();

  notify("Collaborateur supprimé.");
});

$("addBtn").addEventListener("click", () => {
  openPersonModal();
});

$("sidebarAdd").addEventListener("click", () => {
  openPersonModal();
});

$("closePersonModal").addEventListener(
  "click",
  closePersonModal
);

$("cancelPersonBtn").addEventListener(
  "click",
  closePersonModal
);

// ======================================
// CLICS SUR LES CARTES
// ======================================

$("chart").addEventListener("click", event => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }

  const add = event.target.closest("[data-add-under]");

  if (add) {
    const parent = findPerson(add.dataset.addUnder);

    if (parent) {
      openPersonModal(null, parent.id);
    }
    return;
  }

  const card = event.target.closest("[data-person-id]");

  if (card) {
    const person = findPerson(card.dataset.personId);

    if (person) {
      openPersonModal(person.id);
    }
  }
});

// Fermeture des fenêtres
$("personModal").addEventListener("click", event => {
  if (event.target === $("personModal")) {
    closePersonModal();
  }
});

$("projectModal").addEventListener("click", event => {
  if (event.target === $("projectModal")) {
    closeProjectModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closePersonModal();
    closeProjectModal();
  }
});

// ======================================
// ZOOM
// ======================================

function applyTransform() {
  const viewport = $("viewport");
  if (!viewport) return;

  viewport.setAttribute(
    "transform",
    `translate(${offsetX},${offsetY}) scale(${scale})`
  );

  $("zoomValue").textContent =
    Math.round(scale * 100) + "%";
}

function fitChart() {
  const rect = $("canvas").getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  scale = Math.min(
    1.2,
    Math.max(100, rect.width - 70) / chartWidth,
    Math.max(100, rect.height - 135) / chartHeight
  );

  scale = Math.max(0.15, scale);

  offsetX = (rect.width - chartWidth * scale) / 2;
  offsetY = (rect.height - chartHeight * scale) / 2 + 20;

  applyTransform();
}

function zoom(factor, clientX, clientY) {
  const rect = $("canvas").getBoundingClientRect();

  const px = clientX - rect.left;
  const py = clientY - rect.top;

  const next = Math.min(
    2.5,
    Math.max(0.15, scale * factor)
  );

  const ratio = next / scale;

  offsetX = px - (px - offsetX) * ratio;
  offsetY = py - (py - offsetY) * ratio;

  scale = next;
  applyTransform();
}

function zoomCenter(factor) {
  const rect = $("canvas").getBoundingClientRect();

  zoom(
    factor,
    rect.left + rect.width / 2,
    rect.top + rect.height / 2
  );
}

$("zoomIn").addEventListener("click", () => {
  zoomCenter(1.2);
});

$("zoomOut").addEventListener("click", () => {
  zoomCenter(1 / 1.2);
});

$("fitBtn").addEventListener("click", fitChart);

$("canvas").addEventListener(
  "wheel",
  event => {
    event.preventDefault();

    zoom(
      event.deltaY < 0 ? 1.1 : 1 / 1.1,
      event.clientX,
      event.clientY
    );
  },
  { passive: false }
);

// ======================================
// DÉPLACEMENT DU FOND
// ======================================

const canvas = $("canvas");

canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;

  // Les cartes restent cliquables.
  if (event.target.closest("[data-person-id]")) {
    drag = null;
    suppressClick = false;
    return;
  }

  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    moved: false
  };

  suppressClick = false;

  // Capture seulement pour déplacer le fond.
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", event => {
  if (!drag || drag.id !== event.pointerId) return;

  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;

  const distance = Math.hypot(
    event.clientX - drag.startX,
    event.clientY - drag.startY
  );

  if (distance > 5) {
    drag.moved = true;
  }

  if (drag.moved) {
    offsetX += dx;
    offsetY += dy;
    applyTransform();
  }

  drag.x = event.clientX;
  drag.y = event.clientY;
});

canvas.addEventListener("pointerup", event => {
  if (!drag || drag.id !== event.pointerId) return;

  suppressClick = drag.moved;
  drag = null;

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

canvas.addEventListener("pointercancel", () => {
  drag = null;
  suppressClick = false;
});

// ======================================
// EXPORT PNG
// ======================================

$("exportBtn").addEventListener("click", () => {
  const width = Math.ceil(chartWidth);
  const height = Math.ceil(chartHeight);

  if (width > 12000 || height > 12000) {
    alert("Organigramme trop grand pour l'export.");
    return;
  }

  const clone = $("chart").cloneNode(true);

  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const viewport = clone.querySelector("#viewport");

  if (!viewport) return;

  viewport.setAttribute(
    "transform",
    "translate(0,0) scale(1)"
  );

  const background = document.createElementNS(NS, "rect");

  background.setAttribute("width", width);
  background.setAttribute("height", height);
  background.setAttribute("fill", "#ffffff");

  clone.insertBefore(background, viewport);

  const xml = new XMLSerializer().serializeToString(clone);

  const blob = new Blob([xml], {
    type: "image/svg+xml;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const image = new Image();

  image.onload = () => {
    const output = document.createElement("canvas");

    output.width = width * 2;
    output.height = height * 2;

    const ctx = output.getContext("2d");

    if (!ctx) {
      URL.revokeObjectURL(url);
      alert("Impossible de créer l'image.");
      return;
    }

    ctx.scale(2, 2);
    ctx.drawImage(image, 0, 0, width, height);

    URL.revokeObjectURL(url);

    output.toBlob(png => {
      if (!png) {
        alert("Erreur pendant l'export PNG.");
        return;
      }

      const downloadUrl = URL.createObjectURL(png);
      const link = document.createElement("a");

      const filename = currentProject().name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_-]/gi, "_");

      link.href = downloadUrl;
      link.download = `${filename}.png`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);

      notify("PNG exporté !");
    }, "image/png");
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    alert("Erreur lors de l'export PNG.");
  };

  image.src = url;
});

// ======================================
// DÉMARRAGE
// ======================================

renderTabs();
renderChart();
save();

window.addEventListener("resize", fitChart);
