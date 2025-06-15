const config = {
    // Bot Configuration
    BOT_NAME: process.env.BOT_NAME || 'WhatsApp Bot',
    PREFIX: process.env.PREFIX || '!',
    
    // Owner Configuration (Your number)
    OWNER_NUMBER: process.env.OWNER_NUMBER || '27683913716',
    PHONE_NUMBER: process.env.PHONE_NUMBER || '27683913716', // For pairing
    
    // Admin Numbers (comma-separated list)
    ADMIN_NUMBERS: process.env.ADMIN_NUMBERS ? process.env.ADMIN_NUMBERS.split(',') : [],
    
    // Port for Render deployment
    PORT: process.env.PORT || 8000,
    
    // Environment
    NODE_ENV: process.env.NODE_ENV || 'production',
    
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    // Session Configuration
    SESSION_FOLDER: process.env.SESSION_FOLDER || './sessions',
    
    // Bot Settings
    AUTO_READ: process.env.AUTO_READ === 'true',
    AUTO_TYPING: process.env.AUTO_TYPING === 'true',
    
    // Rate Limiting
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 10,
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute
};

module.exports = config;
