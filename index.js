require('dotenv').config()
const fs = require('fs')
const P = require('pino')
const axios = require('axios')
const qrcode = require('qrcode-terminal')
const express = require("express")
const { Configuration, OpenAIApi } = require("openai")
const { File } = require('megajs')
const { getBuffer, getGroupAdmins } = require('./lib/functions')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers,
    jidNormalizedUser
} = require('@whiskeysockets/baileys')

const ownerNumber = ['94779415698']
const SESSION_ID = process.env.SESSION_ID
const prefix = '.'

// === session file from mega ===
if (!fs.existsSync('./auth_info_baileys/creds.json')) {
    if (!SESSION_ID) return console.log('❌ SESSION_ID not found in .env file!')
    const filer = File.fromURL(`https://mega.nz/file/${SESSION_ID}`)
    filer.download((err, data) => {
        if (err) throw err
        fs.writeFileSync('./auth_info_baileys/creds.json', data)
        console.log("✅ Session downloaded successfully.")
    })
}

// === express server ===
const app = express()
const port = process.env.PORT || 8000
app.get("/", (_, res) => res.send("✅ Dracula Chat Bot is running."))
app.listen(port, () => console.log(`🌐 Server listening on http://localhost:${port}`))

// === Connect bot ===
async function connectToWA() {
    console.log("🧬 Connecting to WhatsApp...")
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys/')
    const { version } = await fetchLatestBaileysVersion()

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        browser: Browsers.macOS("Firefox"),
        printQRInTerminal: false,
        auth: state,
        version
    })

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            connectToWA()
        } else if (connection === 'open') {
            console.log('✅ Bot connected successfully.')

            conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
                image: { url: `https://telegra.ph/file/900435c6d3157c98c3c88.jpg` },
                caption: "🤖 Dracula Bot Online!\nPrefix: " + prefix
            })
        }
    })

    conn.ev.on('creds.update', saveCreds)

    conn.ev.on('messages.upsert', async (mek) => {
        mek = mek.messages[0]
        if (!mek.message) return

        mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
        if (mek.key.remoteJid === 'status@broadcast') return

        const from = mek.key.remoteJid
        const type = getContentType(mek.message)
        const body = (type === 'conversation') ? mek.message.conversation :
            (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text :
                (type === 'imageMessage') && mek.message.imageMessage.caption ?
                    mek.message.imageMessage.caption : ''
        const isCmd = body.startsWith(prefix)
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : ''
        const args = body.trim().split(/ +/).slice(1)
        const q = args.join(' ')
        const sender = mek.key.fromMe ? conn.user.id : (mek.key.participant || mek.key.remoteJid)
        const senderNumber = sender.split('@')[0]

        const reply = (text) => conn.sendMessage(from, { text }, { quoted: mek })

        // === GPT AI auto reply ===
        if (!isCmd && body) {
            try {
                const configuration = new Configuration({
                    apiKey: process.env.OPENAI_API_KEY,
                })
                const openai = new OpenAIApi(configuration)

                const response = await openai.createChatCompletion({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: "You are Dracula Bot. You can understand and respond in Sinhala and English. Be professional and helpful."
                        },
                        {
                            role: "user",
                            content: body
                        }
                    ]
                })

                const aiReply = response.data.choices[0].message.content
                reply(aiReply)

            } catch (err) {
                console.error("GPT Error:", err)
                reply("⚠️ AI system unavailable right now. Please try again later.")
            }
        }

        // === Command Example ===
        if (command === 'menu') {
            reply("🧛‍♂️ *Dracula Bot Menu*\n\n🔹 AI Reply (සිංහල / English)\n🔹 Owner: @" + ownerNumber[0])
        }

    })
}

// Start after short delay
setTimeout(connectToWA, 3000)
