/**
 * Agent Mapping Service - Fixed version
 * Maps Linear assignee names to OpenClaw agent IDs
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AgentMapping {
  linearAssignee: string;
  openclawAgentId: string;
  role: string;
  workspacePath?: string;
}

interface ActivationLog {
  activationId: string;
  agentId: string;
  linearIssue?: string;
  status: string;
  timestamp: string;
  exitCode?: number;
  signal?: string;
  stderr?: string;
  completedAt?: string;
}

// Activation logging function
function logActivation(activationId: string, data: Partial<ActivationLog>) {
  try {
    const logDir = '/tmp/agent-activations';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, 'activations.log');
    const logEntry = {
      activationId,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('Failed to log activation:', error);
  }
}

// Primary mapping: Linear assignee name → OpenClaw agent ID with workspace and repo info
const AGENT_CONFIGS: Record<string, { agentId: string; workspacePath: string; repoUrl: string; role: string }> = {
  'Business Analyst Platform': {
    agentId: 'ba-platform',
    workspacePath: '/Users/openclaw/projects/storyhouse-main',
    repoUrl: 'https://github.com/nimphiusBot/storyhouse-main.git',
    role: 'Business Analyst'
  },
  'Design System Platform Engineer': {
    agentId: 'design-system-engineer',
    workspacePath: '/Users/openclaw/projects/storyhouse-design-system',
    repoUrl: 'https://github.com/nimphiusBot/storyhouse-design-system.git',
    role: 'Design System Engineer'
  },
  'Documentation Specialist': {
    agentId: 'documentation-specialist',
    workspacePath: '/Users/openclaw/projects/storyhouse-main',
    repoUrl: 'https://github.com/nimphiusBot/storyhouse-main.git',
    role: 'Documentation Specialist'
  },
  'Head Engineer': {
    agentId: 'main',
    workspacePath: '/Users/openclaw/.openclaw/workspace',
    repoUrl: 'https://github.com/nimphiusBot/storyhouse-claw.git',
    role: 'Orange AI'
  },
  'QA Expert': {
    agentId: 'qa-expert',
    workspacePath: '/Users/openclaw/projects/storyhouse-main',
    repoUrl: 'https://github.com/nimphiusBot/storyhouse-main.git',
    role: 'QA Expert'
  },
  'Video Generation Assistant': {
    agentId: 'video-assistant',
    workspacePath: '/Users/openclaw/projects/storyhouse-main',
    repoUrl: 'https://github.com/nimphiusBot/storyhouse-main.git',
    role: 'Video Generation Assistant'
  },
  'Test AI Engineer': {
    agentId: 'test-ai-engineer',
    workspacePath: '/Users/openclaw/projects/storyhouse-main',
    repoUrl: 'https://github.com/nimphiusBot/storyhouse-main.git',
    role: 'Test AI Engineer'
  },
  
  // Aliases for flexibility
  'Business Analyst': {
    agentId: 'ba-platform',
    workspacePath: '/Users/openclaw/projects/storyhouse-main',
    repoUrl: 'https://github.com/nimphiusBot/storyhouse-main.git',
    role: 'Business Analyst'
  },
  'Design System Engineer': {
    agentId: 'design-system-engineer',
    workspacePath: '/Users/openclaw/projects/storyhouse-design-system',
    repoUrl: 'https://github.com/nimphiusBot/storyhouse-design-system.git',
    role: 'Design System Engineer'
  },
  'QA': {
    agentId: 'qa-expert',
    workspacePath: '/Users/openclaw/projects/storyhouse-main',
    repoUrl: 'https://github.com/nimphiusBot/storyhouse-main.git',
    role: 'QA Expert'
  },
};

// Derive the simple mapping from AGENT_CONFIGS for backward compat
const LINEAR_TO_AGENT_MAPPING: Record<string, string> = {};
for (const [name, config] of Object.entries(AGENT_CONFIGS)) {
  LINEAR_TO_AGENT_MAPPING[name] = config.agentId;
}

// Fallback mapping for common role patterns
const ROLE_PATTERN_MAPPING: Record<string, string> = {
  'business.*analyst': 'ba-platform',
  'design.*system': 'design-system-engineer',
  'documentation': 'documentation-specialist',
  'qa.*expert': 'qa-expert',
  'video.*assistant': 'video-assistant',
  'head.*engineer': 'main',
  'test.*engineer': 'test-ai-engineer',
};

/**
 * Get OpenClaw agent ID from Linear assignee name
 */
export function getAgentIdFromLinearAssignee(assigneeName: string): string | null {
  if (!assigneeName) return null;
  
  // 1. Direct mapping
  const directMatch = LINEAR_TO_AGENT_MAPPING[assigneeName];
  if (directMatch) {
    console.log(`🎯 Direct agent mapping: "${assigneeName}" → "${directMatch}"`);
    return directMatch;
  }
  
  // 2. Case-insensitive search
  const lowerAssignee = assigneeName.toLowerCase();
  for (const [key, value] of Object.entries(LINEAR_TO_AGENT_MAPPING)) {
    if (key.toLowerCase() === lowerAssignee) {
      console.log(`🎯 Case-insensitive mapping: "${assigneeName}" → "${value}"`);
      return value;
    }
  }
  
  // 3. Pattern matching
  for (const [pattern, agentId] of Object.entries(ROLE_PATTERN_MAPPING)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(assigneeName)) {
      console.log(`🎯 Pattern mapping: "${assigneeName}" (matches ${pattern}) → "${agentId}"`);
      return agentId;
    }
  }
  
  // 4. Fallback: convert to kebab-case
  const fallbackId = assigneeName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
  
  console.log(`🎯 Fallback mapping: "${assigneeName}" → "${fallbackId}"`);
  return fallbackId;
}

