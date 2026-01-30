// Shared constants between content.js and popup.js

// Color filters for hedgehog skins
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

// Skins and colors combined - each item shows a specific skin+color combo
const SKINS_AND_COLORS = [
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
const HEADWEAR = [
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

const EYEWEAR = [
  { id: 'none_eyewear', name: 'None' },
  { id: 'glasses', name: 'Glasses', img: 'glasses' },
  { id: 'sunglasses', name: 'Sunglasses', img: 'sunglasses' },
  { id: 'eyepatch', name: 'Eyepatch', img: 'eyepatch' },
];

const OTHER_ACCESSORIES = [
  { id: 'none_other', name: 'None' },
  { id: 'parrot', name: 'Parrot', img: 'parrot' },
  { id: 'xmas_scarf', name: 'Scarf', img: 'xmas-scarf' },
];

// All accessory categories for generic iteration
const ACCESSORY_CATEGORIES = [
  { key: 'headwear', items: HEADWEAR, noneId: 'none_headwear' },
  { key: 'eyewear', items: EYEWEAR, noneId: 'none_eyewear' },
  { key: 'other', items: OTHER_ACCESSORIES, noneId: 'none_other' },
];

// Standard accessories map (used by content.js for rendering)
const STANDARD_ACCESSORIES = {
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
