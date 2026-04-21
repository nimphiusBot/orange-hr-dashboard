import 'dotenv/config';
import { LinearClient } from './src/backend/linear-client.js';

async function testConnection() {
  console.log('🔗 Testing Linear API connection...\n');
  
  const client = new LinearClient();
  
  try {
    // Test teams
    console.log('📋 Fetching teams...');
    const teams = await client.getTeams();
    console.log(`✅ Found ${teams.length} teams:`);
    teams.forEach(team => {
      console.log(`   - ${team.key}: ${team.name} (${team.id})`);
    });
    
    // Test issues
    console.log('\n📋 Fetching issues...');
    const issues = await client.getIssues(10);
    console.log(`✅ Found ${issues.length} issues:`);
    issues.forEach(issue => {
      const assignee = issue.assignee ? issue.assignee.displayName : 'Unassigned';
      console.log(`   - ${issue.identifier}: ${issue.title}`);
      console.log(`     Status: ${issue.state.name} | Assignee: ${assignee} | Team: ${issue.team.key}`);
    });
    
    // Test creating an issue
    console.log('\n🎫 Testing issue creation...');
    if (teams.length > 0) {
      const firstTeam = teams[0];
      const testIssue = {
        title: 'Test Issue from HR Dashboard Integration',
        description: 'This is a test issue created via API to verify integration.',
        teamId: firstTeam.id,
        priority: 2, // Medium
      };
      
      try {
        const result = await client.createIssue(testIssue);
        if (result.success) {
          console.log(`✅ Created test issue: ${result.issue.identifier} - ${result.issue.title}`);
        } else {
          console.log('⚠️ Issue creation may require additional permissions');
        }
      } catch (createError) {
        console.log('ℹ️ Issue creation test skipped (may need specific permissions)');
      }
    }
    
    console.log('\n🎉 Linear API connection successful!');
    console.log('\n📊 Next steps:');
    console.log('   1. Create teams in Linear UI (ENG, DSN, DOC, QA, PROD, BA)');
    console.log('   2. Run setup script: npm run setup-linear');
    console.log('   3. Create webhook in Linear → Settings → Webhooks');
    
  } catch (error) {
    console.error('❌ Linear API connection failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Check LINEAR_API_KEY in .env file');
    console.error('   - Verify API key has correct permissions');
    console.error('   - Ensure Linear account is active');
  }
}

testConnection();