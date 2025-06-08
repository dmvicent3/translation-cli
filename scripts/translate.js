
        import { showConfig } from '../src/commands.js';
        import { loadConfig } from '../src/config.js';
        
        async function main() {
          try {
            if (process.argv.includes('--config')) {
              const config = await loadConfig();
              await showConfig(config);
              process.exit(0);
            }
          } catch (error) {
            console.error(error.message);
            process.exit(1);
          }
        }
        
        main();
        