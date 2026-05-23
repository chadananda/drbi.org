// force-cron.js - Force run cron by clearing the throttle file
import fs from 'fs';

async function forceCron() {
  console.log('🔄 Forcing cron to run by clearing throttle...');
  
  const cronFile = './cron-last-run.json';
  
  try {
    // Remove the throttle file
    if (fs.existsSync(cronFile)) {
      fs.unlinkSync(cronFile);
      console.log('✅ Cleared cron throttle file');
    }
    
    console.log('🧪 Now testing the cron API...');
    
    // Call the API endpoint
    const response = await fetch('http://localhost:4322/api/crontasks');
    
    if (response.ok) {
      console.log('✅ Cron API executed successfully!');
      console.log('Check the dev server logs for execution details');
    } else {
      console.error('❌ Cron API failed:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the dev server is running on http://localhost:4322');
  }
}

forceCron();