const { simpleGit } = require('simple-git');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { log } = require('console');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CONFIG_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.git-chatbot-config.json');

class GitHubChatbotCLI {
    constructor() {
        this.currentRepoPath = null;
        this.git = null;
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            }
        } catch (e) {
            // Ignore errors, return empty config
        }
        return {};
    }

    saveConfig() {
        try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf8');
            return true;
        } catch (e) {
            return false;
        }
    }

    getOpenAIKey() {
        return this.config.openaiApiKey || process.env.OPENAI_API_KEY;
    }

    setOpenAIKey(key) {
        this.config.openaiApiKey = key;
        return this.saveConfig();
    }

    async parseGitHubUrl(url) {
        const patterns = [
            /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/,
            /^([^\/]+)\/([^\/]+)$/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return { owner: match[1], repo: match[2] };
            }
        }
        return null;
    }

    async cloneRepository(url, targetDir) {
        try {
            const parsed = await this.parseGitHubUrl(url);
            if (!parsed) {
                this.printError('Invalid GitHub URL format');
                return false;
            }

            const repoPath = path.join(targetDir, parsed.repo);
            
            if (fs.existsSync(repoPath)) {
                this.printInfo(`Repository already exists at ${repoPath}`);
                this.currentRepoPath = repoPath;
                this.setupGit(repoPath);
                return true;
            }

            this.printInfo(`Cloning ${parsed.owner}/${parsed.repo}...`);
            await simpleGit().clone(url, repoPath);
            
            this.currentRepoPath = repoPath;
            this.setupGit(repoPath);
            
            this.printSuccess(`Successfully cloned to ${repoPath}`);
            return true;
        } catch (error) {
            this.printError(`Error cloning repository: ${error.message}`);
            return false;
        }
    }

    setupGit(repoPath) {
        this.git = simpleGit(repoPath);
    }

    async readFile(filePath) {
        try {
            const fullPath = path.join(this.currentRepoPath, filePath);
            return fs.readFileSync(fullPath, 'utf-8');
        } catch (error) {
            throw new Error(`Error reading file: ${error.message}`);
        }
    }

    async writeFile(filePath, content) {
        try {
            const fullPath = path.join(this.currentRepoPath, filePath);
            const dir = path.dirname(fullPath);
            
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(fullPath, content, 'utf-8');
            return true;
        } catch (error) {
            throw new Error(`Error writing file: ${error.message}`);
        }
    }

    async getGitStatus() {
        try {
            if (!this.git) throw new Error('No git repository initialized');
            return await this.git.status();
        } catch (error) {
            throw new Error(`Error getting git status: ${error.message}`);
        }
    }

    async gitCommit(message) {
        try {
            if (!this.git) throw new Error('No git repository initialized');
            await this.git.add('.');
            return await this.git.commit(message);
        } catch (error) {
            throw new Error(`Error committing: ${error.message}`);
        }
    }

    async searchFiles(query) {
        const results = [];
        const searchDir = (dirPath) => {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                if (item.startsWith('.') && item !== '.git') continue;
                
                const fullPath = path.join(dirPath, item);
                const stats = fs.statSync(fullPath);
                
                if (stats.isDirectory() && item !== 'node_modules' && item !== '.git') {
                    searchDir(fullPath);
                } else if (stats.isFile()) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf-8');
                        const lines = content.split('\n');
                        
                        lines.forEach((line, index) => {
                            if (line.toLowerCase().includes(query.toLowerCase())) {
                                results.push({
                                    file: path.relative(this.currentRepoPath, fullPath),
                                    line: index + 1,
                                    content: line.trim()
                                });
                            }
                        });
                    } catch (e) {
                        // Skip binary files
                    }
                }
            }
        };
        
        searchDir(this.currentRepoPath);
        return results;
    }

    async getProjectStructure() {
        const getTree = (dirPath, relativePath = '') => {
            const items = fs.readdirSync(dirPath);
            const tree = [];
            
            for (const item of items) {
                if (item.startsWith('.') && item !== '.git') continue;
                
                const fullPath = path.join(dirPath, item);
                const relPath = path.join(relativePath, item);
                const stats = fs.statSync(fullPath);
                
                if (stats.isDirectory()) {
                    tree.push({
                        name: item,
                        type: 'directory',
                        path: relPath,
                        children: getTree(fullPath, relPath)
                    });
                } else {
                    tree.push({
                        name: item,
                        type: 'file',
                        path: relPath,
                        extension: path.extname(item).slice(1)
                    });
                }
            }
            
            return tree.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'directory' ? -1 : 1;
            });
        };
        
        const tree = getTree(this.currentRepoPath);
        return this.formatTree(tree, 0);
    }

    formatTree(items, level) {
        let output = '';
        items.forEach(item => {
            const indent = '  '.repeat(level);
            output += indent + (item.type === 'directory' ? '[📁] ' : '[📄] ') + item.name + '\n';
            if (item.children) {
                output += this.formatTree(item.children, level + 1);
            }
        });
        return output;
    }

    async searchFilesDisplay(query) {
        const results = await this.searchFiles(query);
        if (results.length === 0) {
            return `No matches found for "${query}"`;
        }
        
        let output = `Found ${results.length} matches:\n\n`;
        results.slice(0, 20).forEach(r => {
            output += `📄 ${r.file}:${r.line}\n${r.content}\n\n`;
        });
        
        return output;
    }

    async processWithAI(message) {
        const apiKey = this.getOpenAIKey();
        if (!apiKey) {
            return "Please configure your OpenAI API key first using the 'setup' command.\nGet one from https://platform.openai.com/api-keys";
        }
        
        if (!this.currentRepoPath) {
            return "Please clone a repository first to start chatting about the code.";
        }
        
        // Get lightweight context - just README and main files
        let context = '';
        try {
            const readmeContent = await this.readFile('README.md');
            context += 'README.md:\n' + readmeContent.slice(0, 1500) + '\n\n';
        } catch (e) {
            // No README, that's ok
        }
        
        try {
            // Try common main files
            const mainFiles = ['index.js', 'main.js', 'app.js', 'index.ts', 'main.ts'];
            for (const file of mainFiles) {
                try {
                    const content = await this.readFile(file);
                    context += `Main File (${file}):\n` + content.slice(0, 1000) + '\n\n';
                    break;
                } catch (e) {
                    // Try next file
                }
            }
        } catch (e2) {
            // No main file found, that's ok
        }

        const systemPrompt = `You are a helpful AI coding assistant. You have access to a cloned GitHub repository. 
You can help users understand code, make suggestions, and answer questions.

Repository: ${path.basename(this.currentRepoPath)}

Be concise and helpful. Only show relevant code snippets.`;

        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message + '\n\nContext:\n' + context }
                ],
                temperature: 0.7,
                max_tokens: 1500
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            return `Error: ${error.response?.data?.error?.message || error.message}. Please check your API key and try again.`;
        }
    }

    printSuccess(message) {
        console.log(`\x1b[32m✅ ${message}\x1b[0m`);
    }

    printError(message) {
        console.log(`\x1b[31m❌ ${message}\x1b[0m`);
    }

    printInfo(message) {
        console.log(`\x1b[34mℹ️  ${message}\x1b[0m`);
    }

    printWarning(message) {
        console.log(`\x1b[33m⚠️  ${message}\x1b[0m`);
    }

    async setupAPIKey() {
        console.log('\n🔑 OpenAI API Key Setup');
        console.log('=====================');
        console.log('Get your API key from: https://platform.openai.com/api-keys\n');
        
        const answer = await new Promise((resolve) => {
            const stdin = process.openStdin();
            process.stdout.write('Enter your OpenAI API key: ');
            stdin.addListener("data", (data) => {
                resolve(data.toString().trim());
            });
        });
        
        if (!answer) {
            this.printError('API key cannot be empty');
            return false;
        }
        
        if (!answer.startsWith('sk-')) {
            this.printWarning('API key should start with "sk-" - are you sure this is correct?');
        }
        
        if (this.setOpenAIKey(answer)) {
            this.printSuccess('API key saved successfully!');
            return true;
        } else {
            this.printError('Failed to save API key');
            return false;
        }
    }

    async showHelp() {
        console.log(`
🤖 GitHub Chatbot CLI

Usage:
  node index.js [command]

Commands:
  clone <url>    Clone a GitHub repository
  ls             List repository structure
  read <file>    Read a file content
  search <term>  Search for text in repository
  ask <question> Ask AI about the code
  status         Show git status
  commit <msg>   Commit changes with message
  setup          Configure OpenAI API key
  config         Show current configuration
  help           Show this help
  exit           Quit the application

Examples:
  node index.js clone https://github.com/octocat/Hello-World
  node index.js ls
  node index.js read src/index.js
  node index.js search "function"
  node index.js ask "What does this project do?"
        `);
    }

    async showConfig() {
        console.log(`
⚙️  Current Configuration:
=========================
OpenAI API Key: ${this.getOpenAIKey() ? '✅ Configured' : '❌ Not set'}
Config File: ${CONFIG_FILE}
Current Repository: ${this.currentRepoPath || 'None'}
        `);
    }
}

