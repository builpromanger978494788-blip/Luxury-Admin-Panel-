const Jimp = require('jimp');
const pngToIco = require('png-to-ico');
const fs = require('fs');

async function convertImage() {
  try {
    const imgPath = "C:\\Users\\Gulesh Patel\\.gemini\\antigravity-ide\\brain\\04b47a90-90a8-4b6c-b4f7-4c0e58d5da4e\\admin_desktop_logo_1790798116309.jpg";
    console.log("Reading image...");
    const img = await Jimp.read(imgPath);
    console.log("Resizing and writing as PNG...");
    await img.resize(256, 256).writeAsync('icon.png');
    console.log("Converting PNG to ICO...");
    const buf = await pngToIco('icon.png');
    fs.writeFileSync('icon.ico', buf);
    console.log("Success! icon.ico generated.");
  } catch (err) {
    console.error("Error:", err);
  }
}

convertImage();
