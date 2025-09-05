import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function extractCdnUrl(eventbriteUrl) {
  // Extract the direct CDN URL from the img.evbuc.com URL
  // Format: https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F1018530423%2F177237344149%2F1%2Foriginal.20250428-201423
  // Extract: https://cdn.evbuc.com/images/1018530423/177237344149/1/original.20250428-201423
  
  const urlMatch = eventbriteUrl.match(/https%3A%2F%2Fcdn\.evbuc\.com%2F(.+)/);
  if (urlMatch) {
    const decodedPath = decodeURIComponent(urlMatch[1]);
    return `https://cdn.evbuc.com/${decodedPath}`;
  }
  return null;
}

async function downloadImage(url, filename) {
  try {
    console.log(`🔗 Trying: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ Failed to download ${filename}: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const buffer = await response.arrayBuffer();
    const publicDir = path.join(__dirname, 'public/images/events');
    
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const filePath = path.join(publicDir, filename);
    fs.writeFileSync(filePath, new Uint8Array(buffer));
    console.log(`✅ Downloaded ${filename} (${buffer.byteLength} bytes)`);
    return true;
  } catch (error) {
    console.log(`❌ Error downloading ${filename}:`, error.message);
    return false;
  }
}

async function updateEventFile(eventPath, newImagePath, newTeacherPath = null) {
  try {
    const content = fs.readFileSync(eventPath, 'utf8');
    const event = JSON.parse(content);
    event.image = newImagePath;
    if (newTeacherPath) {
      event.teacherImage = newTeacherPath;
    }
    fs.writeFileSync(eventPath, JSON.stringify(event, null, 2));
    console.log(`📝 Updated ${path.basename(eventPath)} with local image path`);
  } catch (error) {
    console.log(`❌ Error updating ${eventPath}:`, error.message);
  }
}

async function main() {
  const eventsDir = path.join(__dirname, 'src/content/events');
  const eventFiles = fs.readdirSync(eventsDir).filter(file => file.endsWith('.json'));
  
  for (const file of eventFiles) {
    const eventPath = path.join(eventsDir, file);
    const content = fs.readFileSync(eventPath, 'utf8');
    const event = JSON.parse(content);
    
    console.log(`\n🔍 Processing ${event.name} (${event.id})`);
    
    let mainImageDownloaded = false;
    let teacherImageDownloaded = false;
    
    // Look for main image - try to find the first "original" image
    if (event.images && event.images.length > 0) {
      const originalImages = event.images.filter(url => url.includes('original'));
      
      if (originalImages.length > 0) {
        const firstOriginal = originalImages[0];
        const cdnUrl = extractCdnUrl(firstOriginal);
        
        if (cdnUrl) {
          const filename = `${event.id}-main-large.jpg`;
          console.log(`📥 Downloading main image from: ${cdnUrl}`);
          const success = await downloadImage(cdnUrl, filename);
          
          if (success) {
            await updateEventFile(eventPath, `/images/events/${filename}`);
            mainImageDownloaded = true;
          }
        }
      }
    }
    
    // Look for teacher image - try to extract CDN URL from teacherImage field
    if (event.teacherImage && event.teacherImage.includes('img.evbuc.com') && event.teacherImage.includes('original')) {
      const cdnUrl = extractCdnUrl(event.teacherImage);
      
      if (cdnUrl) {
        const filename = `${event.id}-teacher.jpg`;
        console.log(`👨‍🏫 Downloading teacher image from: ${cdnUrl}`);
        const success = await downloadImage(cdnUrl, filename);
        
        if (success) {
          // Update the teacherImage field too
          const content = fs.readFileSync(eventPath, 'utf8');
          const updatedEvent = JSON.parse(content);
          updatedEvent.teacherImage = `/images/events/${filename}`;
          fs.writeFileSync(eventPath, JSON.stringify(updatedEvent, null, 2));
          console.log(`👨‍🏫 Updated teacher image for ${event.name}`);
          teacherImageDownloaded = true;
        }
      }
    }
    
    if (!mainImageDownloaded && !teacherImageDownloaded) {
      console.log(`⚠️  No extractable CDN URLs found for ${event.name}`);
    }
  }
  
  console.log('\n✨ Large image download process complete!');
}

main().catch(console.error);