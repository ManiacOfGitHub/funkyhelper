var express = require("express");
var app = express();
var path = require("path");
var port, config;

app.use(express.static('public'));
app.use("/icons", express.static('node_modules/bootstrap-icons/font'))
app.set('view engine', 'ejs');


app.get("/", (req, res)=>{
    res.render('index', {active: 'index', choices: config["funkyhelperSays"]});
});

app.get("/privacy", (req, res)=>{
    res.render('privacy', {active: 'privacy'});
});

app.get("/auth/login", (req, res)=> {
    res.render('login', {active: 'login', callbackUrl: config.callbackUrl});
});

app.get("/auth/callback", (req, res)=> {
    if(req?.query?.error) {
        if(req.query.error == "access_denied") {
            res.redirect("/auth/login");
            return;
        }
        res.render('callback', {active: 'callback', error: req.query.error_description || req.query.error});
        return;
    }
    res.render('callback', {active: 'callback'});
});

async function init(sentConfig) {
    config = sentConfig;
    port = config.webPort || 3000;
    app.listen(port, ()=> {
        console.log(`Site is now live at http://localhost:${port}`);
    })
}


module.exports = {
    init,
    app
}