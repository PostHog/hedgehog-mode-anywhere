// Popup script for Hedgehog Mode extension

// Color filters matching content.js
const colorFilters = {
  red: 'hue-rotate(340deg) saturate(300%) brightness(90%)',
  green: 'hue-rotate(60deg) saturate(100%)',
  blue: 'hue-rotate(210deg) saturate(300%) brightness(90%)',
  purple: 'hue-rotate(240deg)',
  dark: 'brightness(70%)',
  light: 'brightness(130%)',
  sepia: 'sepia(100%) saturate(300%) brightness(70%)',
  invert: 'invert(100%)',
  'invert-hue': 'invert(100%) hue-rotate(180deg)',
  greyscale: 'saturate(0%)',
};

// Skins and colors combined - each item shows a specific skin+color combo
const skinsAndColors = [
  { id: 'default', skin: 'default', color: null, name: 'Default' },
  { id: 'spiderhog', skin: 'spiderhog', color: null, name: 'Spiderhog' },
  { id: 'robohog', skin: 'robohog', color: null, name: 'Robohog' },
  { id: 'red', skin: 'default', color: 'red', name: 'Red' },
  { id: 'green', skin: 'default', color: 'green', name: 'Green' },
  { id: 'blue', skin: 'default', color: 'blue', name: 'Blue' },
  { id: 'purple', skin: 'default', color: 'purple', name: 'Purple' },
  { id: 'dark', skin: 'default', color: 'dark', name: 'Dark' },
  { id: 'light', skin: 'default', color: 'light', name: 'Light' },
  { id: 'sepia', skin: 'default', color: 'sepia', name: 'Sepia' },
  { id: 'greyscale', skin: 'default', color: 'greyscale', name: 'Greyscale' },
  { id: 'invert', skin: 'default', color: 'invert', name: 'Inverted' },
  { id: 'invert-hue', skin: 'default', color: 'invert-hue', name: 'Invert Hue' },
];

// Accessories organized by category
const headwear = [
  { id: 'none_headwear', name: 'None' },
  { id: 'beret', name: 'Beret', img: 'beret' },
  { id: 'cap', name: 'Cap', img: 'cap' },
  { id: 'chef', name: 'Chef Hat', img: 'chef' },
  { id: 'cowboy', name: 'Cowboy', img: 'cowboy' },
  { id: 'flag', name: 'Flag', img: 'flag' },
  { id: 'graduation', name: 'Graduation', img: 'graduation' },
  { id: 'party', name: 'Party Hat', img: 'party' },
  { id: 'pineapple', name: 'Pineapple', img: 'pineapple' },
  { id: 'tophat', name: 'Top Hat', img: 'tophat' },
  { id: 'xmas_hat', name: 'Xmas Hat', img: 'xmas-hat' },
  { id: 'xmas_antlers', name: 'Antlers', img: 'xmas-antlers' },
];

const eyewear = [
  { id: 'none_eyewear', name: 'None' },
  { id: 'glasses', name: 'Glasses', img: 'glasses' },
  { id: 'sunglasses', name: 'Sunglasses', img: 'sunglasses' },
  { id: 'eyepatch', name: 'Eyepatch', img: 'eyepatch' },
];

const otherAccessories = [
  { id: 'none_other', name: 'None' },
  { id: 'parrot', name: 'Parrot', img: 'parrot' },
  { id: 'xmas_scarf', name: 'Scarf', img: 'xmas-scarf' },
];

let currentConfig = {
  skin: 'default',
  color: null,
  accessories: [],
  walking_enabled: true,
  interactions_enabled: true,
  controls_enabled: true,
};

// Get the current skin+color combo ID
function getCurrentSkinColorId() {
  // Check if it's a special skin
  if (currentConfig.skin === 'spiderhog') return 'spiderhog';
  if (currentConfig.skin === 'robohog') return 'robohog';
  // Otherwise it's default skin with a color
  return currentConfig.color || 'default';
}

