#!/usr/bin/env node

/**
 * Quick Asset Verification Test
 * Lightweight test to verify all critical assets exist
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS = {
  'DRBI Categories': [
    'src/assets/drbi/arts.webp',
    'src/assets/drbi/cemetery.webp', 
    'src/assets/drbi/study.webp',
    'src/assets/drbi/soil.webp',
    'src/assets/drbi/kure.webp'
  ],
  'Team/Volunteers': [
    'src/assets/people/rasmussen.webp',
    'src/assets/people/viva.webp',
    'src/assets/people/bonnie.webp',
    'src/assets/people/lamont.webp',
    'src/assets/people/gayle.webp',
    'src/assets/people/rob-prater.webp',
    'src/assets/people/john-hanke.webp',
    'src/assets/people/bettie-johnston.webp'
  ],
  'Radio DJs': [
    'src/assets/people/Roman-Orona.webp',
    'src/assets/people/Melody-Mel.webp',
    'src/assets/people/Rick-Rock.webp',
    'src/assets/people/Helena-Esaloma.webp',
    'src/assets/people/Chris-Ruhe.webp'
  ]
};

console.log('🔍 Verifying DRBI Asset Integrity...\n');

let allGood = true;
let totalAssets = 0;
let foundAssets = 0;

Object.entries(ASSETS).forEach(([category, assets]) => {
  console.log(`📂 ${category}:`);
  
  assets.forEach(assetPath => {
    totalAssets++;
    const fullPath = path.join(__dirname, assetPath);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
      const stats = fs.statSync(fullPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`  ✅ ${path.basename(assetPath)} (${sizeMB}MB)`);
      foundAssets++;
    } else {
      console.log(`  ❌ ${path.basename(assetPath)} - MISSING`);
      allGood = false;
    }
  });
  
  console.log();
});

// Check content migration
console.log('📝 Content Migration:');
const contentDirs = ['memorial', 'news', 'articles'];
let totalContent = 0;

contentDirs.forEach(dir => {
  const dirPath = path.join(__dirname, 'src/content', dir);
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
    console.log(`  ✅ ${dir}: ${files.length} files`);
    totalContent += files.length;
  } else {
    console.log(`  ❌ ${dir}: directory missing`);
    allGood = false;
  }
});

console.log(`\n📊 Summary:`);
console.log(`  Assets: ${foundAssets}/${totalAssets} found`);
console.log(`  Content: ${totalContent} files migrated`);

if (allGood && totalContent >= 45) {
  console.log(`\n🎉 All assets verified! Migration successful.`);
  process.exit(0);
} else {
  console.log(`\n💥 Asset verification failed. Check missing items above.`);
  process.exit(1);
}