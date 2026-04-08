const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');
const Jimp = require('jimp');

async function convert() {
  const input = path.join(__dirname, 'assets', 'app_icon.png');
  const tempPng = path.join(__dirname, 'assets', 'temp_icon.png');
  const output = path.join(__dirname, 'assets', 'icon.ico');
  
  console.log(`Processing ${input}...`);
  try {
    // 1. Resize the image to 256x256 using Jimp
    const image = await Jimp.read(input);
    await image.resize(256, 256).writeAsync(tempPng);
    console.log(`Resized PNG saved to ${tempPng}`);

    // 2. Convert the resized PNG to ICO
    const converter = typeof pngToIco === 'function' ? pngToIco : pngToIco.default;
    const buf = await converter(tempPng);
    fs.writeFileSync(output, buf);
    console.log('Conversion successful!');

    // 3. Clean up
    fs.unlinkSync(tempPng);
  } catch (err) {
    console.error('Conversion failed:', err);
  }
}

convert();
