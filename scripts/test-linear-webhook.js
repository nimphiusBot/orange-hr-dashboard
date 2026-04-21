#!/usr/bin/env node

/**
 * Test Linear webhook integration
 * 
 * Run with: node scripts/test-linear-webhook.js
 * 
 * This sends a mock Linear webhook to test the HR Dashboard integration
 */

import fetch from 'node-fetch';

const HR_DASHBOARD_URL = 'http://localhost:3003/webhook/linear';

const mockLinearWebhook = {
  action: 'create',
  type: 'Issue',
  data: {
    id: 'test-' + Date.now(),
    identifier: 'ORA-TEST',
    title: 'Test Linear Integration from Script',
    description: 'This is a test webhook to verify HR Dashboard integration',
    state: {
      name: 'Todo',
      type: 'unstarted',
    },
    priority: 2,
    assignee: {
      id: 'test-user',
      name: 'Test User',
      displayName: 'Test User',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=test',
    },
    team: {
      id: 'test-team',
      name: 'ENG',
      key: 'ENG',
    },
    labels: {
      nodes: [
        { name: 'test', color: '#3B82F6' },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  url: 'https://linear.app/orangedoorhouse/issue/ORA-TEST',
};

async function testWebhook() {
  console.log('🚀 Testing Linear webhook integration\n');
  console.log(`📨 Sending webhook to: ${HR_DASHBOARD_URL}`);
  
  try {
    const response = await fetch(HR_DASHBOARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Linear-Signature': 'test-signature', // Mock signature
      },
      body: JSON.stringify(mockLinearWebhook),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Webhook accepted successfully!');
      console.log('Response:', result);
      
      console.log('\n📊 Expected result in HR Dashboard:');
      console.log('   - Activity Feed: "Test User created Linear issue: ORA-TEST - Test Linear Integration from Script"');
      console.log('   - Type: development');
      console.log('   - Team: ENG');
      console.log('   - Real-time update via WebSocket');
      
    } else {
      console.log('❌ Webhook rejected:', response.status, response.statusText);
      console.log('Response:', result);
    }
    
  } catch (error) {
    console.error('❌ Failed to send webhook:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Is HR Dashboard backend running? (npm run api)');
    console.error('   - Check port 3003 is accessible');
    console.error('   - Verify backend is listening for /webhook/linear');
  }
}

// Also test the Linear issues API
async function testLinearApi() {
  console.log('\n🔗 Testing Linear issues API endpoint...');
  
  try {
    const response = await fetch('http://localhost:3003/api/linear/issues');
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Linear API endpoint working! Found ${result.issues?.length || 0} issues`);
      console.log('Sample issue:', result.issues?.[0]?.title || 'No issues');
    } else {
      console.log('❌ Linear API endpoint error:', response.status);
    }
    
  } catch (error) {
    console.error('❌ Linear API test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  await testWebhook();
  await testLinearApi();
  
  console.log('\n🎯 Next steps for real integration:');
  console.log('   1. Get Linear API key from Linear → Settings → API');
  console.log('   2. Add to .env: LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxx');
  console.log('   3. Create webhook in Linear → Settings → Webhooks');
  console.log('   4. Add webhook secret to .env: LINEAR_WEBHOOK_SECRET=xxxxxxxx');
  console.log('   5. Run: node scripts/setup-linear-api.js');
}

runTests();