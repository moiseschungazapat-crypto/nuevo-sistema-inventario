const fs = require('fs');
const sharp = require('sharp');

const input = process.argv[2];
const output = process.argv[3];

sharp(fs.readFileSync(input), { density: 220 })
  .png({ compressionLevel: 9 })
  .toFile(output)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
