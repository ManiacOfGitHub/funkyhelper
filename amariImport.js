var amariData = require('./amariExport.json');
var db = require('better-sqlite3')('data.db');
var insertData = db.transaction((users)=>{
    var userUpdateFunction = db.prepare(`
        INSERT INTO user_exp (user_id, exp)
        VALUES (:user_id, :exp)
        ON CONFLICT(user_id) DO UPDATE SET
            exp = excluded.exp
    `);
    for(var user of users) {
        userUpdateFunction.run({user_id:user.id,exp:user.exp});
    }
});
insertData(amariData);
db.close();