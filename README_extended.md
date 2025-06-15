# WhatsApp Bot with Baileys - Extended Documentation

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/whatsapp-bot-baileys.git
cd whatsapp-bot-baileys

# Install dependencies
npm install

# Start the bot
npm start
```

## Pairing with WhatsApp

1. Run the bot with `npm start`
2. The bot will generate a pairing code (e.g., `S16JRNTL`)
3. Open WhatsApp on your phone
4. Go to Settings > Linked Devices > Link a Device
5. Choose "Link with phone number instead"
6. Enter the pairing code when prompted

## Available Commands

### Basic Commands (All Users)
- `!ping` - Check bot responsiveness and latency
- `!menu` - Display available commands based on your role
- `!hello [name]` - Get a personalized greeting
- `!time` - Get current server time
- `!joke` - Get a random programming joke
- `!calc <expression>` - Perform mathematical calculations
- `!qr <text>` - Generate QR code for text
- `!quote` - Get an inspirational quote
- `!base64 <encode|decode> <text>` - Encode/decode base64
- `!password [length]` - Generate secure random password

### Admin Commands
- `!status` - Check bot status and system information
- `!plugins` - List all loaded plugins
- `!reloadplugin <filename>` - Reload a specific plugin
- `!loadplugins` - Reload all plugins
- `!info` - Get detailed system information

### Owner Commands
- `!addadmin @user` - Add a user as admin
- `!broadcast <message>` - Send message to recent contacts
- `!restart` - Restart the bot
- `!eval <code>` - Execute JavaScript code (debugging)

## Plugin System

The bot features a powerful plugin system that allows you to add custom commands dynamically.

### Creating a Plugin

Create a new `.js` file in the `plugins/` directory:

```javascript
module.exports = {
    name: 'My Plugin',
    version: '1.0.0',
    description: 'My custom plugin',
    author: 'Your Name',

    async init(commandManager) {
        this.registerCommands(commandManager);
        
        return {
            name: this.name,
            version: this.version,
            description: this.description,
            author: this.author,
            commands: ['mycommand']
        };
    },

    registerCommands(commandManager) {
        commandManager.register('mycommand', {
            description: 'My custom command',
            usage: '!mycommand',
            role: 'user',
            category: 'custom',
            handler: async (sock, message, args) => {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Hello from my plugin!'
                });
            }
        });
    }
};
```

### Plugin Management

- Plugins are automatically loaded when the bot starts
- Use `!plugins` to list loaded plugins
- Use `!reloadplugin <filename>` to reload a specific plugin
- Use `!loadplugins` to reload all plugins

## Role System

The bot implements a three-tier permission system:

- **Owner** (Your number): Full access to all commands including system management
- **Admin**: Access to bot management and moderation commands
- **User**: Access to basic bot functionality and utility commands

Roles are configured in the `.env` file using phone numbers without the `+` symbol.

## Deployment on Render

### 1. Prepare for Deployment

1. Push your code to GitHub
2. Create a new account on [Render](https://render.com)
3. Connect your GitHub repository

### 2. Environment Variables

Set these environment variables in Render:

```
BOT_NAME=Your Bot Name
PREFIX=!
PHONE_NUMBER=27683913716
OWNER_NUMBER=27683913716
ADMIN_NUMBERS=27123456789,27987654321
AUTO_READ=false
AUTO_TYPING=true
LOG_LEVEL=info
NODE_ENV=production
PORT=8000
```

### 3. Deploy

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Deploy and wait for the first pairing code in logs

## File Structure

```
whatsapp-bot-baileys/
├── handlers/
│   └── messageHandler.js      # Message processing logic
├── plugins/                   # Plugin directory
│   ├── admin-tools.js        # Admin management commands
│   ├── example-plugin.js     # Example plugin with sample commands
│   └── utility-tools.js      # Utility commands (calc, qr, etc.)
├── sessions/                  # WhatsApp session files (auto-generated)
├── utils/
│   ├── commands.js           # Command management system
│   ├── logger.js             # Logging configuration
│   ├── pluginManager.js      # Plugin loading and management
│   └── roles.js              # Role-based permission system
├── .env.example              # Environment variables template
├── .gitignore               # Git ignore patterns
├── config.js                # Bot configuration
├── index.js                 # Main bot file
└── README.md               # This documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues:

1. Check the logs for error messages
2. Ensure your environment variables are correctly set
3. Verify your phone number format (no + symbol)
4. Make sure WhatsApp Web is not active on other devices

## Troubleshooting

**Connection Issues:**
- The bot tries to connect to existing session first
- If connection fails, it will generate a new pairing code
- Use the pairing code to link your WhatsApp

**Plugin Not Loading:**
- Check plugin syntax and file format
- Use `!loadplugins` to reload all plugins
- Check bot logs for specific error messages

**Commands Not Working:**
- Verify the command prefix (default: `!`)
- Check your role permissions
- Ensure the command exists with `!menu`