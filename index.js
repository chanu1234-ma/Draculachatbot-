const { useMultiFileAuthState, makeWASocket, DisconnectReason, getContentType, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const axios = require('axios');
const express = require('express');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const P = require('pino');
const { googleTranslate } = require('google-translate-api');
const schedule = require('node-schedule');  // Schedule library for reminders

const prefix = '.';
const ownerNumber = ['94763408860'];

const app = express();
const port = process.env.PORT || 8000;

// Schedule a reminder for daily class at 9 AM
schedule.scheduleJob('0 9 * * *', function(){
  console.log('Class reminder: Don\'t forget your 9 AM class!');
});

// Translate feature for Sinhala-English translation
async function translateText(text, lang) {
  try {
    const translation = await googleTranslate(text, { to: lang });
    return translation.text;
  } catch (err) {
    console.error('Error in translation:', err);
    return 'Error translating the text';
  }
}

async function connectToWA() {
  console.log("Connecting Dracula Bot...");

  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    browser: Browsers.macOS('Dracula'),
    auth: state,
    version
  });

  conn.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        connectToWA();
      }
    } else if (connection === 'open') {
      console.log('✅ Dracula Bot connected!');
    }
  });

  conn.ev.on('creds.update', saveCreds);

  conn.ev.on('messages.upsert', async (mek) => {
    const msg = mek.messages[0];
    if (!msg.message) return;
    const type = getContentType(msg.message);
    const body = (type === 'conversation') ? msg.message.conversation :
      (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';
    const from = msg.key.remoteJid;
    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';

    if (isCmd) {
      // Translation Command: .translate
      if (command === 'translate') {
        const args = body.slice(prefix.length).trim().split(' ').slice(1);
        const textToTranslate = args.join(' ');
        const translated = await translateText(textToTranslate, 'en');
        conn.sendMessage(from, { text: translated }, { quoted: msg });
      }

      // Class Reminder Command: .remind
      if (command === 'remind') {
        conn.sendMessage(from, { text: 'Reminder: Class starts soon!📚' }, { quoted: msg });
      }
    }
  });
}

app.get("/", (req, res) => {
  res.send("✅ Dracula Chat Bot server is running.");
});

app.listen(port, () => console.log(`🌐 Server listening on port http://localhost:${port}`));

setTimeout(() => {
  connectToWA();
}, 3000);
