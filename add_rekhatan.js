const fs = require('fs');
const path = require('path');

const APPDATA = process.env.APPDATA || process.env.HOME;
const APP_DIR = path.join(APPDATA, 'Architecture Admin Panel');
const DATA_FILE = path.join(APP_DIR, 'data.json');

let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// Check if a rekhatan project already exists
let exists = data.projects.find(p => p.category === 'rekhatan');
if (!exists) {
    const newId = data.projects.length > 0 ? Math.max(...data.projects.map(p => p.id)) + 1 : 1;
    data.projects.push({
        id: newId,
        title: "Sketches & Drawings",
        category: "rekhatan",
        description: "A collection of hand-drawn sketches and architectural drawings.",
        thumbnail: "paint/p1.jpg",
        images: [
            "paint/p1.jpg",
            "paint/p2.jpg",
            "paint/p3.jpg",
            "paint/p4.jpg"
        ]
    });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4));
    console.log("Added rekhatan project to data.json.");
} else {
    console.log("rekhatan project already exists.");
}
