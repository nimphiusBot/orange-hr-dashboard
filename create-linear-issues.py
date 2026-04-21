#!/usr/bin/env python3

import json
import requests
import time
import os
from dotenv import load_dotenv

load_dotenv()

LINEAR_API_KEY = os.getenv('LINEAR_API_KEY', 'lin_api_JdwKnABcckFSZR54HYbBBI9AVTxwLoZt8rF2kvgB')
LINEAR_API_URL = 'https://api.linear.app/graphql'

headers = {
    'Content-Type': 'application/json',
    'Authorization': LINEAR_API_KEY,
}

def graphql_query(query, variables=None):
    payload = {'query': query}
    if variables:
        payload['variables'] = variables
    
    response = requests.post(LINEAR_API_URL, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()

def get_team_id():
    """Get the ORA team ID"""
    query = """
    query {
      teams {
        nodes {
          id
          key
          name
        }
      }
    }
    """
    
    data = graphql_query(query)
    teams = data['data']['teams']['nodes']
    
    for team in teams:
        if team['key'] == 'ORA':
            return team['id']
    
    return teams[0]['id'] if teams else None

def get_state_id(state_name='Todo'):
    """Get state ID by name"""
    query = """
    query {
      workflowStates {
        nodes {
          id
          name
        }
      }
    }
    """
    
    data = graphql_query(query)
    states = data['data']['workflowStates']['nodes']
    
    for state in states:
        if state['name'] == state_name:
            return state['id']
    
    # Default to first state if not found
    return states[0]['id'] if states else None

def create_issue(title, description, team_id, state_id, priority=2):
    """Create a Linear issue"""
    mutation = """
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
    """
    
    variables = {
        'input': {
            'title': title,
            'description': description,
            'teamId': team_id,
            'stateId': state_id,
            'priority': priority,
        }
    }
    
    data = graphql_query(mutation, variables)
    return data['data']['issueCreate']

def main():
    print('🚀 Creating foundational issues for Orange Doorhouse Inc\n')
    
    try:
        # Get IDs
        team_id = get_team_id()
        state_id = get_state_id('Todo')
        
        print(f'📋 Using Team: ORA (ID: {team_id[:8]}...)')
        print(f'📋 Using State: Todo (ID: {state_id[:8]}...)\n')
        
        # Foundational issues
        issues = [
            {
                'title': 'Set up design system repository',
                'description': 'Create `storyhouse-design-system` repository with TypeScript, Storybook, and Astro documentation platform. Include foundational components, design tokens, and documentation structure.',
                'priority': 1,  # High
            },
            {
                'title': 'Implement engineering workflow',
                'description': 'Document PR review process, QA integration, development standards, and GitHub workflows. Ensure all teams follow consistent engineering practices.',
                'priority': 1,  # High
            },
            {
                'title': 'Create HR Dashboard ↔ Linear integration',
                'description': 'Integrate Linear webhooks with Orange HR Dashboard. Show Linear activities in real-time, track team assignments, and display progress metrics.',
                'priority': 2,  # Medium
            },
            {
                'title': 'Hire Business Analyst',
                'description': 'Hire BA to own Linear workspace, optimize workflows, create roadmaps, track velocity, and generate stakeholder reports.',
                'priority': 1,  # High
            },
            {
                'title': 'Set up QA testing framework',
                'description': 'Create testing infrastructure with Jest, React Testing Library, Cypress, and automated regression suite. Define QA review process.',
                'priority': 2,  # Medium
            },
        ]
        
        created_count = 0
        
        for i, issue_def in enumerate(issues, start=1):
            print(f'🎫 Creating issue {i}/5: {issue_def["title"]}')
            
            result = create_issue(
                title=issue_def['title'],
                description=issue_def['description'],
                team_id=team_id,
                state_id=state_id,
                priority=issue_def['priority']
            )
            
            if result['success']:
                issue = result['issue']
                print(f'   ✅ Created: {issue["identifier"]} - {issue["title"]}')
                created_count += 1
            else:
                print(f'   ❌ Failed to create issue')
            
            # Small delay to avoid rate limiting
            time.sleep(1)
        
        print(f'\n📊 Created {created_count}/5 foundational issues.')
        
        # Webhook setup instructions
        print('\n🔗 Next steps:')
        print('   1. Create webhook in Linear → Settings → Webhooks')
        print('   2. URL: http://localhost:3003/webhook/linear')
        print('   3. Events: Issue.created, Issue.updated, Issue.deleted')
        print('   4. Add secret to .env: LINEAR_WEBHOOK_SECRET=xxxxxxxx')
        
        print('\n🎉 Linear workspace setup complete!')
        
    except Exception as e:
        print(f'❌ Error: {e}')
        print('\n🔧 Troubleshooting:')
        print('   - Check LINEAR_API_KEY in .env file')
        print('   - Verify API key permissions')
        print('   - Check network connection')

if __name__ == '__main__':
    main()