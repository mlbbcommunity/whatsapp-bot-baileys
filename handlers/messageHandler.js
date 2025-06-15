const config = require('../config');
const commandManager = require('../utils/commands');
const roleManager = require('../utils/roles');
const logger = require('../utils/logger');

class MessageHandler {
    constructor() {
        this.processedMessages = new Set();
    }

    /**
     * Handle incoming messages
     * @param {Object} sock - WhatsApp socket
     * @param {Object} m - Message upsert object
     */
    async handle(sock, m) {
        try {
            const message = m.messages[0];
            if (!message || !message.message) return;

            // Ignore status broadcasts and other non-chat messages
            if (message.key.remoteJid === 'status@broadcast') return;

            // Prevent processing the same message twice
            const messageId = message.key.id;
            if (this.processedMessages.has(messageId)) return;
            this.processedMessages.add(messageId);

            // Clean up old processed messages (keep last 1000)
            if (this.processedMessages.size > 1000) {
                const messagesArray = Array.from(this.processedMessages);
                messagesArray.slice(0, 500).forEach(id => this.processedMessages.delete(id));
            }

            // Extract text from message
            const messageText = this.extractMessageText(message);
            if (!messageText) return;

            // Check if message starts with prefix
            if (!messageText.startsWith(config.PREFIX)) return;

            // Parse command and arguments
            const args = messageText.slice(config.PREFIX.length).trim().split(/\s+/);
            const commandName = args.shift()?.toLowerCase();

            if (!commandName) return;

            // Log command attempt
            const sender = message.key.remoteJid;
            const senderNumber = sender.replace('@s.whatsapp.net', '').replace('@c.us', '');
            logger.info(`Command received: ${commandName} from ${senderNumber}`);

            // Auto-read message if enabled
            if (config.AUTO_READ) {
                await sock.readMessages([message.key]);
            }

            // Auto-typing if enabled
            if (config.AUTO_TYPING) {
                await sock.sendPresenceUpdate('composing', sender);
                setTimeout(async () => {
                    await sock.sendPresenceUpdate('available', sender);
                }, 1000);
            }

            // Execute command
            await commandManager.execute(sock, message, commandName, args);

        } catch (error) {
            logger.error('Error handling message:', error);
        }
    }

    /**
     * Extract text content from various message types
     * @param {Object} message - WhatsApp message object
     * @returns {string|null} - Extracted text or null
     */
    extractMessageText(message) {
        try {
            const messageContent = message.message;

            // Handle different message types
            if (messageContent.conversation) {
                return messageContent.conversation;
            }

            if (messageContent.extendedTextMessage?.text) {
                return messageContent.extendedTextMessage.text;
            }

            if (messageContent.imageMessage?.caption) {
                return messageContent.imageMessage.caption;
            }

            if (messageContent.videoMessage?.caption) {
                return messageContent.videoMessage.caption;
            }

            if (messageContent.documentMessage?.caption) {
                return messageContent.documentMessage.caption;
            }

            // Handle quoted messages
            if (messageContent.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedText = this.extractMessageText({
                    message: messageContent.extendedTextMessage.contextInfo.quotedMessage
                });
                return messageContent.extendedTextMessage.text || quotedText;
            }

            return null;
        } catch (error) {
            logger.error('Error extracting message text:', error);
            return null;
        }
    }

    /**
     * Check if message is from a group
     * @param {string} remoteJid - Remote JID
     * @returns {boolean}
     */
    isGroupMessage(remoteJid) {
        return remoteJid.endsWith('@g.us');
    }

    /**
     * Get sender from group message
     * @param {Object} message - Message object
     * @returns {string} - Sender JID
     */
    getGroupSender(message) {
        return message.key.participant || message.key.remoteJid;
    }
}

module.exports = new MessageHandler();
