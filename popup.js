// Popup script for Hedgehog Mode extension
// Uses shared constants from shared.js: COLOR_TO_FILTER_MAP, SKINS_AND_COLORS,
// HEADWEAR, EYEWEAR, OTHER_ACCESSORIES, ACCESSORY_CATEGORIES

let currentConfig = {
  skin: 'default',
  color: null,
  accessories: [],
  walking_enabled: true,
  interactions_enabled: true,
  controls_enabled: true,
  sound_enabled: false,
  hedgehog_count: 1,
};

// Get the current skin+color combo ID
function getCurrentSkinColorId() {
  if (currentConfig.skin === 'spiderhog') return 'spiderhog';
  if (currentConfig.skin === 'robohog') return 'robohog';
  return currentConfig.color || 'default';
}

// Create a preview button with hedgehog sprite
function createPreviewButton(skin, color, accessoryImg, title) {
  const btn = document.createElement('button');
  btn.className = 'preview-btn';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.setAttribute('aria-pressed', 'false');

  const container = document.createElement('div');
  container.className = 'sprite-container';

  const sprite = document.createElement('div');
  sprite.className = 'sprite';
  sprite.style.backgroundImage = `url('sprites/skins/${skin}/wave.png')`;
  if (color && COLOR_TO_FILTER_MAP[color]) {
    sprite.style.filter = COLOR_TO_FILTER_MAP[color];
  }
  container.appendChild(sprite);

  if (accessoryImg) {
    const accessory = document.createElement('img');
    accessory.className = 'accessory';
    accessory.src = `sprites/accessories/${accessoryImg}.png`;
    if (color && COLOR_TO_FILTER_MAP[color]) {
      accessory.style.filter = COLOR_TO_FILTER_MAP[color];
    }
    container.appendChild(accessory);
  }

  btn.appendChild(container);
  return btn;
}

// Initialize skins and colors grid
function initSkinsGrid() {
  const container = document.getElementById('skinsGrid');
  SKINS_AND_COLORS.forEach((item) => {
    const btn = createPreviewButton(item.skin, item.color, null, item.name);
    btn.dataset.skinColor = item.id;
    btn.addEventListener('click', () => selectSkinColor(item));
    container.appendChild(btn);
  });
}

