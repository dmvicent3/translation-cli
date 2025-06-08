
        import fs from 'fs/promises';
        import { parseTranslationInput } from '../src/commands.js';
        
        async function main() {
          try {
            const jsonFile = process.argv[2];
            if (!jsonFile) {
              console.error('Please provide a JSON file path');
              process.exit(1);
            }
            
            const jsonContent = await fs.readFile(jsonFile, 'utf-8');
            
            try {
              parseTranslationInput(jsonContent);
              console.log('JSON format is valid');
              process.exit(0);
            } catch (error) {
              console.error(error.message);
              process.exit(1);
            }
          } catch (error) {
            console.error(error.message);
            process.exit(1);
          }
        }
        
        main();
        