#!/usr/bin/env python3
"""
Replace hardcoded zinc Tailwind classes with semantic theme classes.
"""

import re
import os

BASE = '/home/z/my-project/src/components'

FILES = [
    'layout/app-sidebar.tsx',
    'layout/app-header.tsx',
    'chat/chat-panel.tsx',
    'providers/provider-manager.tsx',
    'agents/agent-roster.tsx',
    'knowledge/knowledge-base.tsx',
    'tools/tools-panel.tsx',
    'settings/settings-panel.tsx',
]

def build_replacements():
    return [
        (r'bg-zinc-950/50', 'bg-background/50'),
        (r'bg-zinc-950', 'bg-background'),
        (r'bg-zinc-900/80', 'bg-card/80'),
        (r'bg-zinc-900', 'bg-card'),
        (r'bg-zinc-800/70', 'bg-muted/70'),
        (r'bg-zinc-800/60', 'bg-muted/60'),
        (r'bg-zinc-800', 'bg-muted'),
        (r'bg-zinc-700', 'bg-accent'),
        (r'bg-zinc-600', 'bg-accent'),
        (r'bg-zinc-500/10', 'bg-primary/10'),
        (r'bg-zinc-500', 'bg-accent'),
        (r'bg-zinc-400', 'bg-accent'),
        (r'placeholder:text-zinc-500', 'placeholder:text-muted-foreground'),
        (r'text-zinc-100', 'text-foreground'),
        (r'text-zinc-200', 'text-secondary-foreground'),
        (r'text-zinc-300', 'text-secondary-foreground'),
        (r'text-zinc-400', 'text-muted-foreground'),
        (r'text-zinc-500', 'text-muted-foreground/70'),
        (r'text-zinc-600', 'text-muted-foreground/50'),
        (r'text-zinc-700', 'text-muted-foreground/40'),
        (r'border-zinc-800/60', 'border-border/60'),
        (r'border-zinc-800', 'border-border'),
        (r'border-zinc-700/60', 'border-input/60'),
        (r'border-zinc-700', 'border-input'),
        (r'border-zinc-600', 'border-border'),
        (r'border-zinc-500', 'border-border'),
        (r'hover:bg-zinc-800/50', 'hover:bg-muted/50'),
        (r'hover:bg-zinc-800/70', 'hover:bg-muted/70'),
        (r'hover:bg-zinc-800', 'hover:bg-muted'),
        (r'hover:bg-zinc-900', 'hover:bg-card'),
        (r'hover:bg-zinc-700', 'hover:bg-accent'),
        (r'hover:text-zinc-100', 'hover:text-foreground'),
        (r'hover:text-zinc-200', 'hover:text-secondary-foreground'),
        (r'hover:text-zinc-300', 'hover:text-secondary-foreground'),
        (r'hover:text-zinc-400', 'hover:text-muted-foreground'),
        (r'hover:text-zinc-500', 'hover:text-muted-foreground/70'),
        (r'hover:border-zinc-700', 'hover:border-input'),
        (r'hover:border-zinc-600', 'hover:border-input'),
        (r'hover:border-zinc-800', 'hover:border-border'),
        (r'focus:bg-zinc-800', 'focus:bg-muted'),
        (r'focus:bg-zinc-800/70', 'focus:bg-muted/70'),
        (r'focus:text-zinc-100', 'focus:text-foreground'),
        (r'focus:text-zinc-200', 'focus:text-secondary-foreground'),
        (r'disabled:text-zinc-500', 'disabled:text-muted-foreground'),
        (r'active:bg-zinc-800', 'active:bg-muted'),
        (r'divide-zinc-800', 'divide-border'),
        (r'ring-zinc-800', 'ring-border'),
    ]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    replacements = build_replacements()
    
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        changes = 0
        temp = original
        for pattern, replacement in replacements:
            new_temp = re.sub(pattern, replacement, temp)
            if new_temp != temp:
                count = len(re.findall(pattern, temp))
                changes += count
                temp = new_temp
        
        print(f'  {os.path.basename(filepath)}: {changes} replacements')
        return changes
    else:
        print(f'  {os.path.basename(filepath)}: no changes needed')
        return 0

if __name__ == '__main__':
    total = 0
    print('Replacing hardcoded zinc classes with semantic theme classes...')
    for rel in FILES:
        full = os.path.join(BASE, rel)
        if os.path.exists(full):
            total += process_file(full)
        else:
            print(f'  {rel}: FILE NOT FOUND')
    print(f'\nTotal: {total} replacements across {len(FILES)} files')
