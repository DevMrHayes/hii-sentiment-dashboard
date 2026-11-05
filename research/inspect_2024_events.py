import json

with open('hii-sentiment-dashboard/data/evidence_ledger.json', 'r', encoding='utf-8') as f:
    events = json.load(f)

print(f'Total events: {len(events)}')
events_2024_plus = [e for e in events if e.get('eventDate', '') >= '2024-01-01']
print(f'Events from 2024+: {len(events_2024_plus)}')

for e in sorted(events_2024_plus, key=lambda x: x['eventDate']):
    pub_imp = [i for i in e.get('impacts', []) if i.get('audience') == 'public']
    print(f"{e['eventDate']} | {e['id']} | Starred: {e.get('starred', False)} | {e['title'][:60]}")
    for imp in e.get('impacts', []):
        print(f"   aud={imp['audience']}: dir={imp.get('direction')}, mag={imp.get('magnitude')}, scope={imp.get('scope')}, pers={imp.get('persistence')}")
