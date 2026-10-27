var express = require("express");
var cookieParser = require("cookie-parser");
var undici = require('undici');
var app = express();
var path = require("path");
var port, config, botContext, db;
var addLoginToDb, getUserDataFromAuthToken, deleteLoginFromDb;
var util = require('./util');
var ms = require('ms');

app.use(express.static('public'));
app.use("/icons", express.static('node_modules/bootstrap-icons/font'));
app.use(cookieParser(require('./config.json').clientSecret));
app.set('view engine', 'ejs');


app.get("/", (req, res)=>{
    res.render('index', {active: 'index', choices: config["funkyhelperSays"]});
});

app.get("/privacy", (req, res)=>{
    res.render('privacy', {active: 'privacy'});
});

app.get("/auth", (req,res)=>{
    res.redirect("/auth/login");
})

app.get("/auth/login", (req, res)=> {
    if(req?.signedCookies?.auth_token) {
        res.redirect("/admin");
        return;
    }
    if(!config.clientSecret || config.clientSecret == "SECRET_GOES_HERE") {
        res.render('callback', {error: "Login has not been properly set up. Please contact the Bot Maintainer. (No clientSecret was specified in config.)"});
        return;
    }
    res.render('login', {active: 'login', callbackUrl: config.callbackUrl});
});

app.get("/auth/logout", (req, res)=> {
    var authToken = req?.signedCookies?.auth_token;
    if(authToken) {
        res.clearCookie("auth_token");
        deleteLoginFromDb.run(authToken);
    }
    res.redirect("/");
})

app.get("/auth/callback", (req, res)=> {
    if(req?.query?.error) {
        if(req.query.error == "access_denied") {
            res.redirect("/auth/login");
            return;
        }
        res.render('callback', {error: req.query.error_description || req.query.error});
        return;
    }
    res.render('callback');
});

app.get("/auth/unauthorized", (req, res)=>{
    var authToken = req?.signedCookies?.auth_token;
    if(authToken) {
        res.clearCookie("auth_token");
        deleteLoginFromDb.run(authToken);
    }
    res.render('unauthorized');
})

app.get("/auth/send_code", async(req,res)=>{
    var code = req?.query?.code;
    if(!code) {
        res.render('callback', {active: 'callback', error: "No login code provided."});
        return;
    }
    try {
        var request = await undici.request("https://discord.com/api/oauth2/token", {
            method: 'POST',
            body: new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code,
                grant_type: "authorization_code",
                redirect_uri: config.redirectUri,
                scope: "identify"
            }).toString(),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });

        var oauthData = await request.body.json();
        if(oauthData.error) {
            res.render("callback", {error: oauthData.error_description || oauthData.error});
            return;
        }
        var userReq = await undici.request("https://discord.com/api/users/@me", {
            headers: {
                authorization: `${oauthData.token_type} ${oauthData.access_token}`
            }
        });
        var userData = await userReq.body.json();
        if(userData.error) {
            res.redirect(`/auth/callback?error=${encodeURI(userData.error_description || userData.error)}`);
            return;
        }
        var member = await botContext.guild.members.fetch(userData.id);
        if(!member) {
            res.redirect(`/auth/callback?error=${encodeURI(`You are not a member of ${botContext.guild.name}!`)}`);
            return;
        }
    } catch(err) {
        res.redirect(`/auth/callback?error=${encodeURI("An unknown error occurred when logging in. Discord might be down.")}`);
        console.error(request);
        return;
    }
    var botMaintainer = util.hasRole(member,config.allowRoleList);
    if(!botMaintainer) {
        res.redirect('/auth/unauthorized');
        return;
    };
    var authToken = crypto.randomUUID();
    res.cookie('auth_token', authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'prod',
        sameSite: 'strict',
        maxAge: ms("7d"),
        signed: true
    });
    addLoginToDb.run({
        auth_token: authToken,
        access_token: `${oauthData.token_type} ${oauthData.access_token}`,
        user_id: userData.id.toString()
    });
    res.redirect("/admin");
});

app.get("/admin", async(req,res)=>{
    if(!req?.signedCookies?.auth_token) {
        res.redirect("/auth/login");
        return;
    }
    var authData = await checkUser(req.signedCookies.auth_token);
    if(authData.error) {
        res.render('callback',{error:"Authentication error."});
        return;
    }
    if(!authData.authenticated) {
        res.clearCookie("auth_token");
        deleteLoginFromDb.run(req.signedCookies.auth_token);
        res.redirect("/auth/login");
        return;
    }
    if(!authData.botMaintainer) {
        res.redirect("/auth/unauthorized");
        return;
    }
    res.render("adminPanel", {botOwner: authData.botOwner});
});

app.use((req,res)=>{
    res.status(404).render('notFound');
});

async function init(sentConfig, sentBotContext) {
    config = sentConfig;
    botContext = sentBotContext;
    db = botContext.db;
    port = config.webPort || 3000;
    if(!config.clientSecret || config.clientSecret == "SECRET_GOES_HERE") {
        console.log("clientSecret was not set! Login will be unavailable.");
    }
    db.prepare(`
        CREATE TABLE IF NOT EXISTS admin_logins (
            auth_token TEXT PRIMARY KEY,
            access_token TEXT NOT NULL,
            user_id TEXT NOT NULL
        )
    `).run();
    addLoginToDb = db.prepare(`
        INSERT INTO admin_logins (auth_token, access_token, user_id) VALUES (:auth_token, :access_token, :user_id);    
    `);
    getUserDataFromAuthToken = db.prepare(`
        SELECT * FROM admin_logins WHERE auth_token = ?
    `);
    deleteLoginFromDb = db.prepare(`
        DELETE FROM admin_logins WHERE auth_token = ?
    `);
    app.listen(port, ()=> {
        console.log(`Site is now live at http://localhost:${port}`);
    })
}

async function checkUser(authToken) {
    var webUserData = getUserDataFromAuthToken.get(authToken);
    if(!webUserData) {
        return {botOwner:false,botMaintainer:false,authenticated:false,error:false};
    }
    try {
        var userReq = await undici.request("https://discord.com/api/users/@me", {
            headers: {
                authorization: webUserData.access_token
            }
        });
        var userData = await userReq.body.json();
    } catch(err) {
        console.error(err);
        return {botContext:false,botMaintainer:false,authenticated:false,error:true};
    }
    if(userData.error || !userData.id) {
        return {botOwner:false,botMaintainer:false,authenticated:false,error:true};
    }
    try {
        var member = await botContext.guild.members.fetch(userData.id);
    } catch(err) {
        return {botOwner:false,botMaintainer:false,authenticated:false,error:false};
    }
    if(!member || !member.roles) return {botOwner:false,botMaintainer:false,authenticated:false,error:false};
    return {
        botOwner: config.botOwners.includes(userData.id),
        botMaintainer: util.hasRole(member,config.allowRoleList),
        authenticated: true,
        error: false
    }
}


module.exports = {
    init,
    app
}