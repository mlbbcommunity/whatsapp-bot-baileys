const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const config = require('./config');
const logger = require('./utils/logger');
const messageHandler = require('./handlers/messageHandler');
const pluginManager = require('./utils/pluginManager');
const path = require('path');
const http = require('http');

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.pairingCodeGenerated = false;
    }

    async start() {
        try {
            logger.info('Starting WhatsApp Bot...');
            
            // Use sessions directory for auth state
            const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'sessions'));
            
            // Get latest Baileys version
            const { version, isLatest } = await fetchLatestBaileysVersion();
            logger.info(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

            // Create socket connection
            this.sock = makeWASocket({
                version,
                logger: logger.child({ class: 'socket' }),
                printQRInTerminal: false, // Disable QR code printing
                auth: state,
                generateHighQualityLinkPreview: true,
                markOnlineOnConnect: true,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 90000,
                keepAliveIntervalMs: 15000,
                retryRequestDelayMs: 2000,
                maxMsgRetryCount: 3,
                msgRetryCounterCache: null,
                shouldIgnoreJid: () => false,
                shouldSyncHistoryMessage: () => false,
                emitOwnEvents: false,
                fireInitQueries: true,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
            });

            // Handle credential updates
            this.sock.ev.on('creds.update', saveCreds);

            // Handle connection updates
            this.sock.ev.on('connection.update', async (update) => {
                await this.handleConnectionUpdate(update);
            });

            // Handle incoming messages
            this.sock.ev.on('messages.upsert', async (m) => {
                await messageHandler.handle(this.sock, m);
            });

            // Load plugins after bot initialization
            await pluginManager.loadPlugins();
            
            logger.info('Bot initialization completed');

        } catch (error) {
            logger.error('Error starting bot:', error);
            process.exit(1);
        }
    }

    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !this.isConnected && !this.pairingCodeGenerated) {
            try {
                // Clean and format phone number properly
                let phoneNumber = config.PHONE_NUMBER.replace(/[^0-9]/g, '');
                
                // Ensure phone number starts with country code (if it doesn't already)
                if (!phoneNumber.startsWith('27') && phoneNumber.length === 10) {
                    phoneNumber = '27' + phoneNumber.substring(1); // Replace leading 0 with 27
                }
                
                logger.info(`Requesting pairing code for number: ${phoneNumber}`);
                const code = await this.sock.requestPairingCode(phoneNumber);
                this.pairingCodeGenerated = true;
                
                logger.info(`Your pairing code: ${code}`);
                console.log('\n=================================');
                console.log(`🔗 PAIRING CODE: ${code}`);
                console.log(`📱 For number: ${phoneNumber}`);
                console.log('=================================\n');
                console.log('📱 IMPORTANT PAIRING STEPS:');
                console.log('1. Open WhatsApp on your phone');
                console.log('2. Go to Settings > Linked Devices');
                console.log('3. Tap "Link a Device"');
                console.log('4. Tap "Link with phone number instead"');
                console.log('5. Enter this exact code: ' + code);
                console.log('6. Complete the pairing within 2 minutes');
                console.log('=================================\n');
                console.log('⚠️  TROUBLESHOOTING:');
                console.log('- Make sure no other WhatsApp Web sessions are active');
                console.log('- Try disconnecting from WiFi and using mobile data');
                console.log('- Ensure your phone number matches: ' + phoneNumber);
                console.log('=================================\n');
            } catch (error) {
                logger.error('Error requesting pairing code:', error);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            logger.info(`Connection closed due to: ${lastDisconnect?.error}`);
            
            // Check if this is a connection failure
            const isConnectionFailure = lastDisconnect?.error?.message?.includes('Connection Failure');
            
            if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                logger.info(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                
                // If we've had multiple connection failures, clear session data
                if (isConnectionFailure && this.reconnectAttempts >= 3) {
                    logger.warn('Multiple connection failures detected. Clearing session data...');
                    await this.clearSessionData();
                }
                
                setTimeout(() => this.start(), 5000);
            } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                if (isConnectionFailure) {
                    logger.warn('Max reconnection attempts reached due to connection failures. Clearing session data and restarting...');
                    await this.clearSessionData();
                    // Reset attempts and try once more with fresh session
                    this.reconnectAttempts = 0;
                    setTimeout(() => this.start(), 5000);
                } else {
                    logger.error('Max reconnection attempts reached. Bot stopped.');
                    process.exit(1);
                }
            } else {
                logger.info('Bot logged out. Please restart and pair again.');
                process.exit(0);
            }
            
            this.isConnected = false;
        } else if (connection === 'open') {
            logger.info('✅ Bot connected successfully!');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // Send startup notification to owner
            try {
                const ownerJid = config.OWNER_NUMBER + '@s.whatsapp.net';
                await this.sock.sendMessage(ownerJid, { 
                    text: '🤖 *Bot Started Successfully!*\n\nThe WhatsApp bot is now online and ready to receive commands.' 
                });
            } catch (error) {
                logger.error('Error sending startup notification:', error);
            }
        } else if (connection === 'connecting') {
            logger.info('🔄 Connecting to WhatsApp...');
        }
    }

    async stop() {
        if (this.sock) {
            logger.info('Stopping bot...');
            await this.sock.logout();
        }
    }

    async clearSessionData() {
        try {
            const fs = require('fs').promises;
            const sessionPath = path.join(__dirname, 'sessions');
            
            // Reset pairing code flag
            this.pairingCodeGenerated = false;
            
            // Check if sessions directory exists
            try {
                await fs.access(sessionPath);
                // Remove all files in sessions directory
                const files = await fs.readdir(sessionPath);
                for (const file of files) {
                    if (file !== '.gitkeep') {
                        await fs.unlink(path.join(sessionPath, file));
                    }
                }
                logger.info('Session data cleared successfully');
            } catch (error) {
                // Sessions directory doesn't exist or is empty
                logger.info('No session data to clear');
            }
        } catch (error) {
            logger.error('Error clearing session data:', error);
        }
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    if (global.bot) {
        await global.bot.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    if (global.bot) {
        await global.bot.stop();
    }
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Create HTTP server for Render deployment compatibility
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    if (req.url === '/health') {
        res.end(JSON.stringify({
            status: 'healthy',
            bot_connected: global.bot ? global.bot.isConnected : false,
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        }));
    } else if (req.url === '/status') {
        res.end(JSON.stringify({
            bot_name: config.BOT_NAME,
            status: global.bot && global.bot.isConnected ? 'connected' : 'disconnected',
            owner: config.OWNER_NUMBER,
            timestamp: new Date().toISOString()
        }));
    } else {
        res.end(JSON.stringify({
            message: 'WhatsApp Bot Server',
            status: 'running',
            endpoints: ['/health', '/status'],
            timestamp: new Date().toISOString()
        }));
    }
});

// Start HTTP server
const PORT = config.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    logger.info(`HTTP server listening on port ${PORT}`);
    console.log(`🌐 HTTP server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Status check: http://localhost:${PORT}/status`);
});

// Start the bot
const bot = new WhatsAppBot();
global.bot = bot;
bot.start();

// Keep the process alive and log status
setInterval(() => {
    logger.debug('Bot is running...');
    if (global.bot && global.bot.isConnected) {
        logger.debug('WhatsApp connection: active');
    }
}, 300000); // Log every 5 minutes