async function main() {
    const bot = new GitHubChatbotCLI();
    
    // Clear screen and show header
    console.clear();
    console.log(`\x1b[36m
    ███╗   ███╗ █████╗ ███╗   ██╗███████╗██████╗ ███████╗
    ████╗ ████║██╔══██╗████╗  ██║██╔════╝██╔══██╗██╔════╝
    ██╔████╔██║███████║██╔██╗ ██║█████╗  ██████╔╝███████╗
    ██║╚██╔╝██║██╔══██║██║╚██╗██║██╔══╝  ██╔══██╗╚════██║
    ██║ ╚═╝ ██║██║  ██║██║ ╚████║███████╗██║  ██║███████║
    ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚══════╝
    \x1b[0m`);
    console.log('🤖 GitHub Chatbot CLI');
    console.log('====================');
    
    // Show initial status
    if (!bot.getOpenAIKey()) {
        bot.printWarning('OpenAI API key not configured. Use "setup" command to configure AI features.');
    }
    
    console.log('Type "help" for available commands\n');
    
    while (true) {
        try {
            const input = await new Promise((resolve) => {
                const stdin = process.openStdin();
                stdin.addListener("data", (data) => {
                    resolve(data.toString().trim());
                });
            });
            
            if (!input) continue;
            
            const [command, ...args] = input.split(/\s+/);
            
            switch (command) {
                case 'clone':
                    if (!args[0]) {
                        bot.printError('Please provide a GitHub URL');
                        break;
                    }
                    const directory = await new Promise((resolve) => {
                        process.stdout.write('Enter clone directory (default: current): ');
                        const stdin = process.openStdin();
                        stdin.addListener("data", (data) => {
                            const dir = data.toString().trim() || process.cwd();
                            resolve(dir);
                        });
                    });
                    await bot.cloneRepository(args[0], directory);
                    break;
                    
                case 'ls':
                    if (!bot.currentRepoPath) {
                        bot.printError('No repository cloned. Use "clone" first.');
                        break;
                    }
                    const structure = await bot.getProjectStructure();
                    console.log(`\n📁 Repository Structure:\n${structure}`);
                    break;
                    
                case 'read':
                    if (!args[0]) {
                        bot.printError('Please provide a file path');
                        break;
                    }
                    if (!bot.currentRepoPath) {
                        bot.printError('No repository cloned. Use "clone" first.');
                        break;
                    }
                    try {
                        const content = await bot.readFile(args[0]);
                        console.log(`\n📄 ${args[0]}:\n${content}`);
                    } catch (error) {
                        bot.printError(error.message);
                    }
                    break;
                    
                case 'search':
                    if (!args[0]) {
                        bot.printError('Please provide a search term');
                        break;
                    }
                    if (!bot.currentRepoPath) {
                        bot.printError('No repository cloned. Use "clone" first.');
                        break;
                    }
                    const results = await bot.searchFilesDisplay(args.join(' '));
                    console.log(`\n🔍 Search Results:\n${results}`);
                    break;
                    
                case 'ask':
                    if (!args[0]) {
                        bot.printError('Please provide a question');
                        break;
                    }
                    if (!bot.currentRepoPath) {
                        bot.printError('No repository cloned. Use "clone" first.');
                        break;
                    }
                    if (!bot.getOpenAIKey()) {
                        bot.printError('Please configure OpenAI API key first using "setup" command');
                        break;
                    }
                    bot.printInfo('Thinking...');
                    const response = await bot.processWithAI(args.join(' '));
                    console.log(`\n🤖 AI Response:\n${response}\n`);
                    break;
                    
                case 'status':
                    if (!bot.currentRepoPath) {
                        bot.printError('No repository cloned. Use "clone" first.');
                        break;
                    }
                    try {
                        const status = await bot.getGitStatus();
                        console.log(`\n📊 Git Status:\n${JSON.stringify(status, null, 2)}`);
                    } catch (error) {
                        bot.printError(error.message);
                    }
                    break;
                    
                case 'commit':
                    if (!args[0]) {
                        bot.printError('Please provide a commit message');
                        break;
                    }
                    if (!bot.currentRepoPath) {
                        bot.printError('No repository cloned. Use "clone" first.');
                        break;
                    }
                    try {
                        await bot.gitCommit(args.join(' '));
                        bot.printSuccess('Changes committed successfully');
                    } catch (error) {
                        bot.printError(error.message);
                    }
                    break;
                    
                case 'setup':
                    await bot.setupAPIKey();
                    break;
                    
                case 'config':
                    await bot.showConfig();
                    break;
                    
                case 'help':
                    await bot.showHelp();
                    break;
                    
                case 'exit':
                case 'quit':
                    bot.printSuccess('Goodbye!');
                    return;
                    
                default:
                    bot.printError(`Unknown command: ${command}. Type "help" for available commands.`);
            }
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                bot.printSuccess('Goodbye!');
                return;
            }
            bot.printError(`Error: ${error.message}`);
        }
    }
}

main().catch(console.error);