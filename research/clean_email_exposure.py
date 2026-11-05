from pathlib import Path

p = Path('hii-sentiment-dashboard/src/components/AuthWall.tsx')
text = p.read_text(encoding='utf-8')

text = text.replace(
    'Administrator: <span className="font-mono text-white/90">hayesorhaze@gmail.com</span>',
    'System: <span className="font-mono text-white/90">Restricted Defense Intelligence Network</span>'
)
text = text.replace(
    'administrator <span className="font-mono font-bold text-white">hayesorhaze@gmail.com</span>',
    'the System Administrator'
)
text = text.replace(
    'Request Clearance from hayesorhaze@gmail.com',
    'Request Clearance from System Administrator'
)

p.write_text(text, encoding='utf-8')
print('Updated AuthWall.tsx cleanly')

# Also update DashboardContext.tsx
p2 = Path('hii-sentiment-dashboard/src/context/DashboardContext.tsx')
text2 = p2.read_text(encoding='utf-8')
text2 = text2.replace('administrator hayesorhaze@gmail.com', 'System Administrator')
p2.write_text(text2, encoding='utf-8')
print('Updated DashboardContext.tsx cleanly')
