import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';
import assetConfig from './assetConfig.json' assert { type: 'json' };

// Corrected paths
const srcDir = path.join(process.cwd(), 'src', 'content');
const destDir = path.join(process.cwd(), 'public');

// console.log(`Source Directory: ${srcDir}`);
// console.log(`Destination Directory: ${destDir}`);

const patterns = assetConfig.staticFilePatterns.join('|');
// console.log(`Patterns: ${patterns}`);

function syncAssets() {
  const globPattern = `${srcDir}/**/*.+(${patterns})`;
  // console.log(`Glob Pattern: ${globPattern}`);

  glob(globPattern, { nodir: true }, (err, files) => {
    if (err) {
      // console.error('Error finding files:', err);
      return;
    }

    if (files.length === 0) {
      // console.log('No files found to copy.');
      return;
    }

    console.log(`Found ${files.length} files to copy.`);

    files.forEach(file => {
      const relativePath = path.relative(srcDir, file);
      const destPath = path.join(destDir, relativePath);
      // console.log(`Preparing to copy: ${file} to ${destPath}`);

      fs.copy(file, destPath, err => {
        if (err) {
          // console.error('Error copying file:', err);
        } else {

          let foldername = path.dirname(file).split(path.sep).pop();
          // folder's parent folder, the folder of folderaname
          let contenttype = path.dirname(file).split(path.sep).slice(-2)[0];
          let filename = path.basename(file);
          console.log(` ${contenttype} > ${foldername}/${filename}`);
        }
      });
    });
  });
}

syncAssets();