/**
 * Get all available mappings for UI display
 */
export function getAllAgentMappings(): AgentMapping[] {
  return Object.entries(LINEAR_TO_AGENT_MAPPING).map(([linearAssignee, openclawAgentId]) => ({
    linearAssignee,
    openclawAgentId,
    role: linearAssignee,
  }));
}

/**
 * Validate if an agent ID exists in OpenClaw system
 */
export function validateAgentExists(agentId: string): boolean {
  try {
    const { execSync } = require('child_process');
    // Quick check if agent appears in list
    const output = execSync(`openclaw agents list 2>/dev/null | grep -c "${agentId}"`, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return parseInt(output.trim()) > 0;
  } catch (error) {
    console.warn(`⚠️ Could not validate agent ${agentId}:`, error.message);
    return false; // Return false on error — no assumptions
  }
}

/**
 * Start agent with Linear issue context - FIXED VERSION
 */
export function startAgentWithLinearIssue(agentId: string, issue: any): { success: boolean; activationId?: string } {
  // Define message outside try-catch so it's accessible in both
  const issueIdentifier = issue.identifier || issue.id || 'Unknown';
  const issueTitle = issue.title || 'No title';
  const issueDescription = issue.description || 'No description';
  
  // Look up agent config for repo URL and workspace
  const agentConfig = Object.values(AGENT_CONFIGS).find(c => c.agentId === agentId);
  const repoUrl = agentConfig?.repoUrl || 'https://github.com/nimphiusBot/storyhouse-main.git';
  const workspacePath = agentConfig?.workspacePath || '/Users/openclaw/projects/' + agentId;
  
  const message = `Linear Issue ${issueIdentifier}: ${issueTitle}\n\n${issueDescription}\n\nPriority: ${issue.priorityLabel || 'Normal'}\nStatus: Approved by Nimphius\n\nRepository: ${repoUrl}\nWorkspace: ${workspacePath}\n\nGITHUB_TOKEN is available for git operations.\nClone the repo, make changes, commit, and push.\n\nPlease begin work on this issue.`;
  
  try {
    const { execSync } = require('child_process');
    
    console.log(`🚀 Starting agent ${agentId} for Linear issue ${issueIdentifier}`);
    
    // Generate activation ID for tracking
    const activationId = `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Log activation start
    console.log(`📝 Activation ${activationId}: Starting agent ${agentId}`);
    logActivation(activationId, {
      agentId,
      linearIssue: issueIdentifier,
      status: 'starting',
      timestamp: new Date().toISOString()
    });
    
    // Use spawn instead of execSync to avoid blocking
    const { spawn } = require('child_process');
    
    // Pass GitHub token if available (no fallback — omit if not set)
    const env = { ...process.env }
    if (process.env.GITHUB_TOKEN) {
      env.GITHUB_TOKEN = process.env.GITHUB_TOKEN
      env.GH_TOKEN = process.env.GITHUB_TOKEN
    }
    if (process.env.GH_TOKEN) {
      env.GH_TOKEN = process.env.GH_TOKEN
      if (!env.GITHUB_TOKEN) env.GITHUB_TOKEN = process.env.GH_TOKEN
    }
    
    // Try with --deliver --channel telegram first
    const child = spawn('openclaw', [
      'agent',
      '--agent', agentId,
      '--message', message,
      '--deliver',
      '--channel', 'telegram'
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env
    });
    
    // Track process completion
    child.on('exit', (code, signal) => {
      const status = code === 0 ? 'success' : 'failed';
      console.log(`📝 Activation ${activationId}: Agent ${agentId} ${status} (code: ${code}, signal: ${signal})`);
      logActivation(activationId, {
        status,
        exitCode: code,
        signal,
        completedAt: new Date().toISOString()
      });
    });
    
    // Capture stderr for error logging
    child.stderr.on('data', (data) => {
      const errorOutput = data.toString().trim();
      if (errorOutput) {
        console.error(`📝 Activation ${activationId} stderr:`, errorOutput);
        logActivation(activationId, {
          stderr: errorOutput
        });
      }
    });
    
    // Don't wait for completion - just start it
    child.unref();
    
    console.log(`✅ Agent ${agentId} started (activation: ${activationId})`);
    return { success: true, activationId };
  } catch (error: any) {
    console.error(`❌ Failed to start agent ${agentId} with delivery:`, error.message);
    
    // Try fallback with --local flag (also non-blocking)
    try {
      console.log(`🔄 Trying fallback with --local flag...`);
      const { spawn } = require('child_process');
      
      const child = spawn('openclaw', [
        'agent',
        '--agent', agentId,
        '--message', message,
        '--local'
      ], {
        stdio: 'pipe',
        detached: true,
        env
      });
      
      child.unref();
      console.log(`✅ Agent ${agentId} started with --local flag (non-blocking)`);
      return { success: true, activationId: `local-${Date.now()}` };
    } catch (localError: any) {
      console.error(`❌ Failed with --local flag too:`, localError.message);
      return { success: false };
    }
  }
}