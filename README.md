# Ticker Tactix Discord Support Bot

Standalone Node.js Discord support ticket bot using `discord.js` v14. It opens private text-channel tickets through slash commands, buttons, and modals without requiring Discord's Message Content Intent.

## Local Setup

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Fill in the Discord values:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID`
   - `SUPPORT_ROLE_ID`
   - `TICKET_LOG_CHANNEL_ID`
   - Optional: `TICKET_CATEGORY_ID`
5. Keep local database settings as:

```env
DATABASE_CLIENT=sqlite
DATABASE_PATH=./storage/tickets.sqlite
```

6. Run migrations:

```bash
npm run db:migrate
```

7. Register slash commands:

```bash
npm run deploy:commands
```

8. Start the bot:

```bash
npm run dev
```

9. In Discord, run `/setup-tickets` in the support panel channel.

## Discord App Setup

1. Open the Discord Developer Portal and create an application.
2. In the Bot tab, create or reset the bot token and set it as `DISCORD_TOKEN`.
3. Do not enable privileged intents for this MVP.
4. Enable Developer Mode in Discord, then copy IDs for the server, support role, ticket category, and log channel.
5. Use OAuth2 URL Generator with scopes:
   - `bot`
   - `applications.commands`
6. Add these bot permissions:
   - Manage Channels
   - View Channels
   - Send Messages
   - Embed Links
   - Read Message History
   - Manage Messages
   - Use Slash Commands
7. Open the generated URL and invite the bot to your server.

## Railway Deployment

This bot is a persistent Discord Gateway worker. It does not expose an HTTP server, so do not generate a public Railway domain for it.

1. Push this repository to GitHub.
2. Create a Railway project from the GitHub repository.
3. Add a Railway MySQL database service to the project.
4. Set these variables on the bot service:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
SUPPORT_ROLE_ID=
TICKET_CATEGORY_ID=
TICKET_LOG_CHANNEL_ID=
DATABASE_CLIENT=mysql
MYSQL_URL=${{MySQL.MYSQL_URL}}
DELETE_TICKET_ON_CLOSE=true
RAILPACK_NODE_VERSION=22
```

If Railway does not offer `MYSQL_URL` in the variable autocomplete, set these instead:

```env
MYSQLHOST=${{MySQL.MYSQLHOST}}
MYSQLPORT=${{MySQL.MYSQLPORT}}
MYSQLDATABASE=${{MySQL.MYSQLDATABASE}}
MYSQLUSER=${{MySQL.MYSQLUSER}}
MYSQLPASSWORD=${{MySQL.MYSQLPASSWORD}}
```

5. Set the bot service Start Command:

```bash
npm run start
```

6. Set the bot service Pre-deploy Command:

```bash
npm run db:migrate
```

7. Keep the bot service at one replica for v1 to avoid duplicate Discord Gateway sessions.
8. Register slash commands once from your local machine with `npm run deploy:commands`.
9. Confirm the bot is online, then run `/setup-tickets`.

## Commands

- `npm run start` - run the bot.
- `npm run dev` - run the bot with Node watch mode.
- `npm run deploy:commands` - register guild slash commands.
- `npm run db:migrate` - create the ticket table.
- `npm run test` - run unit tests.

## Ticket Behavior

- `/setup-tickets` posts a panel with an `Open Ticket` button.
- `Open Ticket` displays a modal asking for the user's issue.
- The bot creates one private ticket channel per user per guild.
- Support staff can close tickets with the `Close Ticket` button.
- Closing logs the ticket to `TICKET_LOG_CHANNEL_ID`.
- `DELETE_TICKET_ON_CLOSE=true` deletes the ticket channel after logging.
