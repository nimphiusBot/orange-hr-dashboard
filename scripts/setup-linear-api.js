#!/usr/bin/env node

/**
 * Linear.app Setup Script
 * 
 * This script sets up the Orange Doorhouse Inc Linear workspace
 * Run with: node scripts/setup-linear-api.js
 * 
 * Requires: LINEAR_API_KEY environment variable
 */

import 'dotenv/config';
import { LinearClient } from '../src/backend/linear-client.js';

// Check for API key
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
if (!LINEAR_API_KEY) {
  console.error('❌ LINEAR_API_KEY not found in .env file');
  console.error('Get API key from Linear → Settings → API');
  console.error('Add to .env: LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxx');
  process.exit(1);
}

const client = new LinearClient(LINEAR_API_KEY);

// Team definitions
const TEAMS = [
  {
    name: 'Engineering',
    key: 'ENG',
    description: 'Backend/Frontend development',
    color: '#3B82F6', // blue
  },
  {
    name: 'Design System',
    key: 'DSN',
    description: 'Component library & design tokens',
    color: '#8B5CF6', // purple
  },
  {
    name: 'Documentation',
    key: 'DOC',
    description: 'Engineering documentation & standards',
    color: '#10B981', // green
  },
  {
    name: 'Quality Assurance',
    key: 'QA',
    description: 'Testing & quality control',
    color: '#F59E0B', // orange
  },
  {
    name: 'Product Management',
    key: 'PROD',
    description: 'Product planning & roadmaps',
    color: '#EC4899', // pink
  },
  {
    name: 'Business Analysis',
    key: 'BA',
    description: 'Process optimization & metrics',
    color: '#06B6D4', // teal
  },
];

// Initial issues to create
const INITIAL_ISSUES = [
  {
    title: 'Set up design system repository',
    description: 'Create `storyhouse-design-system` repository with TypeScript, Storybook, and Astro documentation platform. Include foundational components, design tokens, and documentation structure.',
    teamKey: 'DSN',
    priority: 1, // High
    labels: ['feature', 'priority:high'],
  },
  {
    title: 'Implement engineering workflow',
    description: 'Document PR review process, QA integration, development standards, and GitHub workflows. Ensure all teams follow consistent engineering practices.',
    teamKey: 'DOC',
    priority: 1, // High
    labels: ['documentation', 'priority:high'],
  },
  {
    title: 'Create HR Dashboard ↔ Linear integration',
    description: 'Integrate Linear webhooks with Orange HR Dashboard. Show Linear activities in real-time, track team assignments, and display progress metrics.',
    teamKey: 'ENG',
    priority: 2, // Medium
    labels: ['feature', 'priority:medium'],
  },
  {
    title: 'Hire Business Analyst',
    description: 'Hire BA to own Linear workspace, optimize workflows, create roadmaps, track velocity, and generate stakeholder reports.',
    teamKey: 'BA',
    priority: 1, // High
    labels: ['chore', 'priority:high'],
  },
  {
    title: 'Set up QA testing framework',
    description: 'Create testing infrastructure with Jest, React Testing Library, Cypress, and automated regression suite. Define QA review process.',
    teamKey: 'QA',
    priority: 2, // Medium
    labels: ['feature', 'priority:medium'],
  },
];

async function setupLinearWorkspace() {
  console.log('🚀 Setting up Linear workspace for Orange Doorhouse Inc\n');
  
  try {
    // Test connection
    console.log('🔗 Testing Linear API connection...');
    const teams = await client.getTeams();
    console.log(`✅ Connected! Found ${teams.length} existing teams.\n`);
    
    // Create teams (if they don't exist)
    console.log('🏗️ Creating teams...');
    const existingTeamKeys = teams.map(t => t.key);
    
    for (const teamDef of TEAMS) {
      if (existingTeamKeys.includes(teamDef.key)) {
        console.log(`   ⏭️ Team ${teamDef.key} already exists`);
        continue;
      }
      
      // Note: Team creation via API requires specific permissions
      // For now, we'll just log what needs to be created
      console.log(`   📝 Team to create: ${teamDef.key} - ${teamDef.name}`);
      console.log(`      Description: ${teamDef.description}`);
      console.log(`      Color: ${teamDef.color}`);
    }
    
    console.log('\n📋 Teams need to be created manually in Linear UI:');
    console.log('   1. Go to Linear → Settings → Teams');
    console.log('   2. Create each team with the details above');
    console.log('   3. Team keys must match exactly (ENG, DSN, DOC, etc.)\n');
    
    // Get team IDs after manual creation
    console.log('🔄 Fetching team IDs (after manual creation)...');
    const updatedTeams = await client.getTeams();
    const teamMap = {};
    
    for (const team of updatedTeams) {
      teamMap[team.key] = team.id;
    }
    
    // Create initial issues
    console.log('\n🎫 Creating initial issues...');
    
    for (const issueDef of INITIAL_ISSUES) {
      const teamId = teamMap[issueDef.teamKey];
      
      if (!teamId) {
        console.log(`   ⚠️ Skipping issue: Team ${issueDef.teamKey} not found`);
        continue;
      }
      
      try {
        const result = await client.createIssue({
          title: issueDef.title,
          description: issueDef.description,
          teamId: teamId,
          priority: issueDef.priority,
          // Note: Label creation requires label IDs
          // For now, we'll create issues without labels via API
        });
        
        if (result.success) {
          console.log(`   ✅ Created: ${result.issue.identifier} - ${result.issue.title}`);
        } else {
          console.log(`   ❌ Failed to create: ${issueDef.title}`);
        }
      } catch (error) {
        console.log(`   ❌ Error creating issue "${issueDef.title}":`, error.message);
      }
    }
    
    // Create webhook for HR Dashboard
    console.log('\n🔗 Webhook setup required:');
    console.log('   1. Go to Linear → Settings → Webhooks');
    console.log('   2. Create webhook to: http://localhost:3003/webhook/linear');
    console.log('   3. Select events: Issue.created, Issue.updated, Issue.deleted');
    console.log('   4. Copy webhook secret to .env: LINEAR_WEBHOOK_SECRET=xxxxxxxx');
    
    // GitHub integration
    console.log('\n🔗 GitHub integration:');
    console.log('   1. Go to Linear → Settings → Integrations → GitHub');
    console.log('   2. Connect to GitHub repository');
    console.log('   3. Enable issue sync');
    
    console.log('\n🎉 Linear workspace setup instructions complete!');
    console.log('\n📊 Next steps:');
    console.log('   1. Complete manual team creation in Linear UI');
    console.log('   2. Run this script again to create issues');
    console.log('   3. Set up webhook for HR Dashboard integration');
    console.log('   4. Hire Business Analyst to own the workspace');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Check LINEAR_API_KEY in .env file');
    console.error('   - Ensure API key has correct permissions');
    console.error('   - Verify Linear account access');
  }
}

// Run setup
setupLinearWorkspace();