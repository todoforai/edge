export const BILLING_CONSTANTS = {
  // MCP base cost
  MCP_BASE_COST: 0.0, // Base cost for MCP operations

  // Balance settings
  INITIAL_BALANCE: 1.0,   // Default starting balance for new users
  MIN_BALANCE: 0.0,       // Minimum allowed balance
  TEMP_USER_BALANCE: 0.5, // Initial balance for temporary users

  // Conversion settings
  MIN_CONVERSION_BALANCE: 1.0, // Minimum balance when converting temp to regular

  // Tax settings
  TAX_RATE: 0.27,       // 27% tax rate
  TAX_INCLUSIVE: false, // Whether prices are tax-inclusive

  MIN_AMOUNT: 5,    // Minimum amount for a payment
  MAX_AMOUNT: 5000, // Maximum amount for a payment
} as const;


export const UNSET_SCHEDULED_TIMESTAMP = 0;
export const INTERNAL_SCHEDULED_TIMESTAMP = 1;

export const NEVER_SCHEDULED_TIMESTAMP = 8640000000000000; // Max possible date (approx. year 275760)
