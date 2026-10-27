// Mirrors OPTION_TYPES in server/src/models/Product.js.
export const OPTION_TYPES = [
  { value: 'none', label: 'No options', placeholder: '' },
  { value: 'size', label: 'Size', placeholder: 'e.g. M or 10' },
  { value: 'weight', label: 'Weight', placeholder: 'e.g. 250 g or 1 kg' },
  { value: 'volume', label: 'Volume', placeholder: 'e.g. 500 ml or 1 L' },
];

const byValue = Object.fromEntries(OPTION_TYPES.map((t) => [t.value, t]));

/** "Size", "Weight", "Volume" — the heading shown above the option picker. */
export const optionTypeLabel = (type) => byValue[type]?.label || 'Option';
export const optionPlaceholder = (type) => byValue[type]?.placeholder || '';

export const hasOptions = (product) => product.variants?.length > 0;

/** True when the options don't all cost the same, so the shop shows "From $X". */
export const hasPriceRange = (product) => hasOptions(product) && new Set(product.variants.map((v) => v.price)).size > 1;
