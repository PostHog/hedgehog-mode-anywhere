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

  // Base URL for sprites (served from extension) - cached once
  const BASE_SPRITE_PATH = chrome.runtime.getURL('sprites');

  // Sprite URL helpers
  const spriteUrl = (skin, img) => `${BASE_SPRITE_PATH}/skins/${skin}/${img}.png`;
  const spriteOverlayUrl = (img) => `${BASE_SPRITE_PATH}/overlays/${img}.png`;
  const spriteAccessoryUrl = (img) => `${BASE_SPRITE_PATH}/accessories/${img}.png`;

  // Physics constants
  const JUMP_VELOCITY = 5;
  const DAMPING_FACTOR = 0.6;
  const BOUNCE_FACTOR = 0.4;
  const USER_WALK_SPEED = 5;
  const AUTO_WALK_SPEED = 1;
  const BODY_GROUND_OFFSET = -1000;
  const HEDGEHOG_BOX_X_INSET = 20;
  const HEDGEHOG_BOX_Y_INSET = 5;
  const HEDGEHOG_BOX_WIDTH_INSET = 40;
  const HEDGEHOG_BOX_HEIGHT_INSET = 30;
  const GROUND_CACHE_TTL = 500;
  const MAX_THROW_VELOCITY = 250;
  const MAX_SCREEN_VELOCITY = 200;
  const SECRET_KEY_BUFFER_SIZE = 20;

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

  // Use STANDARD_ACCESSORIES from shared.js

  // Utility functions
  const sampleOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  const elementToBox = (element) => {
    if (element === document.body) {
      return { x: 0, y: BODY_GROUND_OFFSET, width: window.innerWidth, height: -BODY_GROUND_OFFSET };
    }
    const isHedgehog = element.classList.contains('HedgehogBuddy');
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + (isHedgehog ? HEDGEHOG_BOX_X_INSET : 0),
      y: window.innerHeight - rect.bottom + (isHedgehog ? HEDGEHOG_BOX_Y_INSET : 0),
      width: rect.width - (isHedgehog ? HEDGEHOG_BOX_WIDTH_INSET : 0),
      height: rect.height - (isHedgehog ? HEDGEHOG_BOX_HEIGHT_INSET : 0),
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

      // Cached ground elements for performance
      this._groundElementsCache = [];
      this._groundCacheTime = 0;
      this._preloadLinks = [];

      // Bound event handlers for cleanup
      this._boundKeyDown = null;
      this._boundKeyUp = null;
      this._boundMouseDown = null;

      // Render cache to avoid recomputing every frame
      this._cachedAccessories = null;
      this._cachedAccessoriesKey = null;
      this._cachedSpriteUrl = null;
      this._cachedSpriteUrlKey = null;
      this._cachedFilter = null;
      this._cachedFilterKey = null;

      this.preloadAnimationSprites();
      this.setAnimation('fall');
    }

    animations() {
      return skins[this.config.skin] || skins.default;
    }

    preloadAnimationSprites() {
      // Remove old preload links
      this._preloadLinks.forEach(link => link.remove());
      this._preloadLinks = [];

      for (const animation of Object.values(this.animations())) {
        const preload = document.createElement('link');
        preload.rel = 'preload';
        preload.as = 'image';
        preload.href = spriteUrl(this.config.skin, animation.img);
        document.head.appendChild(preload);
        this._preloadLinks.push(preload);
      }
    }

    accessories() {
      const key = (this.config.accessories || []).join(',');
      if (this._cachedAccessoriesKey !== key) {
        this._cachedAccessoriesKey = key;
        this._cachedAccessories = (this.config.accessories || []).map((acc) => STANDARD_ACCESSORIES[acc]).filter(Boolean);
      }
      return this._cachedAccessories;
    }

    setOnFire(times = 3) {
      soundManager.fire();
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
      this.xVelocity = this.direction === 'left' ? -USER_WALK_SPEED : USER_WALK_SPEED;
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
        this.xVelocity = this.direction === 'left' ? -AUTO_WALK_SPEED : AUTO_WALK_SPEED;
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
      this.yVelocity = this.gravity * JUMP_VELOCITY;
      soundManager.jump();
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
          this.xVelocity = Math.max(Math.min(this.xVelocity + screenMoveX * 10, MAX_SCREEN_VELOCITY), -MAX_SCREEN_VELOCITY);
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
          this.yVelocity = -this.yVelocity * BOUNCE_FACTOR;
        }
        this.x = this.x + this.xVelocity;
        this.direction = this.xVelocity > 0 ? 'right' : 'left';
        return;
      }

      this.ground = this.findGround();
      this.yVelocity -= this.gravity;

      if (!this.isControlledByUser && this.mainAnimation?.name !== 'walk' && this.onGround()) {
        this.xVelocity = this.xVelocity * DAMPING_FACTOR;
      }

      let newY = this.y + this.yVelocity;

      if (this.yVelocity < 0) {
        const groundBoundingRect = elementToBox(this.ground);
        const groundY = groundBoundingRect.y + groundBoundingRect.height;

        if (newY <= groundY) {
          if (this.jumpCount > 0) soundManager.land();
          newY = groundY;
          this.yVelocity = -this.yVelocity * BOUNCE_FACTOR;
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

      // Refresh ground elements cache every 500ms instead of every frame
      const now = Date.now();
      if (now - this._groundCacheTime > GROUND_CACHE_TTL) {
        this._groundElementsCache = Array.from(
          document.querySelectorAll(
            'button, input, select, .btn, [role="button"], nav, header, footer, aside, .card, .modal, .dialog, .HedgehogBuddy'
          )
        ).filter((x) => x !== this.element);
        this._groundCacheTime = now;
      }

      let highestCandidate = null;

      for (const block of this._groundElementsCache) {
        const box = elementToBox(block);
        if (box.y + box.height > window.innerHeight || box.y < 0) continue;
        if (this.ignoreGroundAboveY && box.y + box.height > this.ignoreGroundAboveY) continue;

        const isAboveOrOn =
          hedgehogBox.x + hedgehogBox.width > box.x &&
          hedgehogBox.x < box.x + box.width &&
          hedgehogBox.y >= box.y + box.height;

        if (isAboveOrOn) {
          if (!highestCandidate || box.y > highestCandidate[1].y) {
            highestCandidate = [block, box];
          }
        }
      }

      return highestCandidate?.[0] ?? document.body;
    }

    onGround() {
      if (this.ground) {
        const groundBox = elementToBox(this.ground);
        const groundLevel = groundBox.y + groundBox.height;
        return this.y <= groundLevel;
      }
      return false;
    }

    isFalling() {
      return !this.onGround() && Math.abs(this.yVelocity) > 1;
    }

    render() {
      if (!this.element) {
        // Create elements off-DOM first to avoid layout thrashing
        this.element = document.createElement('div');
        this.element.className = 'HedgehogBuddy';

        this.spriteElement = document.createElement('div');
        this.spriteElement.className = 'HedgehogBuddy__sprite';
        this.element.appendChild(this.spriteElement);

        this.accessoryElements = [];
        this.overlayElement = null;
        this._lastTransitionState = null;

        // Set initial position before appending to DOM
        this.element.style.left = `${this.x}px`;
        this.element.style.bottom = `${this.y - SHADOW_HEIGHT * 0.5}px`;

        document.body.appendChild(this.element);
        this.setupEventListeners();
      }

      // Update position
      this.element.style.left = `${this.x}px`;
      this.element.style.bottom = `${this.y - SHADOW_HEIGHT * 0.5}px`;

      // Only update transition when drag/follow state changes
      const shouldAnimate = !(this.isDragging || this.followMouse);
      if (this._lastTransitionState !== shouldAnimate) {
        this.element.style.transition = shouldAnimate ? `all ${frameDuration}ms` : 'none';
        this._lastTransitionState = shouldAnimate;
      }

      // Update sprite transform (direction)
      this.spriteElement.style.transform = `scaleX(${this.direction === 'right' ? 1 : -1})`;

      // Update main animation
      if (this.mainAnimation) {
        // Cache filter value
        if (this._cachedFilterKey !== this.config.color) {
          this._cachedFilterKey = this.config.color;
          this._cachedFilter = this.config.color ? COLOR_TO_FILTER_MAP[this.config.color] : 'none';
        }

        // Cache sprite URL
        const spriteKey = `${this.config.skin}:${this.mainAnimation.spriteInfo.img}`;
        if (this._cachedSpriteUrlKey !== spriteKey) {
          this._cachedSpriteUrlKey = spriteKey;
          this._cachedSpriteUrl = `url(${spriteUrl(this.config.skin, this.mainAnimation.spriteInfo.img)})`;
        }

        this.spriteElement.style.backgroundImage = this._cachedSpriteUrl;
        this.spriteElement.style.backgroundPosition = `-${(this.mainAnimation.frame % X_FRAMES) * SPRITE_SIZE}px -${Math.floor(this.mainAnimation.frame / X_FRAMES) * SPRITE_SIZE}px`;
        this.spriteElement.style.filter = this._cachedFilter;
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
        accEl.style.backgroundImage = `url(${spriteAccessoryUrl(accessory.img)})`;
        accEl.style.transform = accessoryPosition ? `translate3d(${accessoryPosition[0]}px, ${accessoryPosition[1]}px, 0)` : '';
        accEl.style.filter = this._cachedFilter;
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
      const onTouchOrMouseStart = () => {
        const lastPositions = [];

        const onMove = (e) => {
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
            this.xVelocity = Math.min(MAX_THROW_VELOCITY, xPixelsPerSecond / relevantPositions.length / FPS);
            this.yVelocity = Math.min(MAX_THROW_VELOCITY, (yPixelsPerSecond / relevantPositions.length / FPS) * -1);
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

      this._boundKeyDown = (e) => {
        if (!this.config.controls_enabled) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

        const key = e.key.toLowerCase();
        lastKeys.push(key);
        if (lastKeys.length > SECRET_KEY_BUFFER_SIZE) lastKeys.shift();

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
          this.xVelocity = this.direction === 'left' ? -USER_WALK_SPEED : USER_WALK_SPEED;

          if (e.shiftKey) {
            this.direction = this.direction === 'left' ? 'right' : 'left';
            this.xVelocity *= 0.8;
          }
        }
      };

      this._boundKeyUp = (e) => {
        if (!this.config.controls_enabled) return;
        const key = e.key.toLowerCase();

        if (['arrowleft', 'a', 'arrowright', 'd'].includes(key)) {
          this.setAnimation('stop', { iterations: FPS * 2 });
          this.isControlledByUser = false;
        }
      };

      window.addEventListener('keydown', this._boundKeyDown);
      window.addEventListener('keyup', this._boundKeyUp);

      // Spiderhog web-slinging
      this._boundMouseDown = (e) => {
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

        // Create web line SVG
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483646';
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('stroke', 'rgba(255,255,255,0.5)');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
        document.body.appendChild(svg);

        const updateWebLine = () => {
          if (!this.element) return;
          const rect = this.element.getBoundingClientRect();
          const hx = rect.left + rect.width / 2;
          const hy = rect.top + rect.height / 2;
          const [mx, my] = this.lastKnownMousePosition || [hx, hy];
          line.setAttribute('x1', String(hx));
          line.setAttribute('y1', String(hy));
          line.setAttribute('x2', String(mx));
          line.setAttribute('y2', String(my));
        };

        const onMouseMove = (e) => {
          this.lastKnownMousePosition = [e.clientX, e.clientY];
          updateWebLine();
        };
        updateWebLine();

        const onMouseUp = () => {
          this.followMouse = false;
          svg.remove();
          window.removeEventListener('mousemove', onMouseMove);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousedown', this._boundMouseDown);
    }

    destroy() {
      // Remove event listeners
      if (this._boundKeyDown) {
        window.removeEventListener('keydown', this._boundKeyDown);
      }
      if (this._boundKeyUp) {
        window.removeEventListener('keyup', this._boundKeyUp);
      }
      if (this._boundMouseDown) {
        window.removeEventListener('mousedown', this._boundMouseDown);
      }

      // Remove preload links
      this._preloadLinks.forEach(link => link.remove());
      this._preloadLinks = [];

      // Remove DOM element
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
    }
  }

  // Sound effects manager using Web Audio API
  class SoundManager {
    constructor() {
      this._ctx = null;
      this.enabled = false;
    }

    _getContext() {
      if (!this._ctx) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return this._ctx;
    }

    _playTone(frequency, duration, type = 'sine', rampDown = true) {
      if (!this.enabled) return;
      const ctx = this._getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      if (rampDown) {
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    }

    jump() {
      if (!this.enabled) return;
      const ctx = this._getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    }

    land() {
      this._playTone(120, 0.1, 'sine');
    }

    fire() {
      if (!this.enabled) return;
      const ctx = this._getContext();
      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(ctx.currentTime);
    }
  }

  const soundManager = new SoundManager();

  // Main extension logic
  let hedgehogs = [];
  let animationFrameId = null;
  let lastFrameTime = 0;
  const frameDuration = 1000 / FPS;

  const startHedgehog = (config) => {
    stopHedgehog();

    const count = Math.max(1, Math.min(5, config.hedgehog_count || 1));
    soundManager.enabled = !!config.sound_enabled;

    for (let i = 0; i < count; i++) {
      hedgehogs.push(new HedgehogActor(config));
    }

    lastFrameTime = performance.now();

    const loop = (currentTime) => {
      animationFrameId = requestAnimationFrame(loop);

      const elapsed = currentTime - lastFrameTime;
      if (elapsed < frameDuration) return;

      // Cap catchup to 3 frames to prevent teleporting after lag spikes
      const maxCatchup = frameDuration * 3;
      lastFrameTime = currentTime - Math.min(elapsed % frameDuration, maxCatchup);

      try {
        for (const hog of hedgehogs) {
          hog.update();
          hog.render();
        }
      } catch (e) {
        console.error('[HedgehogMode] Animation error:', e);
      }
    };

    animationFrameId = requestAnimationFrame(loop);
  };

  const stopHedgehog = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    for (const hog of hedgehogs) {
      hog.destroy();
    }
    hedgehogs = [];
  };

  const updateConfig = (config) => {
    soundManager.enabled = !!config.sound_enabled;

    const newCount = Math.max(1, Math.min(5, config.hedgehog_count || 1));
    // Adjust hedgehog count if changed
    while (hedgehogs.length > newCount) {
      hedgehogs.pop().destroy();
    }
    while (hedgehogs.length < newCount) {
      hedgehogs.push(new HedgehogActor(config));
    }

    for (const hog of hedgehogs) {
      Object.assign(hog.config, config);
    }
  };

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'TOGGLE_HEDGEHOG') {
      if (hedgehogs.length > 0) {
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
      const primary = hedgehogs[0] || null;
      sendResponse({
        enabled: hedgehogs.length > 0,
        config: primary ? { ...primary.config } : null,
      });
      return true;
    }

    if (message.type === 'SET_ON_FIRE') {
      if (hedgehogs.length > 0) {
        hedgehogs[0].setOnFire();
        sendResponse({ success: true });
      }
      return true;
    }
  });

  // Auto-start if enabled in settings and not disabled on this site
  chrome.storage.sync.get(['hedgehogEnabled', 'hedgehogConfig', 'disabledSites'], (result) => {
    const disabledSites = result.disabledSites || [];
    if (result.hedgehogEnabled && !disabledSites.includes(window.location.hostname)) {
      startHedgehog(result.hedgehogConfig || {});
    }
  });

  // Make hedgehog available globally for debugging
  window._hedgehogBuddy = {
    start: startHedgehog,
    stop: stopHedgehog,
    getActors: () => hedgehogs,
    getActor: () => hedgehogs[0] || null,
  };
})();
