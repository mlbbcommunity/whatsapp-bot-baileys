const config = require('../config');
const roleManager = require('./roles');
const logger = require('./logger');

class CommandManager {
    constructor() {
        this.commands = new Map();
        this.rateLimit = new Map();
        this.registerDefaultCommands();
    }

    /**
     * Register a command
     * @param {string} name - Command name
     * @param {Object} commandConfig - Command configuration
     */
    register(name, commandConfig) {
        this.commands.set(name, {
            name,
            description: commandConfig.description || 'No description',
            usage: commandConfig.usage || `${config.PREFIX}${name}`,
            role: commandConfig.role || 'user',
            handler: commandConfig.handler,
            category: commandConfig.category || 'general'
        });
    }

    /**
     * Check if user is rate limited
     * @param {string} userId - User ID
     * @returns {boolean}
     */
    isRateLimited(userId) {
        const now = Date.now();
        const userLimit = this.rateLimit.get(userId) || { count: 0, resetTime: now + config.RATE_LIMIT_WINDOW };
        
        if (now > userLimit.resetTime) {
            userLimit.count = 1;
            userLimit.resetTime = now + config.RATE_LIMIT_WINDOW;
            this.rateLimit.set(userId, userLimit);
            return false;
        }
        
        if (userLimit.count >= config.RATE_LIMIT_MAX) {
            return true;
        }
        
        userLimit.count++;
        this.rateLimit.set(userId, userLimit);
        return false;
    }

    /**
     * Execute a command
     * @param {Object} sock - WhatsApp socket
     * @param {Object} message - Message object
     * @param {string} commandName - Command name
     * @param {Array} args - Command arguments
     */
    async execute(sock, message, commandName, args) {
        try {
            const command = this.commands.get(commandName);
            if (!command) {
                return;
            }

            const sender = message.key.remoteJid;
            const senderNumber = sender.replace('@s.whatsapp.net', '').replace('@c.us', '');

            // Check rate limiting (skip for owner)
            if (!roleManager.isOwner(sender) && this.isRateLimited(senderNumber)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ *Rate Limited*\n\nYou are sending commands too quickly. Please wait a moment before trying again.'
                });
                return;
            }

            // Check permissions
            if (!roleManager.hasPermission(sender, command.role)) {
                await sock.sendMessage(sender, {
                    text: `❌ *Access Denied*\n\nThis command requires ${command.role} role or higher.\nYour role: ${roleManager.getRoleDisplay(sender)}`
                });
                return;
            }

            // Execute command
            await command.handler(sock, message, args);

