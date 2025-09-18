import { Command } from 'commander';
import { createInterface } from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import { defaultConfig } from './config.js';

const execAsync = promisify(exec);

/**
 * Get package version from package.json
 */
async function getPackageVersion() {
    try {
        // Try to get version from npm list first
        const { stdout } = await execAsync('npm list todoforai-edge-node --depth=0 --json');
        const packageInfo = JSON.parse(stdout);
        if (packageInfo.dependencies && packageInfo.dependencies['todoforai-edge-node']) {
            return packageInfo.dependencies['todoforai-edge-node'].version;
        }
    } catch (error) {
        // Fallback to reading package.json directly
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const packagePath = path.join(__dirname, '..', 'package.json');
            
            const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
            return packageJson.version;
        } catch (fallbackError) {
            return "unknown";
        }
    }
    return "unknown";
}

/**
 * Prompt for user input
 */
function promptInput(question) {
    return new Promise((resolve) => {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Create argument parser and apply configuration
 */
export async function createArgparseApplyConfig() {
    const config = defaultConfig();
    const program = new Command();
    
    program
        .name('todoforai-edge')
        .description('TODOforAI Edge CLI')
        .version(await getPackageVersion(), '-V, --version', 'Show version and exit');
    
    // Authentication arguments
    program
        .option('--api-key <key>', 'API key for authentication');
    
    // Configuration arguments
    program
        .option('--api-url <url>', 'API URL')
        .option('--debug', 'Enable debug logging');
    
    // Workspace management
    program
        .option('--add-path <path>', 'Add a workspace path to the edge configuration');
    
    program.parse();
    const args = program.opts();
    
    // Convert commander options to match Python structure
    const processedArgs = {
        apiKey: args.apiKey,
        apiUrl: args.apiUrl,
        debug: args.debug,
        addWorkspacePath: args.addPath
    };
    
    config.updateFromArgs(processedArgs);
    
    // Print server info early, before requesting credentials
    console.log(`Connecting to: ${config.apiUrl}`);
    
    // Interactive credential prompt if not provided and no existing value
    if (!config.apiKey) {
        try {
            config.apiKey = await promptInput("API Key: ");
        } catch (error) {
            console.log("\nOperation cancelled.");
            process.exit(1);
        }
    }
    
    if (config.apiKey) {
        console.log(`Using API key: ${config.apiKey.slice(0, 8)}...`);
    }
    
    return config;
}