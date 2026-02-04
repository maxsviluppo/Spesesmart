
filename = r'c:\Users\Max\Downloads\A Codici Main\Number-main\Number-main\App.tsx'
with open(filename, 'r', encoding='utf-8') as f:
    lines = f.readlines()

balance = 0
stack = []

for i, line in enumerate(lines):
    for char in line:
        if char == '{':
            balance += 1
            stack.append(i + 1)
        elif char == '}':
            balance -= 1
            if stack:
                stack.pop()

print(f'Final Balance: {balance}')
if balance > 0:
    print(f'Unclosed braces start at lines: {stack[:5]} ... (total {len(stack)})')
elif balance < 0:
    print('Too many closing braces!')

