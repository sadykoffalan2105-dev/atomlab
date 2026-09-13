import json
keys=['scientific','Clo2CinemaScene','CinemaGlowPoints','CinemaDomLabels','steppedStoryClock','clo2Step','clo2Mechanism','storyboard','clo2ScenarioTiming']
for f in json.load(open('.smoke/lint.json',encoding='utf-8')):
  p=f['filePath']
  if any(x in p for x in keys):
    for m in f['messages']:
      print(p.split('src')[-1], m['line'], m.get('ruleId'), m['message'][:70].replace('\n',' '))
