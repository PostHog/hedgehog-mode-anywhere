// Popup script for Hedgehog Mode extension

const accessories = [
  { id: 'beret', name: 'Beret' },
  { id: 'cap', name: 'Cap' },
  { id: 'chef', name: 'Chef Hat' },
  { id: 'cowboy', name: 'Cowboy' },
  { id: 'eyepatch', name: 'Eyepatch' },
  { id: 'glasses', name: 'Glasses' },
  { id: 'graduation', name: 'Graduation' },
  { id: 'parrot', name: 'Parrot' },
  { id: 'party', name: 'Party Hat' },
  { id: 'pineapple', name: 'Pineapple' },
  { id: 'sunglasses', name: 'Sunglasses' },
  { id: 'tophat', name: 'Top Hat' },
  { id: 'xmas_hat', name: 'Xmas Hat' },
  { id: 'xmas_antlers', name: 'Antlers' },
  { id: 'xmas_scarf', name: 'Scarf' },
];

let currentConfig = {
  skin: 'default',
  color: null,
  accessories: [],
  walking_enabled: true,
  interactions_enabled: true,
  controls_enabled: true,
};

// Initialize accessory buttons
function initAccessories() {
  const container = document.getElementById('accessoryOptions');
  accessories.forEach((acc) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.accessory = acc.id;
    btn.title = acc.name;
    btn.innerHTML = `<span class="skin-option" style="font-size: 8px;">${acc.name.slice(0, 6)}</span>`;
    btn.addEventListener('click', () => toggleAccessory(acc.id));
    container.appendChild(btn);
  });
}

// Toggle accessory
function toggleAccessory(id) {
  const index = currentConfig.accessories.indexOf(id);
  if (index === -1) {
    currentConfig.accessories.push(id);
  } else {
    currentConfig.accessories.splice(index, 1);
  }
  updateUI();
  saveAndSendConfig();
}

// Update UI to reflect current config
function updateUI() {
  // Update skin buttons
  document.querySelectorAll('#skinOptions .option-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.skin === currentConfig.skin);
  });

  // Update color buttons
  document.querySelectorAll('#colorOptions .option-btn').forEach((btn) => {
    btn.classList.toggle('active', (btn.dataset.color || null) === currentConfig.color);
  });

  // Update accessory buttons
  document.querySelectorAll('#accessoryOptions .option-btn').forEach((btn) => {
    btn.classList.toggle('active', currentConfig.accessories.includes(btn.dataset.accessory));
  });

  // Update checkboxes
  document.getElementById('walkingEnabled').checked = currentConfig.walking_enabled;
  document.getElementById('interactionsEnabled').checked = currentConfig.interactions_enabled;
  document.getElementById('controlsEnabled').checked = currentConfig.controls_enabled;
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

// Set hedgehog on fire
function setOnFire() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_ON_FIRE' }).catch(() => {});
    }
  });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  initAccessories();

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

  // Skin buttons
  document.querySelectorAll('#skinOptions .option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentConfig.skin = btn.dataset.skin;
      updateUI();
      saveAndSendConfig();
    });
  });

  // Color buttons
  document.querySelectorAll('#colorOptions .option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentConfig.color = btn.dataset.color || null;
      updateUI();
      saveAndSendConfig();
    });
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

  // Fire button
  document.getElementById('fireBtn').addEventListener('click', setOnFire);
});
