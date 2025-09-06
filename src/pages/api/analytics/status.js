export const prerender = false;

import { lucia } from "../../../lib/auth";

export const GET = async ({ request, cookies }) => {
  try {
    // Get session from cookies
    const sessionid = cookies.get(lucia.sessionCookieName)?.value ?? null;
    
    // Authentication check
    if (!sessionid) {
      return new Response('Authentication required', { status: 401 });
    }
    
    const { user } = await lucia.validateSession(sessionid);
    if (!user || !['superadmin', 'admin', 'editor'].includes(user.role)) {
      return new Response('Unauthorized', { status: 403 });
    }

    // Get import status
    const status = await getImportStatus();
    
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analytics status error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Get current import status
async function getImportStatus() {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const importsDir = path.join(process.cwd(), 'src/data/analytics-imports');
    
    try {
      await fs.access(importsDir);
    } catch {
      // Directory doesn't exist yet
      return {
        importedFiles: 0,
        totalRecords: 0,
        dateRange: null,
        imports: []
      };
    }

    const files = await fs.readdir(importsDir);
    const importFiles = files.filter(f => f.startsWith('import-') && f.endsWith('.json'));
    
    let totalRecords = 0;
    let earliestDate = null;
    let latestDate = null;
    const imports = [];

    // Process each import file
    for (const filename of importFiles) {
      try {
        const filePath = path.join(importsDir, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const importData = JSON.parse(content);
        
        const metadata = importData.metadata;
        const summary = importData.data.summary;
        
        totalRecords += summary.totalRecords;
        
        // Track date range
        if (summary.dateRange.start) {
          const startDate = new Date(summary.dateRange.start);
          if (!earliestDate || startDate < earliestDate) {
            earliestDate = startDate;
          }
        }
        
        if (summary.dateRange.end) {
          const endDate = new Date(summary.dateRange.end);
          if (!latestDate || endDate > latestDate) {
            latestDate = endDate;
          }
        }
        
        imports.push({
          id: metadata.importId,
          filename: metadata.fileName,
          source: metadata.source,
          dateRange: metadata.dateRange || summary.dateRange.description,
          recordCount: metadata.recordCount,
          uploadedAt: metadata.uploadedAt,
          uploadedBy: metadata.uploadedBy
        });
        
      } catch (fileError) {
        console.warn(`Error processing import file ${filename}:`, fileError);
      }
    }

    // Format date range
    let dateRangeDisplay = null;
    if (earliestDate && latestDate) {
      const formatDate = (date) => date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      
      if (earliestDate.getTime() === latestDate.getTime()) {
        dateRangeDisplay = formatDate(earliestDate);
      } else {
        dateRangeDisplay = `${formatDate(earliestDate)} - ${formatDate(latestDate)}`;
      }
    }

    return {
      importedFiles: importFiles.length,
      totalRecords: totalRecords,
      dateRange: dateRangeDisplay,
      imports: imports.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    };

  } catch (error) {
    console.error('Error getting import status:', error);
    throw error;
  }
}