// Initialize an accessory grid for a given category
function initAccessoryGrid(gridId, category) {
  const container = document.getElementById(gridId);
  category.items.forEach((item) => {
    const btn = createPreviewButton('default', null, item.img, item.name);
    btn.dataset[category.key] = item.id;
    btn.addEventListener('click', () => selectAccessory(item.id, category));
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

// Generic accessory selection (only one per category at a time)
function selectAccessory(id, category) {
  const categoryIds = category.items.filter(item => item.img).map(item => item.id);
  currentConfig.accessories = currentConfig.accessories.filter(a => !categoryIds.includes(a));
  if (id !== category.noneId) {
    currentConfig.accessories.push(id);
  }
  updateUI();
  saveAndSendConfig();
}

// Get currently selected accessory for a category
function getCurrentAccessory(category) {
  const categoryIds = category.items.filter(item => item.img).map(item => item.id);
  return currentConfig.accessories.find(a => categoryIds.includes(a)) || category.noneId;
}

// Update the main preview
function updatePreview() {
  const container = document.getElementById('previewHedgehog');
  const sprite = document.getElementById('previewSprite');

  container.querySelectorAll('.accessory').forEach(el => el.remove());

  sprite.style.backgroundImage = `url('sprites/skins/${currentConfig.skin}/wave.png')`;
  if (currentConfig.color && COLOR_TO_FILTER_MAP[currentConfig.color]) {
    sprite.style.filter = COLOR_TO_FILTER_MAP[currentConfig.color];
  } else {
    sprite.style.filter = '';
  }

  const allItems = ACCESSORY_CATEGORIES.flatMap(cat => cat.items);
  currentConfig.accessories.forEach((accId) => {
    const acc = allItems.find(a => a.id === accId);
    if (acc && acc.img) {
      const accessory = document.createElement('img');
      accessory.className = 'accessory';
      accessory.src = `sprites/accessories/${acc.img}.png`;
      if (currentConfig.color && COLOR_TO_FILTER_MAP[currentConfig.color]) {
        accessory.style.filter = COLOR_TO_FILTER_MAP[currentConfig.color];
      }
      container.appendChild(accessory);
    }
  });
}

// Update UI to reflect current config
function updateUI() {
  const currentSkinColorId = getCurrentSkinColorId();

  document.querySelectorAll('#skinsGrid .preview-btn').forEach((btn) => {
    const isActive = btn.dataset.skinColor === currentSkinColorId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  ACCESSORY_CATEGORIES.forEach((category) => {
    const current = getCurrentAccessory(category);
    const gridId = category.key + 'Grid';
    document.querySelectorAll(`#${gridId} .preview-btn`).forEach((btn) => {
      const isActive = btn.dataset[category.key] === current;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  });

  document.getElementById('walkingEnabled').checked = currentConfig.walking_enabled;
  document.getElementById('interactionsEnabled').checked = currentConfig.interactions_enabled;
  document.getElementById('controlsEnabled').checked = currentConfig.controls_enabled;
  document.getElementById('soundEnabled').checked = currentConfig.sound_enabled;
  document.getElementById('hedgehogCount').textContent = currentConfig.hedgehog_count || 1;

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
          if (response.config) {
            currentConfig = { ...currentConfig, ...response.config };
            updateUI();
          }
        }
      });
    }
  });
}

// Per-site disable support
function initSiteToggle() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) return;
    const hostname = new URL(tabs[0].url).hostname;
    if (!hostname) return;

    const label = document.getElementById('siteToggleLabel');
    label.textContent = `Disable on ${hostname}`;

    chrome.storage.sync.get(['disabledSites'], (result) => {
      const disabledSites = result.disabledSites || [];
      document.getElementById('siteToggle').checked = disabledSites.includes(hostname);
    });

    document.getElementById('siteToggle').addEventListener('change', (e) => {
      chrome.storage.sync.get(['disabledSites'], (result) => {
        let disabledSites = result.disabledSites || [];
        if (e.target.checked) {
          if (!disabledSites.includes(hostname)) {
            disabledSites.push(hostname);
          }
          // Stop hedgehog on this site
          chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_HEDGEHOG' }).catch(() => {});
        } else {
          disabledSites = disabledSites.filter(s => s !== hostname);
        }
        chrome.storage.sync.set({ disabledSites });
      });
    });
  });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  initSkinsGrid();
  ACCESSORY_CATEGORIES.forEach((category) => {
    initAccessoryGrid(category.key + 'Grid', category);
  });
  initSiteToggle();

  chrome.storage.sync.get(['hedgehogEnabled', 'hedgehogConfig'], (result) => {
    if (result.hedgehogConfig) {
      currentConfig = { ...currentConfig, ...result.hedgehogConfig };
    }
    document.getElementById('enableToggle').checked = result.hedgehogEnabled || false;
    updateUI();
  });

  getStatus();

  document.getElementById('enableToggle').addEventListener('change', (e) => {
    toggleHedgehog(e.target.checked);
  });

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

  document.getElementById('soundEnabled').addEventListener('change', (e) => {
    currentConfig.sound_enabled = e.target.checked;
    saveAndSendConfig();
  });

  document.getElementById('countDown').addEventListener('click', () => {
    const count = Math.max(1, (currentConfig.hedgehog_count || 1) - 1);
    currentConfig.hedgehog_count = count;
    document.getElementById('hedgehogCount').textContent = count;
    saveAndSendConfig();
  });

  document.getElementById('countUp').addEventListener('click', () => {
    const count = Math.min(5, (currentConfig.hedgehog_count || 1) + 1);
    currentConfig.hedgehog_count = count;
    document.getElementById('hedgehogCount').textContent = count;
    saveAndSendConfig();
  });
});
