// Hedgehog Mode Browser Extension
// Standalone implementation of PostHog's beloved hedgehog buddy

(function() {
  'use strict';

  // Constants
  const SPRITE_SIZE = 80;
  const SHADOW_HEIGHT = SPRITE_SIZE / 8;
  const SPRITE_SHEET_WIDTH = SPRITE_SIZE * 8;
  const X_FRAMES = SPRITE_SHEET_WIDTH / SPRITE_SIZE;
  const FPS = 24;
  const GRAVITY_PIXELS = 10;
  const MAX_JUMP_COUNT = 2;

  // Base URL for sprites (served from extension)
  const getBaseSpritePath = () => chrome.runtime.getURL('sprites');

  // Sprite URL helpers
  const spriteUrl = (skin, img) => `${getBaseSpritePath()}/skins/${skin}/${img}.png`;
  const spriteOverlayUrl = (img) => `${getBaseSpritePath()}/overlays/${img}.png`;
  const spriteAccessoryUrl = (img) => `${getBaseSpritePath()}/accessories/${img}.png`;

  // Color filters
  const COLOR_TO_FILTER_MAP = {
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

  // Animation definitions
  const standardAnimations = {
    stop: { img: 'wave', frames: 1, maxIteration: 50, randomChance: 1 },
    fall: { img: 'fall', frames: 9, forceDirection: 'left', randomChance: 0 },
    jump: {
      img: 'jump',
      frames: 10,
      maxIteration: 10,
      randomChance: 2,
      accessoryPositions: [
        [0, 0], [0, 1], [0, 2], [0, 0], [0, -3],
        [0, -5], [0, -5], [0, -4], [0, -2], [0, -1],
      ],
    },
    sign: { img: 'sign', frames: 33, maxIteration: 1, forceDirection: 'right', randomChance: 1 },
    walk: { img: 'walk', frames: 11, maxIteration: 20, randomChance: 10 },
    wave: { img: 'wave', frames: 26, maxIteration: 1, randomChance: 2 },
    flag: { img: 'flag', frames: 25, maxIteration: 1, randomChance: 1 },
    inspect: { img: 'inspect', frames: 36, maxIteration: 1, randomChance: 1 },
    phone: { img: 'phone', frames: 28, maxIteration: 1, randomChance: 1 },
    action: { img: 'action', frames: 16, maxIteration: 3, randomChance: 1 },
  };

  const overlayAnimations = {
    fire: { img: 'fire', frames: 14, maxIteration: 1, style: { opacity: 0.75 } },
  };

  const skins = {
    default: standardAnimations,
    spiderhog: {
      stop: standardAnimations.stop,
      fall: standardAnimations.fall,
      jump: standardAnimations.jump,
      walk: standardAnimations.walk,
      wave: standardAnimations.wave,
    },
    robohog: {
      stop: standardAnimations.stop,
      fall: standardAnimations.fall,
      jump: standardAnimations.jump,
      walk: standardAnimations.walk,
      wave: { ...standardAnimations.wave, frames: 23 },
    },
  };

  const standardAccessories = {
    beret: { img: 'beret', group: 'headwear' },
    cap: { img: 'cap', group: 'headwear' },
    chef: { img: 'chef', group: 'headwear' },
    cowboy: { img: 'cowboy', group: 'headwear' },
    eyepatch: { img: 'eyepatch', group: 'eyewear' },
    flag: { img: 'flag', group: 'headwear' },
    glasses: { img: 'glasses', group: 'eyewear' },
    graduation: { img: 'graduation', group: 'headwear' },
    parrot: { img: 'parrot', group: 'other' },
    party: { img: 'party', group: 'headwear' },
    pineapple: { img: 'pineapple', group: 'headwear' },
    sunglasses: { img: 'sunglasses', group: 'eyewear' },
    tophat: { img: 'tophat', group: 'headwear' },
    xmas_hat: { img: 'xmas-hat', group: 'headwear' },
    xmas_antlers: { img: 'xmas-antlers', group: 'headwear' },
    xmas_scarf: { img: 'xmas-scarf', group: 'other' },
  };

  // Utility functions
  const sampleOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  const elementToBox = (element) => {
    if (element === document.body) {
      return { x: 0, y: -1000, width: window.innerWidth, height: 1000 };
    }
    const isHedgehog = element.classList.contains('HedgehogBuddy');
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + (isHedgehog ? 20 : 0),
      y: window.innerHeight - rect.bottom + (isHedgehog ? 5 : 0),
      width: rect.width - (isHedgehog ? 40 : 0),
      height: rect.height - (isHedgehog ? 30 : 0),
    };
  };

  // HedgehogActor class
  class HedgehogActor {
    constructor(config = {}) {
      this.element = null;
      this.direction = 'right';
      this.x = Math.min(Math.max(0, Math.floor(Math.random() * window.innerWidth)), window.innerWidth - SPRITE_SIZE);
      this.y = Math.min(Math.max(0, Math.floor(Math.random() * window.innerHeight)), window.innerHeight - SPRITE_SIZE);
      this.followMouse = false;
      this.lastKnownMousePosition = null;
      this.isDragging = false;
      this.isControlledByUser = false;
      this.yVelocity = -30;
      this.xVelocity = 0;
      this.ground = null;
      this.jumpCount = 0;
      this.mainAnimation = null;
      this.overlayAnimation = null;
      this.gravity = GRAVITY_PIXELS;
      this.ignoreGroundAboveY = undefined;
      this.lastScreenPosition = [window.screenX, window.screenY + window.innerHeight];

      // Configuration
      this.config = {
        enabled: true,
        skin: 'default',
        color: null,
        accessories: [],
        walking_enabled: true,
        interactions_enabled: true,
        controls_enabled: true,
        ...config,
      };

      this.preloadAnimationSprites();
      this.setAnimation('fall');
    }

    animations() {
      return skins[this.config.skin] || skins.default;
    }

    preloadAnimationSprites() {
      for (const animation of Object.values(this.animations())) {
        const preload = document.createElement('link');
        preload.rel = 'preload';
        preload.as = 'image';
        preload.href = spriteUrl(this.config.skin, animation.img);
        document.head.appendChild(preload);
      }
    }

    accessories() {
      return (this.config.accessories || []).map((acc) => standardAccessories[acc]).filter(Boolean);
    }

    setOnFire(times = 3) {
      this.setOverlayAnimation('fire', {
        onComplete: () => {
          if (times === 1) {
            this.setOverlayAnimation(null);
          } else {
            this.setOnFire(times - 1);
          }
        },
      });
      this.setAnimation('stop', {});
      this.direction = sampleOne(['left', 'right']);
      this.xVelocity = this.direction === 'left' ? -5 : 5;
      this.jump();
    }

    setAnimation(animationName, options = {}) {
      const availableAnimations = this.animations();
      animationName = availableAnimations[animationName] ? animationName : 'stop';
      const spriteInfo = availableAnimations[animationName];

      this.mainAnimation = {
        name: animationName,
        frame: 0,
        iterations: options.iterations ?? (spriteInfo.maxIteration ? Math.max(1, Math.floor(Math.random() * spriteInfo.maxIteration)) : null),
        spriteInfo,
        onComplete: options.onComplete,
      };

      if (this.mainAnimation.name !== 'stop') {
        this.direction = this.mainAnimation.spriteInfo.forceDirection || sampleOne(['left', 'right']);
      }

      if (animationName === 'walk') {
        this.xVelocity = this.direction === 'left' ? -1 : 1;
      } else if (animationName === 'stop' && !this.isControlledByUser) {
        this.xVelocity = 0;
      }
    }

    setOverlayAnimation(animationName, options = {}) {
      if (!animationName) {
        this.overlayAnimation = null;
        return;
      }
      const spriteInfo = overlayAnimations[animationName];
      if (!spriteInfo) return;

      this.overlayAnimation = {
        name: animationName,
        frame: 0,
        iterations: 1,
        spriteInfo,
        onComplete: options.onComplete ?? (() => this.setOverlayAnimation(null)),
      };
    }

    setRandomAnimation(exclude = []) {
      if (this.mainAnimation?.name !== 'stop') {
        this.setAnimation('stop');
      } else {
        let randomChoiceList = Object.keys(this.animations()).reduce((acc, key) => {
          const newItems = range(this.animations()[key].randomChance || 0).map(() => key);
          acc.push(...newItems);
          return acc;
        }, []);

        randomChoiceList = this.config.walking_enabled
          ? randomChoiceList
          : randomChoiceList.filter((x) => x !== 'walk');
        randomChoiceList = randomChoiceList.filter((x) => !exclude.includes(x));
        this.setAnimation(sampleOne(randomChoiceList));
      }
    }

    jump() {
      if (this.jumpCount >= MAX_JUMP_COUNT) return;
      this.ground = null;
      this.jumpCount += 1;
      this.yVelocity = this.gravity * 5;
    }

    update() {
      const screenPosition = [window.screenX, window.screenY + window.innerHeight];
      const [screenMoveX, screenMoveY] = [
        screenPosition[0] - this.lastScreenPosition[0],
        screenPosition[1] - this.lastScreenPosition[1],
      ];
      this.lastScreenPosition = screenPosition;

      if (screenMoveX || screenMoveY) {
        this.ground = null;
        this.x -= screenMoveX;
        this.y += screenMoveY;
        this.ignoreGroundAboveY = -10000;

        if (screenMoveY < 0) {
          this.yVelocity = Math.max(this.yVelocity + screenMoveY * 10, -this.gravity * 20);
        }

        if (screenMoveX !== 0) {
          if (this.mainAnimation?.name !== 'stop') {
            this.setAnimation('stop');
          }
          this.xVelocity = Math.max(Math.min(this.xVelocity + screenMoveX * 10, 200), -200);
        }
      }

      this.applyVelocity();

      if (this.mainAnimation) {
        if (this.mainAnimation.name === 'fall' && !this.isFalling()) {
          this.setAnimation('stop');
        }

        this.mainAnimation.frame++;

        if (this.mainAnimation.frame >= this.mainAnimation.spriteInfo.frames) {
          this.mainAnimation.frame = 0;
          if (this.mainAnimation.iterations !== null) {
            this.mainAnimation.iterations -= 1;
          }

          if (this.mainAnimation.iterations === 0) {
            this.mainAnimation.iterations = null;
            const preventNextAnimation = this.mainAnimation.onComplete?.();
            if (!preventNextAnimation) {
              this.setRandomAnimation();
            }
          }
        }
      }

      if (this.overlayAnimation) {
        this.overlayAnimation.frame++;
        if (this.overlayAnimation.frame >= this.overlayAnimation.spriteInfo.frames) {
          this.overlayAnimation.frame = 0;
          if (this.overlayAnimation.iterations !== null) {
            this.overlayAnimation.iterations -= 1;
          }
          if (this.overlayAnimation.iterations === 0) {
            this.overlayAnimation.iterations = null;
            this.overlayAnimation.onComplete?.();
          }
        }
      }

      if (this.isDragging) return;

      this.x = this.x + this.xVelocity;

      if (this.x < 0) {
        this.x = 0;
        if (!this.isControlledByUser) {
          this.xVelocity = -this.xVelocity;
          this.direction = 'right';
        }
      }

      if (this.x > window.innerWidth - SPRITE_SIZE) {
        this.x = window.innerWidth - SPRITE_SIZE;
        if (!this.isControlledByUser) {
          this.xVelocity = -this.xVelocity;
          this.direction = 'left';
        }
      }
    }

    applyVelocity() {
      if (this.isDragging) {
        this.ground = null;
        return;
      }

      if (this.followMouse) {
        this.ground = null;
        const [clientX, clientY] = this.lastKnownMousePosition ?? [0, 0];
        const xDiff = clientX - this.x;
        const yDiff = window.innerHeight - clientY - this.y;
        const distance = Math.sqrt(xDiff ** 2 + yDiff ** 2);
        const speed = 3;
        const ratio = speed / distance;

        if (yDiff < 0) {
          this.yVelocity -= this.gravity;
        }

        this.yVelocity += yDiff * ratio;
        this.xVelocity += xDiff * ratio;
        this.y = this.y + this.yVelocity;
        if (this.y < 0) {
          this.y = 0;
          this.yVelocity = -this.yVelocity * 0.4;
        }
        this.x = this.x + this.xVelocity;
        this.direction = this.xVelocity > 0 ? 'right' : 'left';
        return;
      }

      this.ground = this.findGround();
      this.yVelocity -= this.gravity;

      if (!this.isControlledByUser && this.mainAnimation?.name !== 'walk' && this.onGround()) {
        this.xVelocity = this.xVelocity * 0.6;
      }

      let newY = this.y + this.yVelocity;

      if (this.yVelocity < 0) {
        const groundBoundingRect = elementToBox(this.ground);
        const groundY = groundBoundingRect.y + groundBoundingRect.height;

        if (newY <= groundY) {
          newY = groundY;
          this.yVelocity = -this.yVelocity * 0.4;
          this.ignoreGroundAboveY = undefined;
          this.jumpCount = 0;
        }
      } else {
        this.ground = null;
      }

      this.y = newY;
    }

    findGround() {
      if (!this.config.interactions_enabled || !this.element || this.y <= 0) {
        return document.body;
      }

      const hedgehogBox = elementToBox(this.element);

      if (this.ground && this.ground !== document.body) {
        const groundBoundingRect = elementToBox(this.ground);
        if (
          hedgehogBox.x + hedgehogBox.width > groundBoundingRect.x &&
          hedgehogBox.x < groundBoundingRect.x + groundBoundingRect.width &&
          groundBoundingRect.y + groundBoundingRect.height + hedgehogBox.height < window.innerHeight &&
          groundBoundingRect.y >= 0
        ) {
          return this.ground;
        }
      }

      const blocksWithBoxes = Array.from(
        document.querySelectorAll(
          'button, input, select, .btn, [role="button"], nav, header, footer, aside, .card, .modal, .dialog, .HedgehogBuddy'
        )
      )
        .filter((x) => x !== this.element)
        .map((block) => [block, elementToBox(block)]);

      let highestCandidate = null;

      blocksWithBoxes.forEach(([block, box]) => {
        if (box.y + box.height > window.innerHeight || box.y < 0) return;
        if (this.ignoreGroundAboveY && box.y + box.height > this.ignoreGroundAboveY) return;

        const isAboveOrOn =
          hedgehogBox.x + hedgehogBox.width > box.x &&
          hedgehogBox.x < box.x + box.width &&
          hedgehogBox.y >= box.y + box.height;

        if (isAboveOrOn) {
          if (!highestCandidate || box.y > highestCandidate[1].y) {
            highestCandidate = [block, box];
          }
        }
      });

      return highestCandidate?.[0] ?? document.body;
    }

    onGround() {
      if (this.ground) {
        const groundLevel = elementToBox(this.ground).y + elementToBox(this.ground).height;
        return this.y <= groundLevel;
      }
      return false;
    }

    isFalling() {
      return !this.onGround() && Math.abs(this.yVelocity) > 1;
    }

    render() {
      if (!this.element) {
        this.element = document.createElement('div');
        this.element.className = 'HedgehogBuddy';
        document.body.appendChild(this.element);

        this.spriteElement = document.createElement('div');
        this.spriteElement.className = 'HedgehogBuddy__sprite';
        this.element.appendChild(this.spriteElement);

        this.accessoryElements = [];
        this.overlayElement = null;

        this.setupEventListeners();
      }

      // Update position
      this.element.style.left = `${this.x}px`;
      this.element.style.bottom = `${this.y - SHADOW_HEIGHT * 0.5}px`;
      this.element.style.transition = !(this.isDragging || this.followMouse) ? `all ${1000 / FPS}ms` : 'none';

      // Update sprite transform (direction)
      this.spriteElement.style.transform = `scaleX(${this.direction === 'right' ? 1 : -1})`;

      // Update main animation
      if (this.mainAnimation) {
        const imageFilter = this.config.color ? COLOR_TO_FILTER_MAP[this.config.color] : 'none';
        this.spriteElement.style.backgroundImage = `url(${spriteUrl(this.config.skin, this.mainAnimation.spriteInfo.img)})`;
        this.spriteElement.style.backgroundPosition = `-${(this.mainAnimation.frame % X_FRAMES) * SPRITE_SIZE}px -${Math.floor(this.mainAnimation.frame / X_FRAMES) * SPRITE_SIZE}px`;
        this.spriteElement.style.filter = imageFilter;
      }

      // Update accessories
      const accessories = this.accessories();
      while (this.accessoryElements.length < accessories.length) {
        const accEl = document.createElement('div');
        accEl.className = 'HedgehogBuddy__accessory';
        this.spriteElement.appendChild(accEl);
        this.accessoryElements.push(accEl);
      }
      while (this.accessoryElements.length > accessories.length) {
        const accEl = this.accessoryElements.pop();
        accEl.remove();
      }

      const accessoryPosition = this.mainAnimation?.spriteInfo.accessoryPositions?.[this.mainAnimation.frame];
      accessories.forEach((accessory, index) => {
        const accEl = this.accessoryElements[index];
        const imageFilter = this.config.color ? COLOR_TO_FILTER_MAP[this.config.color] : 'none';
        accEl.style.backgroundImage = `url(${spriteAccessoryUrl(accessory.img)})`;
        accEl.style.transform = accessoryPosition ? `translate3d(${accessoryPosition[0]}px, ${accessoryPosition[1]}px, 0)` : '';
        accEl.style.filter = imageFilter;
      });

      // Update overlay animation
      if (this.overlayAnimation) {
        if (!this.overlayElement) {
          this.overlayElement = document.createElement('div');
          this.overlayElement.className = 'HedgehogBuddy__overlay';
          this.spriteElement.appendChild(this.overlayElement);
        }
        this.overlayElement.style.backgroundImage = `url(${spriteOverlayUrl(this.overlayAnimation.spriteInfo.img)})`;
        this.overlayElement.style.backgroundPosition = `-${(this.overlayAnimation.frame % X_FRAMES) * SPRITE_SIZE}px -${Math.floor(this.overlayAnimation.frame / X_FRAMES) * SPRITE_SIZE}px`;
        this.overlayElement.style.opacity = this.overlayAnimation.spriteInfo.style?.opacity ?? 1;
        this.overlayElement.style.display = 'block';
      } else if (this.overlayElement) {
        this.overlayElement.style.display = 'none';
      }
    }

    setupEventListeners() {
      // Drag support
      const onTouchOrMouseStart = (e) => {
        let moved = false;
        const lastPositions = [];

        const onMove = (e) => {
          moved = true;
          this.isDragging = true;
          this.setAnimation('fall');

          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;

          this.x = clientX - SPRITE_SIZE / 2;
          this.y = window.innerHeight - clientY - SPRITE_SIZE / 2;

          lastPositions.push([clientX, clientY, Date.now()]);
        };

        const onEnd = () => {
          this.isDragging = false;

          const relevantPositions = lastPositions.filter(([_x, _y, t]) => {
            return t > Date.now() - 500 && t < Date.now() - 20;
          });

          const [xPixelsPerSecond, yPixelsPerSecond] = relevantPositions.reduce(
            ([x, y], [x2, y2, t2], i) => {
              if (i === 0) return [0, 0];
              const dt = (t2 - relevantPositions[i - 1][2]) / 1000;
              return [
                x + (x2 - relevantPositions[i - 1][0]) / dt,
                y + (y2 - relevantPositions[i - 1][1]) / dt,
              ];
            },
            [0, 0]
          );

          if (relevantPositions.length) {
            const maxVelocity = 250;
            this.xVelocity = Math.min(maxVelocity, xPixelsPerSecond / relevantPositions.length / FPS);
            this.yVelocity = Math.min(maxVelocity, (yPixelsPerSecond / relevantPositions.length / FPS) * -1);
          }

          this.setAnimation('fall');
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('touchend', onEnd);
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onEnd);
        };

        window.addEventListener('touchmove', onMove);
        window.addEventListener('touchend', onEnd);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
      };

      this.element.addEventListener('touchstart', onTouchOrMouseStart);
      this.element.addEventListener('mousedown', onTouchOrMouseStart);

      // Keyboard controls
      const lastKeys = [];
      const secretMap = [
        { keys: ['f', 'f', 'f'], action: () => this.setOnFire() },
        { keys: ['f', 'i', 'r', 'e'], action: () => this.setOnFire() },
        { keys: ['s', 'p', 'i', 'd', 'e', 'r', 'h', 'o', 'g'], action: () => { this.config.skin = 'spiderhog'; } },
        { keys: ['r', 'o', 'b', 'o', 'h', 'o', 'g'], action: () => { this.config.skin = 'robohog'; } },
        {
          keys: ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'],
          action: () => {
            this.setOnFire();
            this.gravity = -2;
            setTimeout(() => { this.gravity = GRAVITY_PIXELS; }, 2000);
          },
        },
      ];

      const keyDownListener = (e) => {
        if (!this.config.controls_enabled) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

        const key = e.key.toLowerCase();
        lastKeys.push(key);
        if (lastKeys.length > 20) lastKeys.shift();

        if ([' ', 'w', 'arrowup'].includes(key)) {
          this.jump();
          e.preventDefault();
        }

        secretMap.forEach((secret) => {
          if (lastKeys.slice(-secret.keys.length).join('') === secret.keys.join('')) {
            secret.action();
            lastKeys.splice(-secret.keys.length);
          }
        });

        if (['arrowdown', 's'].includes(key)) {
          if (this.ground === document.body) {
            if (this.mainAnimation?.name !== 'wave') {
              this.setAnimation('wave');
            }
          } else if (this.ground) {
            const box = elementToBox(this.ground);
            this.ignoreGroundAboveY = box.y + box.height - SPRITE_SIZE;
            this.ground = null;
            this.setAnimation('fall');
          }
        }

        if (['arrowleft', 'a', 'arrowright', 'd'].includes(key)) {
          this.isControlledByUser = true;
          if (this.mainAnimation?.name !== 'walk') {
            this.setAnimation('walk');
          }
          this.direction = ['arrowleft', 'a'].includes(key) ? 'left' : 'right';
          this.xVelocity = this.direction === 'left' ? -5 : 5;

          if (e.shiftKey) {
            this.direction = this.direction === 'left' ? 'right' : 'left';
            this.xVelocity *= 0.8;
          }
        }
      };

      const keyUpListener = (e) => {
        if (!this.config.controls_enabled) return;
        const key = e.key.toLowerCase();

        if (['arrowleft', 'a', 'arrowright', 'd'].includes(key)) {
          this.setAnimation('stop', { iterations: FPS * 2 });
          this.isControlledByUser = false;
        }
      };

      window.addEventListener('keydown', keyDownListener);
      window.addEventListener('keyup', keyUpListener);

      // Spiderhog web-slinging
      const onMouseDown = (e) => {
        if (!this.config.controls_enabled || this.config.skin !== 'spiderhog') return;

        const elementBounds = this.element.getBoundingClientRect();
        if (
          e.clientX >= elementBounds.left &&
          e.clientX <= elementBounds.right &&
          e.clientY >= elementBounds.top &&
          e.clientY <= elementBounds.bottom
        ) {
          return;
        }

        this.setAnimation('fall');
        this.followMouse = true;
        this.lastKnownMousePosition = [e.clientX, e.clientY];

        const onMouseMove = (e) => {
          this.lastKnownMousePosition = [e.clientX, e.clientY];
        };

        const onMouseUp = () => {
          this.followMouse = false;
          window.removeEventListener('mousemove', onMouseMove);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousedown', onMouseDown);
    }

    destroy() {
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
    }
  }

  // Main extension logic
  let hedgehog = null;
  let animationTimer = null;

  const startHedgehog = (config) => {
    if (hedgehog) {
      hedgehog.destroy();
    }

    hedgehog = new HedgehogActor(config);

    const loop = () => {
      hedgehog.update();
      hedgehog.render();
      animationTimer = setTimeout(loop, 1000 / FPS);
    };

    loop();
  };

  const stopHedgehog = () => {
    if (animationTimer) {
      clearTimeout(animationTimer);
      animationTimer = null;
    }
    if (hedgehog) {
      hedgehog.destroy();
      hedgehog = null;
    }
  };

  const updateConfig = (config) => {
    if (hedgehog) {
      Object.assign(hedgehog.config, config);
    }
  };

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_HEDGEHOG') {
      if (hedgehog) {
        stopHedgehog();
        sendResponse({ enabled: false });
      } else {
        chrome.storage.sync.get(['hedgehogConfig'], (result) => {
          startHedgehog(result.hedgehogConfig || {});
          sendResponse({ enabled: true });
        });
      }
      return true;
    }

    if (message.type === 'UPDATE_CONFIG') {
      updateConfig(message.config);
      chrome.storage.sync.set({ hedgehogConfig: message.config });
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'GET_STATUS') {
      sendResponse({ enabled: !!hedgehog });
      return true;
    }

    if (message.type === 'SET_ON_FIRE') {
      if (hedgehog) {
        hedgehog.setOnFire();
        sendResponse({ success: true });
      }
      return true;
    }
  });

  // Auto-start if enabled in settings
  chrome.storage.sync.get(['hedgehogEnabled', 'hedgehogConfig'], (result) => {
    if (result.hedgehogEnabled) {
      startHedgehog(result.hedgehogConfig || {});
    }
  });

  // Make hedgehog available globally for debugging
  window._hedgehogBuddy = {
    start: startHedgehog,
    stop: stopHedgehog,
    getActor: () => hedgehog,
  };
})();
