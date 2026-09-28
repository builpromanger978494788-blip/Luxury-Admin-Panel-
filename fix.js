const fs = require('fs');
let js = fs.readFileSync('d:/Sohanmali Admin pannel/server.js', 'utf8');
js = js.replace(/proj\.category === 'rekhatan' \? '[^']+' :/g, "proj.category === 'rekhatan' ? 'रेखाटने' :");
fs.writeFileSync('d:/Sohanmali Admin pannel/server.js', js, 'utf8');
console.log('server.js fixed');
