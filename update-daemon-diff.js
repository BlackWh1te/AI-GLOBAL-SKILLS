const fs = require('fs');
const path = require('path');
const file = path.join('apps', 'daemon', 'src', 'index.ts');
let content = fs.readFileSync(file, 'utf8');

// Add import diff
content = content.replace("import { DBManager, SecretsManager } from '@blackwh1te/core';", `import { DBManager, SecretsManager } from '@blackwh1te/core';
import * as diff from 'diff';`);

// Return diff in preview output
content = content.replace(/res\.json\(\{ oldConfig, newConfig, previewToken: token, oldHash, newHash \}\);/, `
    const textDiff = diff.createTwoFilesPatch(
      'current_config.json',
      'new_config.json',
      oldConfig,
      newConfig,
      'Current',
      'New'
    );
    res.json({ oldConfig, newConfig, previewToken: token, oldHash, newHash, diff: textDiff });
`);

fs.writeFileSync(file, content);
console.log('Daemon diff updated');