// Create a preview button with hedgehog sprite
function createPreviewButton(skin, color, accessoryImg, title) {
  const btn = document.createElement('button');
  btn.className = 'preview-btn';
  btn.title = title;

  const container = document.createElement('div');
  container.className = 'sprite-container';

  const sprite = document.createElement('div');
  sprite.className = 'sprite';
  sprite.style.backgroundImage = `url('sprites/skins/${skin}/wave.png')`;
  if (color && colorFilters[color]) {
    sprite.style.filter = colorFilters[color];
  }
  container.appendChild(sprite);

  if (accessoryImg) {
    const accessory = document.createElement('img');
    accessory.className = 'accessory';
    accessory.src = `sprites/accessories/${accessoryImg}.png`;
    if (color && colorFilters[color]) {
      accessory.style.filter = colorFilters[color];
    }
    container.appendChild(accessory);
  }

  btn.appendChild(container);
  return btn;
}

// Initialize skins and colors grid
function initSkinsGrid() {
  const container = document.getElementById('skinsGrid');
  skinsAndColors.forEach((item) => {
    const btn = createPreviewButton(item.skin, item.color, null, item.name);
    btn.dataset.skinColor = item.id;
    btn.addEventListener('click', () => selectSkinColor(item));
    container.appendChild(btn);
  });
}

// Initialize headwear grid
function initHeadwearGrid() {
  const container = document.getElementById('headwearGrid');
  headwear.forEach((item) => {
    const btn = createPreviewButton('default', null, item.img, item.name);
    btn.dataset.headwear = item.id;
    btn.addEventListener('click', () => selectHeadwear(item.id));
    container.appendChild(btn);
  });
}

// Initialize eyewear grid
function initEyewearGrid() {
  const container = document.getElementById('eyewearGrid');
  eyewear.forEach((item) => {
    const btn = createPreviewButton('default', null, item.img, item.name);
    btn.dataset.eyewear = item.id;
    btn.addEventListener('click', () => selectEyewear(item.id));
    container.appendChild(btn);
  });
}

// Initialize other accessories grid
function initOtherGrid() {
  const container = document.getElementById('otherGrid');
  otherAccessories.forEach((item) => {
    const btn = createPreviewButton('default', null, item.img, item.name);
    btn.dataset.other = item.id;
    btn.addEventListener('click', () => selectOther(item.id));
    container.appendChild(btn);
  });
}

// Select skin/color combo
function selectSkinColor(item) {
  currentConfig.skin = item.skin;
  currentConfig.color = item.color;
  updateUI();
  saveAndSendConfig();
}

// Select headwear (only one at a time)
function selectHeadwear(id) {
  const headwearIds = headwear.filter(h => h.img).map(h => h.id);
  // Remove any existing headwear
  currentConfig.accessories = currentConfig.accessories.filter(a => !headwearIds.includes(a));
  // Add new headwear if not "none"
  if (id !== 'none_headwear') {
    currentConfig.accessories.push(id);
  }
  updateUI();
  saveAndSendConfig();
}

// Select eyewear (only one at a time)
function selectEyewear(id) {
  const eyewearIds = eyewear.filter(e => e.img).map(e => e.id);
  // Remove any existing eyewear
  currentConfig.accessories = currentConfig.accessories.filter(a => !eyewearIds.includes(a));
  // Add new eyewear if not "none"
  if (id !== 'none_eyewear') {
    currentConfig.accessories.push(id);
  }
  updateUI();
  saveAndSendConfig();
}

// Select other accessory (only one at a time)
function selectOther(id) {
  const otherIds = otherAccessories.filter(o => o.img).map(o => o.id);
  // Remove any existing other accessories
  currentConfig.accessories = currentConfig.accessories.filter(a => !otherIds.includes(a));
  // Add new accessory if not "none"
  if (id !== 'none_other') {
    currentConfig.accessories.push(id);
  }
  updateUI();
  saveAndSendConfig();
}

// Update the main preview
function updatePreview() {
  const container = document.getElementById('previewHedgehog');
  const sprite = document.getElementById('previewSprite');

  // Remove old accessories
  container.querySelectorAll('.accessory').forEach(el => el.remove());

  // Update sprite
  sprite.style.backgroundImage = `url('sprites/skins/${currentConfig.skin}/wave.png')`;
  if (currentConfig.color && colorFilters[currentConfig.color]) {
    sprite.style.filter = colorFilters[currentConfig.color];
  } else {
    sprite.style.filter = '';
  }

  // Add accessories
  currentConfig.accessories.forEach((accId) => {
    // Find the accessory image name
    const allAccessories = [...headwear, ...eyewear, ...otherAccessories];
    const acc = allAccessories.find(a => a.id === accId);
    if (acc && acc.img) {
      const accessory = document.createElement('img');
      accessory.className = 'accessory';
      accessory.src = `sprites/accessories/${acc.img}.png`;
      if (currentConfig.color && colorFilters[currentConfig.color]) {
        accessory.style.filter = colorFilters[currentConfig.color];
      }
      container.appendChild(accessory);
    }
  });
}

