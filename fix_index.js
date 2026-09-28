const fs = require('fs');
let js = fs.readFileSync('d:/sohanmail/smdark/index.html', 'utf8');
js = js.replace(/<button class="filter-btn" onclick="filterProjects\(this,'rekhatan'\)">\s*[^<]*\s*<\/button>/g, `<button class="filter-btn" onclick="filterProjects(this,'rekhatan')">
          रेखाटने
        </button>`);
fs.writeFileSync('d:/sohanmail/smdark/index.html', js, 'utf8');
console.log('index.html fixed');
