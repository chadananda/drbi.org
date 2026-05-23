import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const eventsDir = path.join(__dirname, 'src/content/events');
  const eventFiles = fs.readdirSync(eventsDir).filter(file => file.endsWith('.json'));
  
  for (const file of eventFiles) {
    const eventPath = path.join(eventsDir, file);
    const content = fs.readFileSync(eventPath, 'utf8');
    const event = JSON.parse(content);
    
    console.log(`\n📋 Event: ${event.name} (${event.id})`);
    
    // Show main image
    console.log(`   Main image: ${event.image}`);
    
    // Show teacher image  
    console.log(`   Teacher image: ${event.teacherImage}`);
    
    // Show all images in array
    console.log(`   Images array (${event.images?.length || 0} items):`);
    event.images?.forEach((img, i) => {
      if (img.startsWith('https://cdn.evbuc.com/')) {
        console.log(`     ${i}: ✅ CDN: ${img}`);
      } else if (img.includes('original')) {
        console.log(`     ${i}: 📸 Original: ${img.substring(0, 100)}...`);
      } else {
        console.log(`     ${i}: 🖼️  Other: ${img.substring(0, 100)}...`);
      }
    });
  }
}

main();