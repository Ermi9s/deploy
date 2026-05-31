import os
import re

files = [
    'components/drive/upload-modal.tsx',
    'components/drive/trash-modal.tsx',
    'components/drive/department-access-picker.tsx',
    'components/drive/file-preview.tsx',
    'components/account/profile-form.tsx'
]

replacements = {
    r'bg-white': 'bg-card',
    r'bg-gray-50': 'bg-muted',
    r'bg-gray-100': 'bg-accent',
    r'bg-slate-50': 'bg-muted',
    r'bg-slate-100': 'bg-accent',
    r'text-gray-800': 'text-foreground',
    r'text-gray-600': 'text-muted-foreground',
    r'text-gray-500': 'text-muted-foreground',
    r'text-slate-800': 'text-foreground',
    r'text-slate-700': 'text-foreground/90',
    r'text-slate-600': 'text-muted-foreground/80',
    r'text-slate-500': 'text-muted-foreground',
    r'text-slate-400': 'text-muted-foreground',
    r'border-gray-200': 'border-border',
    r'border-gray-300': 'border-border',
    r'border-slate-100': 'border-border/50',
    r'border-slate-200': 'border-border',
    r'divide-slate-100': 'divide-border/50',
    r'divide-slate-200': 'divide-border',
    r'bg-card/80': 'bg-muted/50',  # fix for bg-slate-50/80
}

for file_path in files:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r') as f:
        content = f.read()
    
    for old, new in replacements.items():
        # Only replace if old is a full tailwind class word
        content = re.sub(r'(?<![a-zA-Z0-9-])' + old + r'(?![a-zA-Z0-9-])', new, content)
    
    with open(file_path, 'w') as f:
        f.write(content)

print("Done")
