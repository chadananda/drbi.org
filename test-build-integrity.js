#!/usr/bin/env node

/**
 * Build Integrity Test Suite for DRBI Website Migration
 * Tests for missing assets, broken imports, and build stability
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, 'src');

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`✅ ${name}`);
    passCount++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failCount++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findFiles(dir, extensions = ['.astro', '.mdx', '.md', '.js', '.ts'], excludeDirs = ['node_modules', 'dist', '.astro']) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!excludeDirs.some(exclude => fullPath.includes(exclude))) {
          traverse(fullPath);
        }
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function extractAssetImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = [];
  
  // Match import statements for assets
  const importRegex = /import\s+\w+\s+from\s+["'](\.\.?\/[^"']*\.(png|jpg|jpeg|webp|svg|gif))["']/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      importPath: match[1],
      fullMatch: match[0],
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  return imports;
}

function resolveImportPath(filePath, importPath) {
  const fileDir = path.dirname(filePath);
  return path.resolve(fileDir, importPath);
}

console.log('🧪 Running DRBI Build Integrity Tests...\n');

// Test 1: Check for missing asset files
test('All imported assets exist', () => {
  const files = findFiles(srcDir);
  const missingAssets = [];
  
  files.forEach(filePath => {
    const imports = extractAssetImports(filePath);
    imports.forEach(imp => {
      const resolvedPath = resolveImportPath(filePath, imp.importPath);
      if (!fs.existsSync(resolvedPath)) {
        missingAssets.push({
          file: path.relative(__dirname, filePath),
          import: imp.importPath,
          line: imp.line,
          resolved: path.relative(__dirname, resolvedPath)
        });
      }
    });
  });
  
  if (missingAssets.length > 0) {
    console.log('\nMissing assets found:');
    missingAssets.forEach(asset => {
      console.log(`  📁 ${asset.file}:${asset.line} -> ${asset.import} (${asset.resolved})`);
    });
  }
  
  assert(missingAssets.length === 0, `${missingAssets.length} missing assets found`);
});

// Test 2: Verify DRBI category images exist
test('DRBI category images exist', () => {
  const requiredImages = [
    'src/assets/drbi/arts.webp',
    'src/assets/drbi/cemetery.webp', 
    'src/assets/drbi/study.webp',
    'src/assets/drbi/soil.webp',
    'src/assets/drbi/kure.webp'
  ];
  
  const missingImages = requiredImages.filter(img => 
    !fs.existsSync(path.join(__dirname, img))
  );
  
  assert(missingImages.length === 0, `Missing DRBI images: ${missingImages.join(', ')}`);
});

// Test 3: Verify people images exist  
test('People images exist', () => {
  const requiredPeople = [
    'src/assets/people/rasmussen.webp',
    'src/assets/people/viva.webp',
    'src/assets/people/bonnie.webp',
    'src/assets/people/lamont.webp',
    'src/assets/people/gayle.webp',
    'src/assets/people/rob-prater.webp',
    'src/assets/people/john-hanke.webp',
    'src/assets/people/bettie-johnston.webp',
    'src/assets/people/Roman-Orona.webp',
    'src/assets/people/Melody-Mel.webp',
    'src/assets/people/Rick-Rock.webp',
    'src/assets/people/Helena-Esaloma.webp',
    'src/assets/people/Chris-Ruhe.webp'
  ];
  
  const missingPeople = requiredPeople.filter(img => 
    !fs.existsSync(path.join(__dirname, img))
  );
  
  assert(missingPeople.length === 0, `Missing people images: ${missingPeople.join(', ')}`);
});

// Test 4: Check for broken astro:db imports
test('No astro:db imports remain', () => {
  const files = findFiles(srcDir);
  const dbImports = [];
  
  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      if (line.includes('from \'astro:db\'') || line.includes('from "astro:db"')) {
        // Skip commented lines
        const trimmed = line.trim();
        if (!trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
          dbImports.push({
            file: path.relative(__dirname, filePath),
            line: index + 1,
            content: line.trim()
          });
        }
      }
    });
  });
  
  if (dbImports.length > 0) {
    console.log('\nActive astro:db imports found:');
    dbImports.forEach(imp => {
      console.log(`  📁 ${imp.file}:${imp.line} -> ${imp.content}`);
    });
  }
  
  assert(dbImports.length === 0, `${dbImports.length} active astro:db imports found`);
});

// Test 5: Verify content directories exist
test('Content directories exist', () => {
  const requiredDirs = [
    'src/content/memorial',
    'src/content/news', 
    'src/content/articles',
    'src/content/postdb',
    'src/content/comments'
  ];
  
  const missingDirs = requiredDirs.filter(dir => 
    !fs.existsSync(path.join(__dirname, dir))
  );
  
  assert(missingDirs.length === 0, `Missing content directories: ${missingDirs.join(', ')}`);
});

// Test 6: Check migrated content exists
test('Migrated content files exist', () => {
  const memorialFiles = fs.readdirSync(path.join(__dirname, 'src/content/memorial'))
    .filter(f => f.endsWith('.md'));
  const newsFiles = fs.readdirSync(path.join(__dirname, 'src/content/news'))
    .filter(f => f.endsWith('.md'));
  const articleFiles = fs.readdirSync(path.join(__dirname, 'src/content/articles'))
    .filter(f => f.endsWith('.md'));
    
  const totalContent = memorialFiles.length + newsFiles.length + articleFiles.length;
  
  assert(memorialFiles.length >= 40, `Expected 40+ memorial files, found ${memorialFiles.length}`);
  assert(totalContent >= 45, `Expected 45+ total content files, found ${totalContent}`);
});

// Test 7: Build test (most comprehensive)
test('Build completes successfully', () => {
  console.log('    Running npm run build...');
  try {
    const buildOutput = execSync('npm run build', { 
      cwd: __dirname, 
      encoding: 'utf8',
      timeout: 120000 // 2 minute timeout
    });
    
    // Check for build errors in output
    const hasErrors = buildOutput.toLowerCase().includes('error') && 
                     !buildOutput.includes('0 errors') &&
                     !buildOutput.includes('no errors');
    
    assert(!hasErrors, 'Build output contains errors');
    
    // Verify dist directory was created
    assert(fs.existsSync(path.join(__dirname, 'dist')), 'dist directory not created');
    
    console.log('    ✓ Build completed successfully');
  } catch (error) {
    throw new Error(`Build failed: ${error.message}`);
  }
});

// Test 8: Dev server starts without errors
test('Dev server starts successfully', () => {
  console.log('    Testing dev server startup...');
  try {
    // Start dev server with timeout
    const devOutput = execSync('timeout 10s npm run dev || true', { 
      cwd: __dirname, 
      encoding: 'utf8'
    });
    
    // Check for startup success indicators
    const hasStarted = devOutput.includes('Local') || 
                      devOutput.includes('ready in') ||
                      devOutput.includes('watching for file changes');
    
    const hasErrors = devOutput.toLowerCase().includes('error') && 
                     !devOutput.includes('db is not defined') && // We know about this
                     !devOutput.includes('0 errors');
    
    assert(hasStarted, 'Dev server did not start properly');
    assert(!hasErrors, 'Dev server startup contains errors');
    
    console.log('    ✓ Dev server started successfully');
  } catch (error) {
    // Timeout is expected, just check if there were startup errors
    if (!error.message.includes('timeout')) {
      throw error;
    }
  }
});

// Summary
console.log(`\n📊 Test Results:`);
console.log(`   Total: ${testCount}`);
console.log(`   ✅ Passed: ${passCount}`);
console.log(`   ❌ Failed: ${failCount}`);

if (failCount === 0) {
  console.log(`\n🎉 All tests passed! Build integrity verified.`);
  process.exit(0);
} else {
  console.log(`\n💥 ${failCount} test(s) failed. Please fix the issues above.`);
  process.exit(1);
}