// Get currently selected headwear
function getCurrentHeadwear() {
  const headwearIds = headwear.filter(h => h.img).map(h => h.id);
  return currentConfig.accessories.find(a => headwearIds.includes(a)) || 'none_headwear';
}

// Get currently selected eyewear
function getCurrentEyewear() {
  const eyewearIds = eyewear.filter(e => e.img).map(e => e.id);
  return currentConfig.accessories.find(a => eyewearIds.includes(a)) || 'none_eyewear';
}

// Get currently selected other accessory
function getCurrentOther() {
  const otherIds = otherAccessories.filter(o => o.img).map(o => o.id);
  return currentConfig.accessories.find(a => otherIds.includes(a)) || 'none_other';
}

// Update UI to reflect current config
function updateUI() {
  const currentSkinColorId = getCurrentSkinColorId();

  // Update skin/color buttons
  document.querySelectorAll('#skinsGrid .preview-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.skinColor === currentSkinColorId);
  });

  // Update headwear buttons
  const currentHeadwear = getCurrentHeadwear();
  document.querySelectorAll('#headwearGrid .preview-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.headwear === currentHeadwear);
  });

  // Update eyewear buttons
  const currentEyewear = getCurrentEyewear();
  document.querySelectorAll('#eyewearGrid .preview-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.eyewear === currentEyewear);
  });

  // Update other buttons
  const currentOther = getCurrentOther();
  document.querySelectorAll('#otherGrid .preview-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.other === currentOther);
  });

  // Update checkboxes
  document.getElementById('walkingEnabled').checked = currentConfig.walking_enabled;
  document.getElementById('interactionsEnabled').checked = currentConfig.interactions_enabled;
  document.getElementById('controlsEnabled').checked = currentConfig.controls_enabled;

  // Update preview
  updatePreview();
}

// Save config and send to content script
function saveAndSendConfig() {
  chrome.storage.sync.set({ hedgehogConfig: currentConfig });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'UPDATE_CONFIG',
        config: currentConfig,
      }).catch(() => {
        // Tab might not have content script loaded
      });
    }
  });
}

// Toggle hedgehog on/off
function toggleHedgehog(enabled) {
  chrome.storage.sync.set({ hedgehogEnabled: enabled });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_HEDGEHOG' }).catch(() => {
        // If content script isn't loaded, reload the page
        if (enabled) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    }
  });
}

// Get current status from content script
function getStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' }, (response) => {
        if (response) {
          document.getElementById('enableToggle').checked = response.enabled;
        }
      });
    }
  });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  initSkinsGrid();
  initHeadwearGrid();
  initEyewearGrid();
  initOtherGrid();

  // Load saved config
  chrome.storage.sync.get(['hedgehogEnabled', 'hedgehogConfig'], (result) => {
    if (result.hedgehogConfig) {
      currentConfig = { ...currentConfig, ...result.hedgehogConfig };
    }
    document.getElementById('enableToggle').checked = result.hedgehogEnabled || false;
    updateUI();
  });

  // Get current status
  getStatus();

  // Enable toggle
  document.getElementById('enableToggle').addEventListener('change', (e) => {
    toggleHedgehog(e.target.checked);
  });

  // Option checkboxes
  document.getElementById('walkingEnabled').addEventListener('change', (e) => {
    currentConfig.walking_enabled = e.target.checked;
    saveAndSendConfig();
  });

  document.getElementById('interactionsEnabled').addEventListener('change', (e) => {
    currentConfig.interactions_enabled = e.target.checked;
    saveAndSendConfig();
  });

  document.getElementById('controlsEnabled').addEventListener('change', (e) => {
    currentConfig.controls_enabled = e.target.checked;
    saveAndSendConfig();
  });
});