            logger.info(`Command executed: ${commandName} by ${senderNumber} (${roleManager.getUserRole(sender)})`);

        } catch (error) {
            logger.error(`Error executing command ${commandName}:`, error);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ *Command Error*\n\nAn error occurred while executing this command. Please try again later.'
            });
        }
    }

    /**
     * Get command list based on user role
     * @param {string} userRole - User role
     * @returns {Array} - Available commands
     */
    getAvailableCommands(userRole) {
        const availableCommands = [];
        
        for (const [name, command] of this.commands) {
            if (roleManager.hasPermission(userRole + '@s.whatsapp.net', command.role)) {
                availableCommands.push(command);
            }
        }
        
        return availableCommands;
    }

    /**
     * Register default bot commands
     */
    registerDefaultCommands() {
        // Ping command
        this.register('ping', {
            description: 'Check if the bot is responsive',
            usage: `${config.PREFIX}ping`,
            role: 'user',
            category: 'general',
            handler: async (sock, message, args) => {
                const start = Date.now();
                const sent = await sock.sendMessage(message.key.remoteJid, {
                    text: '🏓 Pinging...'
                });
                
                const latency = Date.now() - start;
                
                await sock.sendMessage(message.key.remoteJid, {
                    text: `🏓 *Pong!*\n\n⚡ *Latency:* ${latency}ms\n🤖 *Bot:* Online\n⏰ *Uptime:* ${this.getUptime()}`
                });
            }
        });

        // Menu command
        this.register('menu', {
            description: 'Display available commands',
            usage: `${config.PREFIX}menu`,
            role: 'user',
            category: 'general',
            handler: async (sock, message, args) => {
                const sender = message.key.remoteJid;
                const userRole = roleManager.getUserRole(sender);
                const availableCommands = this.getAvailableCommands(sender);
                
                // Create fancy menu text with emojis and styling
                let menuText = `╭─────────────────────────╮\n`;
                menuText += `│    🤖 *${config.BOT_NAME}*    │\n`;
                menuText += `╰─────────────────────────╯\n\n`;
                
                menuText += `┌─ 👤 *USER INFO* ─┐\n`;
                menuText += `│ Role: ${roleManager.getRoleDisplay(sender)}\n`;
                menuText += `│ Status: ✅ Verified\n`;
                menuText += `└────────────────┘\n\n`;

                const categories = {};
                availableCommands.forEach(cmd => {
                    if (!categories[cmd.category]) {
                        categories[cmd.category] = [];
                    }
                    categories[cmd.category].push(cmd);
                });

                // Category icons mapping
                const categoryIcons = {
                    'general': '🎯',
                    'fun': '🎮',
                    'utility': '🛠️',
                    'admin': '⚙️',
                    'owner': '👑'
                };

                for (const [category, commands] of Object.entries(categories)) {
                    const icon = categoryIcons[category] || '📁';
                    menuText += `┌─ ${icon} *${category.toUpperCase()} COMMANDS* ─┐\n`;
                    
                    commands.forEach((cmd, index) => {
                        const isLast = index === commands.length - 1;
                        const prefix = isLast ? '└' : '├';
                        const commandEmoji = this.getCommandEmoji(cmd.name);
                        menuText += `${prefix} ${commandEmoji} \`${cmd.usage}\`\n`;
                        menuText += `${isLast ? ' ' : '│'} ↳ ${cmd.description}\n`;
                    });
                    menuText += `└${'─'.repeat(25)}┘\n\n`;
                }

                menuText += `┌─ ℹ️ *INFORMATION* ─┐\n`;
                menuText += `├ 💡 Prefix: \`${config.PREFIX}\`\n`;
                menuText += `├ ⚡ Status: 🟢 Online\n`;
                menuText += `├ 🕐 Time: ${new Date().toLocaleString()}\n`;
                menuText += `└ 📊 Commands: ${availableCommands.length}\n`;
                menuText += `└${'─'.repeat(25)}┘\n\n`;
                
                menuText += `╭─────────────────────────╮\n`;
                menuText += `│  💬 Happy Chatting! 🎉  │\n`;
                menuText += `╰─────────────────────────╯`;

                // Send the menu with the custom image
                try {
                    await sock.sendMessage(sender, {
                        image: { url: 'https://files.catbox.moe/hqdr7g.jpg' },
                        caption: menuText
                    });
                } catch (error) {
                    // Fallback to text-only if image fails
                    logger.error('Failed to send menu with image:', error);
                    await sock.sendMessage(sender, { text: menuText });
                }
            }
        });

        // Status command (admin only)
        this.register('status', {
            description: 'Check bot status and statistics',
            usage: `${config.PREFIX}status`,
            role: 'admin',
            category: 'admin',
            handler: async (sock, message, args) => {
                const uptime = this.getUptime();
                const memUsage = process.memoryUsage();
                
                let statusText = `📊 *Bot Status*\n\n`;
                statusText += `🤖 *Name:* ${config.BOT_NAME}\n`;
                statusText += `⏰ *Uptime:* ${uptime}\n`;
                statusText += `💾 *Memory Usage:*\n`;
                statusText += `  • RSS: ${Math.round(memUsage.rss / 1024 / 1024)} MB\n`;
                statusText += `  • Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)} MB\n`;
                statusText += `  • Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)} MB\n`;
                statusText += `🔧 *Commands:* ${this.commands.size}\n`;
                statusText += `👥 *Admins:* ${config.ADMIN_NUMBERS.length}\n`;
                statusText += `🌐 *Environment:* ${config.NODE_ENV}\n`;
                statusText += `📱 *Node.js:* ${process.version}`;

                await sock.sendMessage(message.key.remoteJid, { text: statusText });
            }
        });

        // Admin management commands (owner only)
        this.register('addadmin', {
            description: 'Add a user as admin (mention or reply)',
            usage: `${config.PREFIX}addadmin @user`,
            role: 'owner',
            category: 'owner',
            handler: async (sock, message, args) => {
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                
                let targetNumber;
                
                if (quotedMessage) {
                    targetNumber = message.message.extendedTextMessage.contextInfo.participant || message.message.extendedTextMessage.contextInfo.remoteJid;
                } else if (mentionedJid) {
                    targetNumber = mentionedJid;
                } else if (args.length > 0) {
                    targetNumber = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                }
                
                if (!targetNumber) {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: '❌ Please mention a user or reply to their message to add as admin.'
                    });
                    return;
                }
                
                if (roleManager.addAdmin(targetNumber, message.key.remoteJid)) {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: `✅ Successfully added user as admin!`
                    });
                } else {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: `❌ User is already an admin or error occurred.`
                    });
                }
            }
        });

        // Plugin management commands (admin only)
        this.register('plugins', {
            description: 'List all loaded plugins',
            usage: `${config.PREFIX}plugins`,
            role: 'admin',
            category: 'admin',
            handler: async (sock, message, args) => {
                const pluginManager = require('./pluginManager');
                const plugins = pluginManager.getLoadedPlugins();
                
                if (plugins.length === 0) {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: '📦 *No Plugins Loaded*\n\nNo plugins are currently active.'
                    });
                    return;
                }

                let pluginText = `📦 *Loaded Plugins (${plugins.length})*\n\n`;
                
                plugins.forEach((plugin, index) => {
                    pluginText += `${index + 1}. **${plugin.name}** v${plugin.version || '1.0.0'}\n`;
                    pluginText += `   📝 ${plugin.description || 'No description'}\n`;
                    if (plugin.commands && plugin.commands.length > 0) {
                        pluginText += `   🔧 Commands: ${plugin.commands.join(', ')}\n`;
                    }
                    pluginText += `   📅 Loaded: ${plugin.loadedAt.toLocaleString()}\n\n`;
                });

                await sock.sendMessage(message.key.remoteJid, { text: pluginText });
            }
        });

        this.register('reloadplugin', {
            description: 'Reload a specific plugin',
            usage: `${config.PREFIX}reloadplugin <filename>`,
            role: 'admin',
            category: 'admin',
            handler: async (sock, message, args) => {
                if (args.length === 0) {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: '❌ Please specify a plugin filename to reload.\nExample: !reloadplugin example-plugin.js'
                    });
                    return;
                }

                const fileName = args[0];
                const pluginManager = require('./pluginManager');
                
                const success = await pluginManager.reloadPlugin(fileName);
                
                if (success) {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: `✅ Plugin **${fileName}** reloaded successfully!`
                    });
                } else {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: `❌ Failed to reload plugin **${fileName}**. Check if the file exists and is valid.`
                    });
                }
            }
        });

        this.register('loadplugins', {
            description: 'Reload all plugins from plugins directory',
            usage: `${config.PREFIX}loadplugins`,
            role: 'admin',
            category: 'admin',
            handler: async (sock, message, args) => {
                const pluginManager = require('./pluginManager');
                
                await sock.sendMessage(message.key.remoteJid, {
                    text: '🔄 Reloading all plugins...'
                });
                
                await pluginManager.loadPlugins();
                const loadedCount = pluginManager.getLoadedPlugins().length;
                
                await sock.sendMessage(message.key.remoteJid, {
                    text: `✅ Plugin reload complete!\n\n📦 **${loadedCount}** plugin(s) loaded successfully.`
                });
            }
        });
    }

    /**
     * Get emoji for command based on command name
     * @param {string} commandName - Name of the command
     * @returns {string} - Emoji representation
     */
    getCommandEmoji(commandName) {
        const emojiMap = {
            'ping': '🏓',
            'menu': '📋',
            'status': '📊',
            'hello': '👋',
            'time': '🕐',
            'joke': '😂',
            'calc': '🧮',
            'qr': '📱',
            'quote': '💭',
            'base64': '🔐',
            'password': '🔑',
            'plugins': '📦',
            'reloadplugin': '🔄',
            'loadplugins': '🔄',
            'addadmin': '➕',
            'broadcast': '📢',
            'info': '🖥️',
            'restart': '🔄',
            'eval': '⚡'
        };
        return emojiMap[commandName] || '🔧';
    }

    /**
     * Get bot uptime
     * @returns {string}
     */
    getUptime() {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        return `${hours}h ${minutes}m ${seconds}s`;
    }
}

module.exports = new CommandManager();
