const { default: makeWASocket, useSingleFileAuthState } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const { unlinkSync, existsSync, mkdirSync } = require("fs");

// Authentication File
const SESSION_FILE_PATH = "./session.json";
if (!existsSync(SESSION_FILE_PATH)) mkdirSync(SESSION_FILE_PATH, { recursive: true });
const { state, saveState } = useSingleFileAuthState(SESSION_FILE_PATH);

// Connect to WhatsApp
async function connectToWhatsApp() {
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // GitHub Actions ke logs me QR code print hoga
    });

    sock.ev.on("creds.update", saveState);
    
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("✅ Bot Connected to WhatsApp!");
        } else if (connection === "close") {
            if (lastDisconnect.error && Boom.isBoom(lastDisconnect.error)) {
                const reason = lastDisconnect.error.output.statusCode;
                if (reason === 401) {
                    console.log("❌ Session expired! Delete 'session.json' and restart.");
                    unlinkSync(SESSION_FILE_PATH);
                } else {
                    console.log("🔄 Reconnecting...");
                    connectToWhatsApp();
                }
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const message = messages[0];
        if (!message.message) return;
        const from = message.key.remoteJid;
        const text = message.message.conversation || message.message.extendedTextMessage?.text;
        
        console.log(`📩 Message from ${from}: ${text}`);
        
        if (text === "hi") {
            await sock.sendMessage(from, { text: "Hello! 👋 I am your bot." });
        }
    });
}

// Start the bot
connectToWhatsApp();
