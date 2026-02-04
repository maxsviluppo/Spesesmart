const fs = require('fs');

const filename = process.argv[2] || 'c:\\Users\\Max\\Downloads\\A Codici Main\\Number-main\\Number-main\\App.tsx';

try {
    const content = fs.readFileSync(filename, 'utf8');
    const lines = content.split('\n');

    let balance = 0;
    const stack = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '{') {
                balance++;
                stack.push({ line: i + 1, col: j + 1 });
            } else if (char === '}') {
                balance--;
                stack.pop();
            }
        }
    }

    console.log(`Final Balance: ${balance}`);
    if (balance > 0) {
        console.log('Unclosed braces remaining. Last 5 open braces at:');
        console.log(JSON.stringify(stack.slice(-5)));
    } else if (balance < 0) {
        console.log('Too many closing braces! Balance went negative.');
    } else {
        console.log('Braces are balanced!');
    }

} catch (err) {
    console.error('Error reading file:', err);
}
