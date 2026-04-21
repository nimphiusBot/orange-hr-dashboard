#!/usr/bin/env node

/**
 * Setup Linear Workspace for Orange Doorhouse Inc
 * 
 * Run with: node setup-linear-workspace.js
 */

import 'dotenv/config';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_API_URL = 'https://api.linear.app/graphql';

if (!LINEAR_API_KEY) {
  console.error('❌ LINEAR_API_KEY not found in .env file');
  process.exit(1);
}

async function graphqlQuery(query, variables = {}) {
  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }
  
  return result.data;
}

async function setupLinearWorkspace() {
  console.log('🚀 Setting up Linear workspace for Orange Doorhouse Inc\n');
  
  try {
    // 1. Check current teams
    console.log('📋 Checking current teams...');
    const teamsData = await graphqlQuery(`
      query {
        teams {
          nodes {
            id
            name
            key
            description
          }
        }
      }
    `);
    
    const existingTeams = teamsData.teams.nodes;
    console.log(`✅ Found ${existingTeams.length} teams:`);
    existingTeams.forEach(team => {
      console.log(`   - ${team.key}: ${team.name} (${team.id})`);
    });
    
    // 2. Check current issues
    console.log('\n📋 Checking current issues...');
    const issuesData = await graphqlQuery(`
      query {
        issues(first: 20) {
          nodes {
            id
            identifier
            title
            description
            state {
              name
            }
            team {
              key
            }
            priority
            labels {
              nodes {
                name
              }
            }
          }
        }
      }
    `);
    
    const existingIssues = issuesData.issues.nodes;
    console.log(`✅ Found ${existingIssues.length} issues:`);
    existingIssues.forEach(issue => {
      console.log(`   - ${issue.identifier}: ${issue.title} (${issue.state.name})`);
    });
    
    // 3. Define our target teams
    const targetTeams = [
      { key: 'ENG', name: 'Engineering', description: 'Backend/Frontend development' },
      { key: 'DSN', name: 'Design System', description: 'Component library & design tokens' },
      { key: 'DOC', name: 'Documentation', description: 'Engineering documentation & standards' },
      { key: 'QA', name: 'Quality Assurance', description: 'Testing & quality control' },
      { key: 'PROD', name: 'Product Management', description: 'Product planning & roadmaps' },
      { key: 'BA', name: 'Business Analysis', description: 'Process optimization & metrics' },
    ];
    
    // Check which teams need to be created
    const existingTeamKeys = existingTeams.map(t => t.key);
    const teamsToCreate = targetTeams.filter(team => !existingTeamKeys.includes(team.key));
    
    console.log('\n🏗️ Team setup required:');
    if (teamsToCreate.length === 0) {
      console.log('   ✅ All target teams already exist!');
    } else {
      console.log(`   📝 ${teamsToCreate.length} teams need to be created:`);
      teamsToCreate.forEach(team => {
        console.log(`      - ${team.key}: ${team.name} (${team.description})`);
      });
      
      console.log('\n   🔧 Teams must be created manually in Linear UI:');
      console.log('      1. Go to Linear → Settings → Teams');
      console.log('      2. Click "Create team"');
      console.log('      3. Use exact team keys (ENG, DSN, DOC, etc.)');
      console.log('      4. Add descriptions as shown above');
    }
    
    // 4. Create our foundational issues
    console.log('\n🎫 Creating foundational issues...');
    
    // Get team IDs for assignment
    const teamIdMap = {};
    existingTeams.forEach(team => {
      teamIdMap[team.key] = team.id;
    });
    
    // Our foundational issues (starting from ORA-5 since 1-4 are default)
    const foundationalIssues = [
      {
        title: 'Set up design system repository',
        description: 'Create `storyhouse-design-system` repository with TypeScript, Storybook, and Astro documentation platform. Include foundational components, design tokens, and documentation structure.',
        teamKey: 'DSN',
        priority: 1, // High
      },
      {
        title: 'Implement engineering workflow',
        description: 'Document PR review process, QA integration, development standards, and GitHub workflows. Ensure all teams follow consistent engineering practices.',
        teamKey: 'DOC', 
        priority: 1,
      },
      {
        title: 'Create HR Dashboard ↔ Linear integration',
        description: 'Integrate Linear webhooks with Orange HR Dashboard. Show Linear activities in real-time, track team assignments, and display progress metrics.',
        teamKey: 'ENG',
        priority: 2, // Medium
      },
      {
        title: 'Hire Business Analyst',
        description: 'Hire BA to own Linear workspace, optimize workflows, create roadmaps, track velocity, and generate stakeholder reports.',
        teamKey: 'BA',
        priority: 1,
      },
      {
        title: 'Set up QA testing framework',
        description: 'Create testing infrastructure with Jest, React Testing Library, Cypress, and automated regression suite. Define QA review process.',
        teamKey: 'QA',
        priority: 2,
      },
    ];
    
    let createdCount = 0;
    for (const issueDef of foundationalIssues) {
      const teamId = teamIdMap[issueDef.teamKey];
      
      if (!teamId) {
        console.log(`   ⚠️ Skipping "${issueDef.title}" - Team ${issueDef.teamKey} not found`);
        continue;
      }
      
      try {
        // Check if issue already exists with similar title
        const existingSimilar = existingIssues.find(issue => 
          issue.title.includes(issueDef.title.substring(0, 30))
        );
        
        if (existingSimilar) {
          console.log(`   ⏭️ Issue already exists: ${existingSimilar.identifier} - ${existingSimilar.title}`);
          continue;
        }
        
        const createResult = await graphqlQuery(`
          mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id
                identifier
                title
                state {
                  name
                }
              }
            }
          }
        `, {
          input: {
            title: issueDef.title,
            description: issueDef.description,
            teamId: teamId,
            priority: issueDef.priority,
            stateId: await getStateId('Todo'),
          }
        });
        
        if (createResult.issueCreate.success) {
          console.log(`   ✅ Created: ${createResult.issueCreate.issue.identifier} - ${createResult.issueCreate.issue.title}`);
          createdCount++;
        } else {
          console.log(`   ❌ Failed to create: ${issueDef.title}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`   ❌ Error creating "${issueDef.title}":`, error.message);
      }
    }
    
    console.log(`\n📊 Created ${createdCount} new foundational issues.`);
    
    // 5. Webhook setup instructions
    console.log('\n🔗 Webhook setup required for HR Dashboard integration:');
    console.log('   1. Go to Linear → Settings → Webhooks');
    console.log('   2. Click "Create webhook"');
    console.log('   3. Set URL to: http://localhost:3003/webhook/linear');
    console.log('   4. Select events: Issue.created, Issue.updated, Issue.deleted');
    console.log('   5. Copy webhook secret and add to .env:');
    console.log('      LINEAR_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx');
    
    // 6. GitHub integration
    console.log('\n🔗 GitHub integration (optional but recommended):');
    console.log('   1. Go to Linear → Settings → Integrations → GitHub');
    console.log('   2. Connect your GitHub account');
    console.log('   3. Enable issue sync for repositories');
    
    console.log('\n🎉 Linear workspace setup complete!');
    console.log('\n📊 Next steps:');
    console.log('   1. Complete team creation in Linear UI (if needed)');
    console.log('   2. Run this script again to create issues for new teams');
    console.log('   3. Set up webhook for HR Dashboard integration');
    console.log('   4. Hire Business Analyst to own the workspace');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Check LINEAR_API_KEY in .env file');
    console.error('   - Verify API key has correct permissions');
    console.error('   - Ensure Linear account is active');
  }
}

// Helper to get state ID by name
async function getStateId(stateName) {
  try {
    // Default state IDs (Linear has default states)
    const stateMap = {
      'Todo': '83c5f7b2-9e3c-4e6c-8b2a-1e8c9f3a5b7d', // Common default ID
      'In Progress': 'ac4a5b3d-7e2f-4c8a-9b1d-6e8f9a3c5b7e',
      'Done': 'b3d7f9a2-5c8e-4b6a-9d1f-7e8c5a3b9f2d',
    };
    
    // Try to get actual state ID
    const statesData = await graphqlQuery(`
      query {
        workflowStates {
          nodes {
            id
            name
          }
        }
      }
    `);
    
    const state = statesData.workflowStates.nodes.find(s => s.name === stateName);
    return state ? state.id : stateMap[stateName];
  } catch (error) {
    // Return a common default ID if we can't fetch
    return '83c5f7b2-9e3c-4e6c-8b2a-1e8c9f3a5b7d';
  }
}

setupLinearWorkspace();