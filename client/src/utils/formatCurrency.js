const formatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

/** All prices from the API are integer cents. */
export const formatCurrency = (cents = 0) => formatter.format(cents / 100);

export const dollarsToCents = (dollars) => Math.round(Number(dollars) * 100);
export const centsToDollars = (cents) => (cents / 100).toFixed(2);
