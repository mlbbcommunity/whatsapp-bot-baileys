# WhatsApp Bot with Baileys

A simple yet powerful WhatsApp bot built with the Baileys library, featuring role-based permissions and code-based pairing for easy deployment on Render.

## Features

- 🤖 **WhatsApp Bot**: Built with Baileys library for reliable WhatsApp Web API integration
- 🔐 **Code-based Pairing**: No QR code scanning required - uses pairing codes for authentication
- 👑 **Role System**: Three-tier role system (Owner, Admin, User) with permission-based command access
- 🔌 **Plugin System**: Dynamic plugin loading for extensible command functionality
- 📱 **Rich Commands**: Essential commands plus utility tools, admin features, and fun commands
- 🔄 **Auto Reconnection**: Handles connection drops and automatically reconnects
- 📊 **Logging**: Comprehensive logging with Pino for debugging and monitoring
- ☁️ **Deploy Ready**: Configured for easy deployment on Render platform

## Quick Start

### 1. Environment Setup

Create a `.env` file in the root directory:

```env
# Bot Configuration
BOT_NAME=My WhatsApp Bot
PREFIX=!
PHONE_NUMBER=27683913716

# Owner Configuration (Your WhatsApp number)
OWNER_NUMBER=27683913716

# Admin Numbers (comma-separated, without + or spaces)
ADMIN_NUMBERS=27123456789,27987654321

# Optional Settings
AUTO_READ=false
AUTO_TYPING=true
LOG_LEVEL=info
NODE_ENV=production
