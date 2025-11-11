// resize-images.js
// ---------------------------------------
// Dieses Skript verkleinert alle Bilder in einem Eingabeordner
// und speichert sie in einem Ausgabeordner mit gleicher Dateistruktur.
// ---------------------------------------

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// === KONFIGURATION ===
const INPUT_DIR = path.join(__dirname, 'src/assets/icons');
const OUTPUT_DIR = path.join(__dirname, 'src/assets/icons-small');
const TARGET_SIZE = 150; // Zielgröße (in Pixel)
const QUALITY = 80; // Qualitätsstufe (0–100, nur für JPG/WebP)

// === FUNKTIONEN ===

// rekursiv alle Dateien im Ordner holen
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

// Hauptlogik
async function resizeImages() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Eingabeordner nicht gefunden: ${INPUT_DIR}`);
    return;
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Ausgabeordner erstellt: ${OUTPUT_DIR}`);
  }

  const allFiles = getAllFiles(INPUT_DIR).filter((file) =>
    /\.(png|jpe?g|webp)$/i.test(file)
  );

  console.log(`🔍 ${allFiles.length} Bilddateien gefunden...`);

  for (const filePath of allFiles) {
    const relativePath = path.relative(INPUT_DIR, filePath);
    const outputPath = path.join(OUTPUT_DIR, relativePath);
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    try {
      await sharp(filePath)
        .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'cover' })
        .toFormat('webp', { quality: QUALITY })
        .toFile(outputPath.replace(/\.[^.]+$/, '.webp'));

      console.log(`✅ ${relativePath} -> images-small/`);
    } catch (err) {
      console.error(`⚠️ Fehler bei ${relativePath}:`, err);
    }
  }

  console.log('🎉 Alle Bilder erfolgreich verkleinert!');
}

// Skript ausführen
resizeImages();