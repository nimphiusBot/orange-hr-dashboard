#!/bin/bash

LINEAR_API_KEY="lin_api_JdwKnABcckFSZR54HYbBBI9AVTxwLoZt8rF2kvgB"
TEAM_ID="38de7b4b-6040-4200-b904-08a5098acd6a"

# Get the Todo state ID
STATE_ID=$(curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query": "{ workflowStates(filter: { name: { eq: \"Todo\" } }) { nodes { id } } }"}' | \
  jq -r '.data.workflowStates.nodes[0].id')

echo "Team ID: $TEAM_ID"
echo "Todo State ID: $STATE_ID"
echo ""

# Foundational issues
ISSUES=(
  '{"title": "Set up design system repository", "description": "Create `storyhouse-design-system` repository with TypeScript, Storybook, and Astro documentation platform. Include foundational components, design tokens, and documentation structure.", "priority": 1}'
  '{"title": "Implement engineering workflow", "description": "Document PR review process, QA integration, development standards, and GitHub workflows. Ensure all teams follow consistent engineering practices.", "priority": 1}'
  '{"title": "Create HR Dashboard ↔ Linear integration", "description": "Integrate Linear webhooks with Orange HR Dashboard. Show Linear activities in real-time, track team assignments, and display progress metrics.", "priority": 2}'
  '{"title": "Hire Business Analyst", "description": "Hire BA to own Linear workspace, optimize workflows, create roadmaps, track velocity, and generate stakeholder reports.", "priority": 1}'
  '{"title": "Set up QA testing framework", "description": "Create testing infrastructure with Jest, React Testing Library, Cypress, and automated regression suite. Define QA review process.", "priority": 2}'
)

for i in "${!ISSUES[@]}"; do
  ISSUE_JSON="${ISSUES[$i]}"
  
  echo "Creating issue $((i+6))..."
  
  RESULT=$(curl -s -X POST https://api.linear.app/graphql \
    -H "Content-Type: application/json" \
    -H "Authorization: $LINEAR_API_KEY" \
    -d "{\"query\": \"mutation { issueCreate(input: { title: $(echo $ISSUE_JSON | jq '.title'), description: $(echo $ISSUE_JSON | jq '.description'), teamId: \\\"$TEAM_ID\\\", stateId: \\\"$STATE_ID\\\", priority: $(echo $ISSUE_JSON | jq '.priority') }) { success issue { identifier title } } }\"}")
  
  IDENTIFIER=$(echo $RESULT | jq -r '.data.issueCreate.issue.identifier')
  TITLE=$(echo $RESULT | jq -r '.data.issueCreate.issue.title')
  
  if [ "$IDENTIFIER" != "null" ]; then
    echo "  ✅ Created: $IDENTIFIER - $TITLE"
  else
    echo "  ❌ Failed to create issue"
    echo "  Response: $RESULT"
  fi
  
  sleep 1
done

echo ""
echo "🎉 Foundational issues created!"
