var express = require("express");
var app = express();
var path = require("path");
var port, config;

app.use(express.static('public'));
app.set('view engine', 'ejs');


app.get("/", (req, res)=>{
    res.render('index', {active: 'index'});
});

app.get("/privacy", (req, res)=>{
    res.render('privacy', {active: 'privacy'});
})


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