const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  if (req.url === '/') {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>HR Dashboard - Simple Test</title>
      <style>
        body {
          font-family: system-ui, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          margin: 0;
          padding: 40px;
          min-height: 100vh;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        h1 {
          font-size: 3em;
          margin-bottom: 20px;
        }
        .status {
          background: #10B981;
          color: white;
          padding: 10px 20px;
          border-radius: 50px;
          display: inline-block;
          margin: 20px 0;
          font-weight: bold;
        }
        .card {
          background: rgba(255, 255, 255, 0.15);
          padding: 20px;
          border-radius: 15px;
          margin: 20px 0;
        }
        a {
          color: white;
          text-decoration: none;
          background: rgba(255, 255, 255, 0.2);
          padding: 12px 24px;
          border-radius: 10px;
          margin: 10px 5px;
          display: inline-block;
          transition: all 0.3s;
        }
        a:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎯 StoryHouse HR Dashboard</h1>
        <div class="status">✅ Server Running on Port 3004</div>
        
        <div class="card">
          <h2>🚀 Elite Productivity Dashboard</h2>
          <p>Beautiful team management interface with:</p>
          <ul>
            <li>Team overview with status indicators</li>
            <li>Project progress tracking</li>
            <li>GitHub activity analytics</li>
            <li>Approval workflow management</li>
            <li>Real-time activity feed</li>
          </ul>
        </div>
        
        <div class="card">
          <h2>🔗 Access Options</h2>
          <div>
            <a href="http://localhost:3002/">Main Dashboard (Vite)</a>
            <a href="http://192.168.1.210:3002/">Dashboard via IP</a>
            <a href="http://localhost:3003/health">API Health Check</a>
          </div>
        </div>
        
        <div class="card">
          <h2>🔧 Troubleshooting</h2>
          <p>If links don't work:</p>
          <ol>
            <li>Try hard refresh (Cmd+Shift+R)</li>
            <li>Try Incognito mode (Cmd+Shift+N)</li>
            <li>Check Brave extensions (disable temporarily)</li>
            <li>Try different browser (Chrome/Safari)</li>
            <li>Check firewall settings</li>
          </ol>
        </div>
        
        <div style="margin-top: 30px; font-size: 0.9em; opacity: 0.8; text-align: center;">
          <p>Server time: ${new Date().toLocaleString()}</p>
          <p>Built with elite engineering standards 🍊</p>
        </div>
      </div>
    </body>
    </html>
    `;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3004;
server.listen(PORT, () => {
  console.log(`Simple test server running on http://localhost:${PORT}`);
  console.log(`Also try: http://192.168.1.210:${PORT}`);
});