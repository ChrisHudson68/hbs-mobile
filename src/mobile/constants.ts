export const CONFIG = {
  API_BASE_URL: 'https://hudson-business-solutions.com',
};

export const STORAGE_KEYS = {
  tenant: 'hbs_mobile_tenant',
  token: 'hbs_mobile_token',
  user: 'hbs_mobile_user',
} as const;

export const EXPENSE_CATEGORIES = [
  'Materials',
  'Fuel',
  'Equipment Rental',
  'Parts',
  'Supplies',
  'Meals',
  'Travel',
  'Other',
] as const;