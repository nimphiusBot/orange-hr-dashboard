import 'dotenv/config';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_API_URL = 'https://api.linear.app/graphql';

if (!LINEAR_API_KEY) {
  console.warn('⚠️ LINEAR_API_KEY not set in .env file');
  console.warn('Get API key from Linear → Settings → API');
}

// GraphQL queries for Linear API
const LINEAR_QUERIES = {
  // Get all issues
  GET_ISSUES: `
    query GetIssues($first: Int = 50) {
      issues(first: $first) {
        nodes {
          id
          identifier
          title
          description
          state {
            name
            type
          }
          priority
          estimate
          labels {
            nodes {
              name
              color
            }
          }
          assignee {
            id
            name
            displayName
            avatarUrl
          }
          team {
            id
            name
            key
          }
          createdAt
          updatedAt
        }
      }
    }
  `,

  // Get teams
  GET_TEAMS: `
    query GetTeams {
      teams {
        nodes {
          id
          name
          key
          description
        }
      }
    }
  `,

  // Create issue
  CREATE_ISSUE: `
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
  `,

  // Update issue
  UPDATE_ISSUE: `
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
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
  `,
};

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: {
    name: string;
    type: string;
  };
  priority: number;
  estimate?: number;
  labels: Array<{
    name: string;
    color: string;
  }>;
  assignee?: {
    id: string;
    name: string;
    displayName: string;
    avatarUrl?: string;
  };
  team: {
    id: string;
    name: string;
    key: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
}

export class LinearClient {
  private apiKey: string;
  private headers: Record<string, string>;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || LINEAR_API_KEY || '';
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': this.apiKey, // Linear API keys don't use 'Bearer' prefix
    };
  }

  async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Linear API key not configured');
    }

    const response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`Linear GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  // Get all issues
  async getIssues(limit: number = 50): Promise<LinearIssue[]> {
    const data = await this.query<{ issues: { nodes: LinearIssue[] } }>(
      LINEAR_QUERIES.GET_ISSUES,
      { first: limit }
    );
    return data.issues.nodes;
  }

  // Get teams
  async getTeams(): Promise<LinearTeam[]> {
    const data = await this.query<{ teams: { nodes: LinearTeam[] } }>(
      LINEAR_QUERIES.GET_TEAMS
    );
    return data.teams.nodes;
  }

  // Create issue
  async createIssue(input: {
    title: string;
    description?: string;
    teamId: string;
    assigneeId?: string;
    priority?: number;
    stateId?: string;
    labelIds?: string[];
  }) {
    const data = await this.query<{ issueCreate: any }>(
      LINEAR_QUERIES.CREATE_ISSUE,
      { input }
    );
    return data.issueCreate;
  }

  // Update issue
  async updateIssue(id: string, input: {
    title?: string;
    description?: string;
    stateId?: string;
    assigneeId?: string;
    priority?: number;
  }) {
    const data = await this.query<{ issueUpdate: any }>(
      LINEAR_QUERIES.UPDATE_ISSUE,
      { id, input }
    );
    return data.issueUpdate;
  }

  // Get issues assigned to a specific user
  async getIssuesByAssignee(assigneeId: string): Promise<LinearIssue[]> {
    const allIssues = await this.getIssues(100);
    return allIssues.filter(issue => issue.assignee?.id === assigneeId);
  }

  // Get issues by team
  async getIssuesByTeam(teamKey: string): Promise<LinearIssue[]> {
    const allIssues = await this.getIssues(100);
    return allIssues.filter(issue => issue.team.key === teamKey);
  }
}

// Singleton instance
export const linearClient = new LinearClient();

// Helper function to format Linear issue for HR Dashboard
export function formatLinearIssueForDashboard(issue: LinearIssue): any {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description || '',
    status: issue.state.name,
    priority: issue.priority,
    assignee: issue.assignee ? {
      name: issue.assignee.displayName || issue.assignee.name,
      avatar: issue.assignee.avatarUrl,
    } : null,
    team: issue.team.name,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    labels: issue.labels.map(label => label.name),
  };
}

// Test the connection (if API key is available)
export async function testLinearConnection(): Promise<boolean> {
  if (!LINEAR_API_KEY) {
    console.log('⚠️ Skipping Linear connection test - no API key');
    return false;
  }

  try {
    const client = new LinearClient();
    const teams = await client.getTeams();
    console.log(`✅ Linear connection successful. Found ${teams.length} teams.`);
    return true;
  } catch (error) {
    console.error('❌ Linear connection failed:', error.message);
    return false;
  }
}