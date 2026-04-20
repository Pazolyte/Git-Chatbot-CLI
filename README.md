# Git-Chatbot - Portable Version

An AI-powered CLI tool that clones GitHub repositories and allows you to interact with them using natural language commands.

## ⚡ Quick Start (Under 30 Seconds)

1. **Extract this folder** to your desired location
2. **Open terminal/command prompt** in the `git-chatbot-cli` directory
3. **Run the setup commands**:
   ```bash
   npm install
   node index.js setup
   ```
   (Enter your OpenAI API key when prompted)
4. **Start using**:
   ```bash
   node index.js
   ```

## 📁 What's Included (Only Essential Files)

This portable version contains only the source code and configuration:
- `index.js` - Main application logic (~20KB)
- `package.json` - Dependencies list (~0.4KB)  
- `README.md` - Usage instructions (~4KB)
- `.env.example` - Configuration template (~0.3KB)
- `.gitignore` - Prevents uploading unnecessary files (~1.5KB)

**Total**: ~25KB of source code (vs ~250MB+ in node_modules)

## 🔧 How It Works

Instead of bundling hundreds of dependency files, this version:
1. Lists required dependencies in `package.json`
2. Uses `npm install` to download them locally when you first run it
3. Stores your OpenAI API key securely for future sessions
4. Only downloads what you actually need

## 🚀 Usage Examples

```bash
# Clone a repository
> clone https://github.com/microsoft/vscode

# Explore the structure
> ls

# Read a file
> read README.md

# Ask AI questions
> ask "What programming languages is this primarily written in?"

# Search for text
> search "TypeScript"

# Check git status
> status

# Commit changes
> commit "Fixed typo in documentation"
```

## 💡 Why This Approach?

- **Fast Upload**: Only ~25KB to upload to GitHub (instead of 250MB+)
- **Always Updated**: Gets latest dependency versions on install
- **Secure**: No risk of including sensitive node_modules data
- **Portable**: Works on any machine with Node.js installed
- **Transparent**: You control exactly what gets installed

## 📋 Requirements

- **Node.js** (v14 or higher) - https://nodejs.org
- **OpenAI API Key** - Get one free at https://platform.openai.com/api-keys
- **Git** - For repository operations (usually pre-installed)

## 🛠️ Troubleshooting

If you encounter issues:

1. **"command not found: node"** - Install Node.js first
2. **npm install fails** - Check your internet connection
3. **API key errors** - Re-run `node index.js setup` to reconfigure
4. **Permission errors** - Run terminal as administrator if needed

## 📂 File Structure

```
git-chatbot-cli/
├── index.js          # Main application (~20KB)
├── package.json      # Dependency list (~0.4KB)
├── README.md         # This file (~4KB)
├── .env.example      # Config template (~0.3KB)
└── .gitignore       # Upload prevention (~1.5KB)
```

After first run, these additional folders are created locally:
- `node_modules/` - Dependencies (~250MB, **Uploaded in Source-Folder**)
- `.env` - Your encrypted API key
- Temporary caches and logs

## ⏱️ First-Time Setup Time

- `npm install`: 10-30 seconds (depends on internet speed)
- Total setup: Usually under 1 minute
- Subsequent starts: Instant (just `node index.js`)

## 🔒 Security Notes

- Your OpenAI API key is stored locally only
- Never shared or transmitted except to OpenAI API
- node_modules folder is deliberately excluded from sharing
- You can inspect all source code in index.js

## 💬 Support

For issues or questions, check the console output for helpful error messages.
Most problems are resolved by re-running `npm install` or checking your API key.

---

**Ready to use in under a minute!** Just extract, run `npm install`, configure your API key, and start chatting with any GitHub repository.
