var express = require("express");
var app = express();
var port, config;


app.get("/", (req, res)=>{
    res.send("felper has a website now");
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